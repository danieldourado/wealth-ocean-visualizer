import * as THREE from 'three';
import { OCEAN_CONFIG, getLightingForDepth } from '../data/creatureConfig.js';

/**
 * Ocean Environment
 * Creates the underwater world with water surface, caustics, and atmospheric effects
 */
export class Ocean {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;

    this.init();
  }

  init() {
    this.createWaterSurface();
    this.createOceanFloor();
    this.createCaustics();
    this.createGodRays();
    this.createParticles();
  }

  createWaterSurface() {
    // Water surface geometry
    const geometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2,
      128,
      128
    );

    // Custom water shader
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        uWaterColor: { value: new THREE.Color(0x0077be) },
        uDeepColor: { value: new THREE.Color(0x001133) },
        uSurfaceColor: { value: new THREE.Color(0x88ccff) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        uniform float uTime;

        // Simplex noise for waves
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Multiple wave layers
          float wave1 = snoise(vec3(pos.x * 0.02, pos.z * 0.02, uTime * 0.3)) * 2.0;
          float wave2 = snoise(vec3(pos.x * 0.05, pos.z * 0.05, uTime * 0.5)) * 1.0;
          float wave3 = snoise(vec3(pos.x * 0.1, pos.z * 0.1, uTime * 0.7)) * 0.5;

          pos.y += wave1 + wave2 + wave3;

          // Calculate normal from displacement
          float delta = 0.1;
          float hL = snoise(vec3((pos.x - delta) * 0.02, pos.z * 0.02, uTime * 0.3)) * 2.0;
          float hR = snoise(vec3((pos.x + delta) * 0.02, pos.z * 0.02, uTime * 0.3)) * 2.0;
          float hD = snoise(vec3(pos.x * 0.02, (pos.z - delta) * 0.02, uTime * 0.3)) * 2.0;
          float hU = snoise(vec3(pos.x * 0.02, (pos.z + delta) * 0.02, uTime * 0.3)) * 2.0;

          vNormal = normalize(vec3(hL - hR, 2.0 * delta, hD - hU));
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uWaterColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSurfaceColor;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

          // Fresnel effect
          float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);

          // Sun reflection
          vec3 reflectDir = reflect(-uSunDirection, vNormal);
          float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 64.0);

          // Mix colors
          vec3 color = mix(uDeepColor, uSurfaceColor, fresnel);
          color += vec3(1.0, 0.95, 0.8) * spec * 0.8;

          // Add shimmer
          float shimmer = sin(vWorldPosition.x * 0.5 + uTime) * sin(vWorldPosition.z * 0.5 + uTime * 0.7) * 0.1;
          color += shimmer;

          gl_FragColor = vec4(color, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.waterSurface = new THREE.Mesh(geometry, waterMaterial);
    this.waterSurface.rotation.x = -Math.PI / 2;
    this.waterSurface.position.y = OCEAN_CONFIG.surfaceY;
    this.scene.add(this.waterSurface);
  }

  createOceanFloor() {
    const geometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2,
      64,
      64
    );

    // Add some terrain variation
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const noise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 5;
      positions.setZ(i, noise);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    this.oceanFloor = new THREE.Mesh(geometry, material);
    this.oceanFloor.rotation.x = -Math.PI / 2;
    this.oceanFloor.position.y = OCEAN_CONFIG.floorY;
    this.scene.add(this.oceanFloor);
  }

  createCaustics() {
    // Caustic light patterns projected on surfaces
    const causticsGeometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2
    );

    const causticsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;

        float caustic(vec2 uv, float time) {
          vec2 p = mod(uv * 6.28318, 6.28318) - 3.14159;
          float c = 0.0;
          for(int i = 0; i < 3; i++) {
            float t = time * (1.0 + float(i) * 0.2);
            c += sin(p.x * cos(t) + p.y * sin(t))
               + sin(p.y * cos(t * 1.1) - p.x * sin(t * 0.9));
          }
          return c * 0.5 + 0.5;
        }

        void main() {
          float c1 = caustic(vUv * 3.0, uTime * 0.5);
          float c2 = caustic(vUv * 5.0 + 0.5, uTime * 0.7);
          float c = (c1 + c2) * 0.5;
          c = pow(c, 2.0) * uIntensity;
          gl_FragColor = vec4(vec3(0.4, 0.8, 1.0) * c, c * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.caustics = new THREE.Mesh(causticsGeometry, causticsMaterial);
    this.caustics.rotation.x = -Math.PI / 2;
    this.caustics.position.y = OCEAN_CONFIG.floorY + 0.5;
    this.scene.add(this.caustics);
  }

  createGodRays() {
    // Volumetric light shafts from surface
    const rayCount = 8;
    this.godRays = [];

    for (let i = 0; i < rayCount; i++) {
      const geometry = new THREE.ConeGeometry(15, 150, 4, 1, true);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.1 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vY;
          void main() {
            vUv = uv;
            vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uOpacity;
          varying vec2 vUv;
          varying float vY;

          void main() {
            float fade = smoothstep(-75.0, 75.0, vY);
            float flicker = sin(uTime * 2.0 + vUv.x * 10.0) * 0.2 + 0.8;
            float alpha = fade * flicker * uOpacity;
            gl_FragColor = vec4(0.6, 0.9, 1.0, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const ray = new THREE.Mesh(geometry, material);
      const angle = (i / rayCount) * Math.PI * 2;
      const radius = 50 + Math.random() * 100;
      ray.position.set(
        Math.cos(angle) * radius,
        -75,
        Math.sin(angle) * radius
      );
      ray.rotation.z = Math.random() * 0.3 - 0.15;

      this.godRays.push(ray);
      this.scene.add(ray);
    }
  }

  createParticles() {
    // Floating particles (plankton, debris)
    const particleCount = OCEAN_CONFIG.particles.plankton.count;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * OCEAN_CONFIG.width;
      positions[i * 3 + 1] = Math.random() * OCEAN_CONFIG.depth * -1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * OCEAN_CONFIG.width;
      sizes[i] = Math.random() * 2 + 0.5;
      opacities[i] = Math.random() * 0.5 + 0.3;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x88ccff) }
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        uniform float uTime;

        void main() {
          vOpacity = opacity;
          vec3 pos = position;

          // Gentle floating motion
          pos.y += sin(uTime * 0.5 + position.x * 0.1) * 0.5;
          pos.x += sin(uTime * 0.3 + position.z * 0.1) * 0.3;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = (1.0 - dist * 2.0) * vOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  update(deltaTime, cameraY) {
    this.time += deltaTime;

    // Update water surface
    if (this.waterSurface) {
      this.waterSurface.material.uniforms.uTime.value = this.time;
    }

    // Update caustics
    if (this.caustics) {
      this.caustics.material.uniforms.uTime.value = this.time;
      // Fade caustics with depth
      const intensity = Math.max(0, 0.3 - Math.abs(cameraY) * 0.002);
      this.caustics.material.uniforms.uIntensity.value = intensity;
    }

    // Update god rays
    this.godRays.forEach((ray, i) => {
      ray.material.uniforms.uTime.value = this.time + i;
      // Fade rays with depth
      const opacity = Math.max(0, 0.15 - Math.abs(cameraY) * 0.001);
      ray.material.uniforms.uOpacity.value = opacity;
    });

    // Update particles
    if (this.particles) {
      this.particles.material.uniforms.uTime.value = this.time;
    }

    // Update fog based on depth
    const lighting = getLightingForDepth(cameraY);
    this.scene.fog.density = lighting.fog;
    this.scene.fog.color.setHex(lighting.fogColor);
    this.scene.background = new THREE.Color(lighting.fogColor);
  }

  dispose() {
    this.waterSurface?.geometry.dispose();
    this.waterSurface?.material.dispose();
    this.oceanFloor?.geometry.dispose();
    this.oceanFloor?.material.dispose();
    this.caustics?.geometry.dispose();
    this.caustics?.material.dispose();
    this.godRays.forEach(ray => {
      ray.geometry.dispose();
      ray.material.dispose();
    });
    this.particles?.geometry.dispose();
    this.particles?.material.dispose();
  }
}
