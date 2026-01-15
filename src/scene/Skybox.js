import * as THREE from 'three';

/**
 * Skybox / Above-water environment
 * Shows the sky when near or above the surface
 */
export class Skybox {
  constructor(scene) {
    this.scene = scene;
    this.init();
  }

  init() {
    // Create gradient sky using a large sphere
    const geometry = new THREE.SphereGeometry(500, 32, 32);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(0x0077ff) },
        uBottomColor: { value: new THREE.Color(0x001133) },
        uHorizonColor: { value: new THREE.Color(0x88ccff) },
        uSunPosition: { value: new THREE.Vector3(100, 80, 50) },
        uSunColor: { value: new THREE.Color(0xffffee) },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunPosition;
        uniform vec3 uSunColor;
        uniform float uTime;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          // Height-based gradient
          float h = normalize(vWorldPosition).y;

          // Three-way gradient: bottom -> horizon -> top
          vec3 color;
          if (h < 0.0) {
            // Below horizon - underwater fade
            color = mix(uBottomColor, uHorizonColor, h + 1.0);
          } else {
            // Above horizon - sky gradient
            float t = pow(h, 0.5);
            color = mix(uHorizonColor, uTopColor, t);
          }

          // Sun
          vec3 sunDir = normalize(uSunPosition);
          vec3 viewDir = normalize(vWorldPosition);
          float sunDot = dot(viewDir, sunDir);

          // Sun disc
          float sunDisc = smoothstep(0.995, 0.999, sunDot);
          color = mix(color, uSunColor, sunDisc);

          // Sun glow
          float sunGlow = pow(max(0.0, sunDot), 8.0) * 0.5;
          color += uSunColor * sunGlow;

          // Atmospheric scattering near horizon
          float horizonGlow = 1.0 - abs(h);
          horizonGlow = pow(horizonGlow, 3.0) * 0.3;
          color += vec3(1.0, 0.8, 0.6) * horizonGlow;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.sky = new THREE.Mesh(geometry, material);
    this.scene.add(this.sky);

    // Create a sun flare sprite
    this.createSunFlare();
  }

  createSunFlare() {
    // Create lens flare effect using sprites
    const flareTexture = this.generateFlareTexture();

    const flareMaterial = new THREE.SpriteMaterial({
      map: flareTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6
    });

    this.sunFlare = new THREE.Sprite(flareMaterial);
    this.sunFlare.scale.set(80, 80, 1);
    this.sunFlare.position.set(100, 80, 50);
    this.scene.add(this.sunFlare);
  }

  generateFlareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Radial gradient for flare
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 220, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 220, 150, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 180, 100, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  update(cameraY, time) {
    // Update sky shader time
    this.sky.material.uniforms.uTime.value = time;

    // Fade skybox based on depth
    const depth = Math.abs(Math.min(0, cameraY));
    const opacity = Math.max(0, 1 - depth * 0.02);
    this.sky.material.opacity = opacity;
    this.sky.visible = opacity > 0.01;

    // Fade sun flare
    if (this.sunFlare) {
      this.sunFlare.material.opacity = opacity * 0.6;
      this.sunFlare.visible = opacity > 0.01;
    }
  }

  dispose() {
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    if (this.sunFlare) {
      this.sunFlare.material.map?.dispose();
      this.sunFlare.material.dispose();
    }
  }
}
