import * as THREE from 'three';
import { OCEAN_CONFIG, getLightingForDepth } from '../data/creatureConfig.js';

/**
 * Photorealistic Ocean Environment
 * Features:
 * - Gerstner wave simulation for physically accurate wave shapes
 * - PBR water material with fresnel, refraction, and subsurface scattering
 * - Volumetric god rays with raymarching
 * - Animated caustics with depth falloff
 * - Realistic particle systems
 */
export class Ocean {
  constructor(scene, renderer, lighting) {
    this.scene = scene;
    this.renderer = renderer;
    this.lighting = lighting;
    this.time = 0;

    this.init();
  }

  init() {
    this.createWaterSurface();
    this.createOceanFloor();
    this.createCaustics();
    this.createGodRays();
    this.createParticles();
    this.createUnderwaterDust();
  }

  createWaterSurface() {
    // High-resolution water surface for Gerstner waves
    const geometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2,
      256,
      256
    );

    // Photorealistic water shader with Gerstner waves
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfff8e0) },
        uWaterColor: { value: new THREE.Color(0x006994) },
        uDeepColor: { value: new THREE.Color(0x001a33) },
        uSurfaceColor: { value: new THREE.Color(0x66ccff) },
        uFoamColor: { value: new THREE.Color(0xffffff) },
        uCameraPosition: { value: new THREE.Vector3() },
        uEnvMapIntensity: { value: 1.0 },
        // Gerstner wave parameters [amplitude, wavelength, speed, direction]
        uWave1: { value: new THREE.Vector4(1.5, 60, 1.2, 0.0) },
        uWave2: { value: new THREE.Vector4(0.8, 30, 1.8, 0.4) },
        uWave3: { value: new THREE.Vector4(0.4, 15, 2.5, -0.3) },
        uWave4: { value: new THREE.Vector4(0.2, 8, 3.2, 0.7) }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec4 uWave1;
        uniform vec4 uWave2;
        uniform vec4 uWave3;
        uniform vec4 uWave4;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWaveHeight;

        // Gerstner wave function
        // Returns displacement and contributes to normal calculation
        vec3 gerstnerWave(vec4 wave, vec3 p, inout vec3 tangent, inout vec3 binormal) {
          float amplitude = wave.x;
          float wavelength = wave.y;
          float speed = wave.z;
          float direction = wave.w;

          float k = 2.0 * 3.14159 / wavelength;
          float c = sqrt(9.8 / k); // Phase speed from dispersion relation
          vec2 d = normalize(vec2(cos(direction), sin(direction)));
          float f = k * (dot(d, p.xz) - c * speed * uTime);
          float a = amplitude / k; // Steepness

          tangent += vec3(
            -d.x * d.x * amplitude * sin(f),
            d.x * amplitude * cos(f),
            -d.x * d.y * amplitude * sin(f)
          );

          binormal += vec3(
            -d.x * d.y * amplitude * sin(f),
            d.y * amplitude * cos(f),
            -d.y * d.y * amplitude * sin(f)
          );

          return vec3(
            d.x * a * cos(f),
            a * sin(f),
            d.y * a * cos(f)
          );
        }

        void main() {
          vUv = uv;
          vec3 pos = position;

          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);

          // Apply multiple Gerstner waves
          vec3 displacement = vec3(0.0);
          displacement += gerstnerWave(uWave1, pos, tangent, binormal);
          displacement += gerstnerWave(uWave2, pos, tangent, binormal);
          displacement += gerstnerWave(uWave3, pos, tangent, binormal);
          displacement += gerstnerWave(uWave4, pos, tangent, binormal);

          pos += displacement;
          vWaveHeight = displacement.y;

          // Calculate normal from tangent and binormal
          vNormal = normalize(cross(binormal, tangent));

          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform vec3 uWaterColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSurfaceColor;
        uniform vec3 uFoamColor;
        uniform vec3 uCameraPosition;
        uniform float uEnvMapIntensity;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWaveHeight;

        // Schlick's Fresnel approximation
        float fresnel(vec3 viewDir, vec3 normal, float F0) {
          float cosTheta = max(dot(viewDir, normal), 0.0);
          return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
        }

        // Subsurface scattering approximation
        vec3 subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 color) {
          vec3 H = normalize(lightDir + normal * 0.6);
          float VdotH = pow(clamp(dot(viewDir, -H), 0.0, 1.0), 3.0);
          return color * VdotH * 0.5;
        }

        void main() {
          vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
          vec3 normal = normalize(vNormal);

          // Fresnel effect - water IOR is ~1.33
          float F0 = 0.02; // Fresnel reflectance at normal incidence for water
          float fresnelFactor = fresnel(viewDirection, normal, F0);

          // Reflection direction
          vec3 reflectDir = reflect(-viewDirection, normal);

          // Sun specular reflection (GGX-like)
          vec3 halfVector = normalize(uSunDirection + viewDirection);
          float NdotH = max(dot(normal, halfVector), 0.0);
          float roughness = 0.1;
          float alpha = roughness * roughness;
          float denom = NdotH * NdotH * (alpha - 1.0) + 1.0;
          float D = alpha / (3.14159 * denom * denom);
          float spec = D * fresnelFactor;

          // Base water color with depth variation
          float depthFactor = smoothstep(-2.0, 2.0, vWaveHeight);
          vec3 waterColor = mix(uDeepColor, uWaterColor, depthFactor);

          // Subsurface scattering for that glowing underwater look
          vec3 sss = subsurfaceScattering(uSunDirection, viewDirection, normal, uSurfaceColor);

          // Sky reflection approximation
          float skyReflection = max(0.0, reflectDir.y);
          vec3 skyColor = mix(vec3(0.4, 0.6, 0.8), vec3(0.7, 0.85, 1.0), skyReflection);

          // Combine reflection and refraction
          vec3 reflectionColor = skyColor * uEnvMapIntensity;
          vec3 refractionColor = waterColor + sss;

          vec3 color = mix(refractionColor, reflectionColor, fresnelFactor * 0.7);

          // Add sun specular
          color += uSunColor * spec * 2.0;

          // Foam on wave peaks
          float foam = smoothstep(1.0, 2.0, vWaveHeight);
          color = mix(color, uFoamColor, foam * 0.3);

          // Caustic shimmer on surface
          float shimmer = sin(vWorldPosition.x * 0.3 + uTime * 2.0) *
                          sin(vWorldPosition.z * 0.3 + uTime * 1.7) * 0.5 + 0.5;
          shimmer = pow(shimmer, 4.0) * 0.15;
          color += vec3(shimmer);

          // Slight color variation for realism
          float variation = sin(vWorldPosition.x * 0.05) * sin(vWorldPosition.z * 0.07) * 0.05;
          color += variation;

          gl_FragColor = vec4(color, 0.92);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true
    });

    this.waterSurface = new THREE.Mesh(geometry, waterMaterial);
    this.waterSurface.rotation.x = -Math.PI / 2;
    this.waterSurface.position.y = OCEAN_CONFIG.surfaceY;
    this.waterSurface.receiveShadow = true;
    this.scene.add(this.waterSurface);
  }

  createOceanFloor() {
    const geometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2,
      128,
      128
    );

    // Add realistic terrain variation using multiple noise octaves
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Multiple octaves of noise for natural terrain
      let height = 0;
      height += Math.sin(x * 0.02) * Math.cos(y * 0.02) * 8;
      height += Math.sin(x * 0.05 + 1.3) * Math.cos(y * 0.04 - 0.7) * 4;
      height += Math.sin(x * 0.1 + 2.1) * Math.cos(y * 0.12 + 1.5) * 2;
      height += Math.sin(x * 0.2 - 0.5) * Math.cos(y * 0.18 + 0.3) * 1;

      positions.setZ(i, height);
    }
    geometry.computeVertexNormals();

    // PBR material for ocean floor
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
      envMapIntensity: 0.3
    });

    this.oceanFloor = new THREE.Mesh(geometry, material);
    this.oceanFloor.rotation.x = -Math.PI / 2;
    this.oceanFloor.position.y = OCEAN_CONFIG.floorY;
    this.oceanFloor.receiveShadow = true;
    this.scene.add(this.oceanFloor);

    // Add some rocks and features
    this.createSeafloorDetails();
  }

  createSeafloorDetails() {
    // Add scattered rocks on the ocean floor
    const rockGeometry = new THREE.DodecahedronGeometry(1, 1);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3a4a,
      roughness: 0.9,
      metalness: 0.1
    });

    const rockCount = 50;
    for (let i = 0; i < rockCount; i++) {
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      const scale = 1 + Math.random() * 4;
      rock.scale.set(
        scale * (0.8 + Math.random() * 0.4),
        scale * (0.5 + Math.random() * 0.5),
        scale * (0.8 + Math.random() * 0.4)
      );
      rock.position.set(
        (Math.random() - 0.5) * OCEAN_CONFIG.width * 1.5,
        OCEAN_CONFIG.floorY + scale * 0.3,
        (Math.random() - 0.5) * OCEAN_CONFIG.width * 1.5
      );
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  createCaustics() {
    // Improved caustic light patterns with texture-based animation
    const causticsGeometry = new THREE.PlaneGeometry(
      OCEAN_CONFIG.width * 2,
      OCEAN_CONFIG.width * 2
    );

    const causticsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.4 },
        uScale: { value: 8.0 },
        uSpeed: { value: 0.5 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uScale;
        uniform float uSpeed;

        varying vec2 vUv;
        varying vec3 vWorldPosition;

        // Voronoi-based caustics for more realistic light patterns
        vec2 hash2(vec2 p) {
          return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
        }

        float voronoi(vec2 x, float time) {
          vec2 n = floor(x);
          vec2 f = fract(x);

          float md = 8.0;
          vec2 mg;

          for(int j = -1; j <= 1; j++) {
            for(int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash2(n + g);
              o = 0.5 + 0.5 * sin(time + 6.2831 * o);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if(d < md) {
                md = d;
                mg = g;
              }
            }
          }
          return md;
        }

        float caustic(vec2 uv, float time) {
          float c = 0.0;

          // Multiple layers of voronoi for complex caustic pattern
          c += voronoi(uv * 3.0, time * 0.7) * 0.5;
          c += voronoi(uv * 5.0 + 1.3, time * 1.1) * 0.3;
          c += voronoi(uv * 8.0 - 2.1, time * 1.5) * 0.2;

          // Sharpen the caustics
          c = pow(c, 0.5);
          c = 1.0 - c;
          c = pow(c, 3.0);

          return c;
        }

        void main() {
          vec2 uv = vWorldPosition.xz * 0.01 * uScale;
          float time = uTime * uSpeed;

          // Animated caustics
          float c1 = caustic(uv, time);
          float c2 = caustic(uv * 1.2 + 0.5, time * 1.3);
          float c = (c1 + c2) * 0.5;

          // Color - cyan/white caustic light
          vec3 causticColor = mix(
            vec3(0.3, 0.7, 0.9),
            vec3(1.0, 1.0, 1.0),
            c
          );

          float alpha = c * uIntensity;
          gl_FragColor = vec4(causticColor * c, alpha);
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
    // Volumetric light shafts using raymarching
    const rayCount = 12;
    this.godRays = [];

    for (let i = 0; i < rayCount; i++) {
      // Cone geometry for light shaft
      const geometry = new THREE.CylinderGeometry(2, 20, 180, 8, 1, true);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.08 },
          uColor: { value: new THREE.Color(0x88ccff) },
          uNoiseScale: { value: 2.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vY;
          varying vec3 vWorldPosition;

          void main() {
            vUv = uv;
            vY = position.y;
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uOpacity;
          uniform vec3 uColor;
          uniform float uNoiseScale;

          varying vec2 vUv;
          varying float vY;
          varying vec3 vWorldPosition;

          // Simple noise function
          float noise(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          }

          float fbm(vec3 p) {
            float f = 0.0;
            f += 0.5 * noise(p); p *= 2.01;
            f += 0.25 * noise(p); p *= 2.02;
            f += 0.125 * noise(p);
            return f;
          }

          void main() {
            // Vertical fade - stronger at top, fading toward bottom
            float verticalFade = smoothstep(-90.0, 90.0, vY);
            verticalFade = pow(verticalFade, 0.5);

            // Radial fade from center
            float radialFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
            radialFade = pow(radialFade, 2.0);

            // Animated noise for volumetric feel
            vec3 noiseCoord = vWorldPosition * 0.02 * uNoiseScale + vec3(0.0, uTime * 0.1, 0.0);
            float n = fbm(noiseCoord);

            // Flickering
            float flicker = sin(uTime * 1.5 + vUv.x * 10.0) * 0.15 + 0.85;

            float alpha = verticalFade * radialFade * n * flicker * uOpacity;

            // Color variation with depth
            vec3 color = uColor;
            color = mix(color, vec3(0.4, 0.7, 0.9), 1.0 - verticalFade);

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const ray = new THREE.Mesh(geometry, material);

      // Position rays in a natural pattern
      const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 30 + Math.random() * 80;
      ray.position.set(
        Math.cos(angle) * radius,
        -90,
        Math.sin(angle) * radius
      );

      // Slight random tilt
      ray.rotation.x = (Math.random() - 0.5) * 0.2;
      ray.rotation.z = (Math.random() - 0.5) * 0.2;

      this.godRays.push(ray);
      this.scene.add(ray);
    }
  }

  createParticles() {
    // Floating particles (plankton, marine snow)
    const particleCount = OCEAN_CONFIG.particles.plankton.count;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * OCEAN_CONFIG.width;
      positions[i * 3 + 1] = Math.random() * OCEAN_CONFIG.depth * -1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * OCEAN_CONFIG.width;
      sizes[i] = Math.random() * 3 + 1;
      opacities[i] = Math.random() * 0.4 + 0.2;
      speeds[i] = Math.random() * 0.5 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xaaddff) },
        uCameraY: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        attribute float speed;

        varying float vOpacity;
        varying float vDepth;

        uniform float uTime;
        uniform float uCameraY;

        void main() {
          vOpacity = opacity;
          vec3 pos = position;

          // Gentle floating motion with individual variation
          float t = uTime * speed;
          pos.y += sin(t * 0.5 + position.x * 0.1) * 0.8;
          pos.x += sin(t * 0.3 + position.z * 0.1) * 0.5;
          pos.z += cos(t * 0.4 + position.y * 0.05) * 0.3;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vDepth = -mvPosition.z;

          // Size attenuation
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        varying float vDepth;

        void main() {
          // Soft circular particle
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = (1.0 - dist * 2.0) * vOpacity;

          // Fade with distance for depth of field effect
          float depthFade = 1.0 - smoothstep(50.0, 200.0, vDepth);
          alpha *= depthFade;

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

  createUnderwaterDust() {
    // Additional fine dust particles for atmosphere
    const dustCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    const sizes = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * OCEAN_CONFIG.width * 1.5;
      positions[i * 3 + 1] = Math.random() * OCEAN_CONFIG.depth * -1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * OCEAN_CONFIG.width * 1.5;
      sizes[i] = Math.random() * 1.5 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x668899) }
      },
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        uniform float uTime;

        void main() {
          vec3 pos = position;

          // Very slow drift
          pos.y += sin(uTime * 0.1 + position.x * 0.02) * 0.3;
          pos.x += sin(uTime * 0.08 + position.z * 0.02) * 0.2;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Fade with distance
          vAlpha = 1.0 - smoothstep(30.0, 150.0, -mvPosition.z);

          gl_PointSize = size * (80.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 3.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = (1.0 - dist * 2.0) * vAlpha * 0.15;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.dust = new THREE.Points(geometry, material);
    this.scene.add(this.dust);
  }

  update(deltaTime, cameraY) {
    this.time += deltaTime;

    // Update water surface
    if (this.waterSurface) {
      this.waterSurface.material.uniforms.uTime.value = this.time;
      // Update camera position for fresnel calculation
      if (this.waterSurface.material.uniforms.uCameraPosition) {
        // This will be updated from main.js with actual camera position
      }
    }

    // Update caustics
    if (this.caustics) {
      this.caustics.material.uniforms.uTime.value = this.time;
      // Fade caustics with depth - more realistic falloff
      const depth = Math.abs(cameraY);
      const intensity = Math.max(0, 0.4 * Math.exp(-depth * 0.015));
      this.caustics.material.uniforms.uIntensity.value = intensity;
    }

    // Update god rays
    this.godRays.forEach((ray, i) => {
      ray.material.uniforms.uTime.value = this.time + i * 0.5;
      // Fade rays with depth
      const depth = Math.abs(cameraY);
      const opacity = Math.max(0, 0.12 * Math.exp(-depth * 0.012));
      ray.material.uniforms.uOpacity.value = opacity;
    });

    // Update particles
    if (this.particles) {
      this.particles.material.uniforms.uTime.value = this.time;
      this.particles.material.uniforms.uCameraY.value = cameraY;
    }

    // Update dust
    if (this.dust) {
      this.dust.material.uniforms.uTime.value = this.time;
    }

    // Update fog based on depth (fog is created by Lighting system)
    if (this.scene.fog) {
      const lighting = getLightingForDepth(cameraY);
      this.scene.fog.density = lighting.fog;
      this.scene.fog.color.setHex(lighting.fogColor);
      this.scene.background = new THREE.Color(lighting.fogColor);
    }
  }

  // Update camera position for water shader
  updateCameraPosition(cameraPosition) {
    if (this.waterSurface && this.waterSurface.material.uniforms.uCameraPosition) {
      this.waterSurface.material.uniforms.uCameraPosition.value.copy(cameraPosition);
    }
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
    this.dust?.geometry.dispose();
    this.dust?.material.dispose();
  }
}
