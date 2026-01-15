import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OCEAN_CONFIG, getLightingForDepth } from '../data/creatureConfig.js';

/**
 * Photorealistic Underwater Lighting System
 * Features:
 * - HDRI environment map for realistic reflections
 * - Wavelength-based light absorption (Beer-Lambert law)
 * - Soft shadows with PCF
 * - Depth-based bioluminescence
 */
export class Lighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.lights = {};
    this.envMap = null;
    this.pmremGenerator = null;

    // Light absorption coefficients (per meter) based on water optics
    // Red light is absorbed fastest, blue penetrates deepest
    this.absorptionCoefficients = {
      red: 0.45,    // Absorbed by ~5m
      green: 0.07,  // Absorbed by ~20m
      blue: 0.015   // Penetrates 100m+
    };

    this.init();
  }

  async init() {
    // Setup PMREM generator for environment maps
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    // Load HDRI environment map
    await this.loadHDRI();

    // Ambient light - base illumination
    this.lights.ambient = new THREE.AmbientLight(0x6699cc, 0.4);
    this.scene.add(this.lights.ambient);

    // Directional light - sun through water with soft shadows
    this.lights.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.lights.sun.position.set(50, 100, 30);
    this.lights.sun.castShadow = true;

    // High-quality shadow settings
    this.lights.sun.shadow.mapSize.width = 4096;
    this.lights.sun.shadow.mapSize.height = 4096;
    this.lights.sun.shadow.camera.near = 0.5;
    this.lights.sun.shadow.camera.far = 500;
    this.lights.sun.shadow.camera.left = -200;
    this.lights.sun.shadow.camera.right = 200;
    this.lights.sun.shadow.camera.top = 200;
    this.lights.sun.shadow.camera.bottom = -200;
    this.lights.sun.shadow.bias = -0.0001;
    this.lights.sun.shadow.normalBias = 0.02;
    this.lights.sun.shadow.radius = 2; // Soft shadow blur
    this.scene.add(this.lights.sun);

    // Hemisphere light - sky/ground color blend for ambient occlusion feel
    this.lights.hemi = new THREE.HemisphereLight(
      0x88ddff, // Sky color (bright blue)
      0x080820, // Ground color (deep ocean)
      0.3
    );
    this.scene.add(this.lights.hemi);

    // Secondary fill light from below (simulates light bouncing off ocean floor)
    this.lights.fill = new THREE.DirectionalLight(0x1a3a5a, 0.15);
    this.lights.fill.position.set(0, -50, 0);
    this.scene.add(this.lights.fill);

    // Point lights for bioluminescence effect at depth
    this.createBioluminescence();

    // Setup volumetric fog
    this.scene.fog = new THREE.FogExp2(0x0d3b66, 0.002);
    this.scene.background = new THREE.Color(0x0d3b66);
  }

  async loadHDRI() {
    // Try to load HDRI, fall back to procedural environment if not available
    const loader = new RGBELoader();

    try {
      // First try to load a custom HDRI
      const texture = await new Promise((resolve, reject) => {
        loader.load(
          '/assets/hdri/underwater.hdr',
          resolve,
          undefined,
          () => reject(new Error('HDRI not found'))
        );
      });

      this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();

    } catch (e) {
      // Fall back to procedural underwater environment
      console.log('HDRI not found, using procedural environment');
      this.envMap = this.createProceduralEnvironment();
    }

    this.scene.environment = this.envMap;
  }

  createProceduralEnvironment() {
    // Create a simple procedural environment using a render target
    // For underwater scenes, we use a subtle blue-cyan gradient
    const size = 128;

    // Create a simple color for environment (will be enhanced by scene lighting)
    const envColor = new THREE.Color(0x1a4a6a);

    // Create a simple cube render target as environment
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(size, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });

    // Create a simple scene for the environment
    const envScene = new THREE.Scene();
    envScene.background = envColor;

    // Add gradient sphere
    const gradientMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x3388aa) },
        uBottomColor: { value: new THREE.Color(0x0a1a2a) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 color = mix(uBottomColor, uTopColor, h);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(100, 32, 32),
      gradientMaterial
    );
    envScene.add(envSphere);

    // Render the cube map
    const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
    cubeCamera.update(this.renderer, envScene);

    // Clean up temp scene
    envSphere.geometry.dispose();
    envSphere.material.dispose();

    return cubeRenderTarget.texture;
  }

  createBioluminescence() {
    // Scattered glowing points in the deep - more realistic distribution
    this.bioLights = [];
    const count = 30;

    for (let i = 0; i < count; i++) {
      // Bioluminescent colors - cyan, blue, green, occasional purple
      const hue = 0.45 + Math.random() * 0.25; // Cyan to blue-purple range
      const saturation = 0.7 + Math.random() * 0.3;
      const lightness = 0.4 + Math.random() * 0.2;

      const light = new THREE.PointLight(
        new THREE.Color().setHSL(hue, saturation, lightness),
        0,
        40,
        2
      );

      // Distribute in deep water with clustering
      const clusterX = (Math.random() - 0.5) * OCEAN_CONFIG.width * 0.8;
      const clusterZ = (Math.random() - 0.5) * OCEAN_CONFIG.width * 0.8;

      light.position.set(
        clusterX + (Math.random() - 0.5) * 30,
        -100 - Math.random() * 90, // Deep only (100-190m)
        clusterZ + (Math.random() - 0.5) * 30
      );

      // Store initial values for animation
      light.userData = {
        baseIntensity: Math.random() * 0.8 + 0.4,
        pulseSpeed: Math.random() * 1.5 + 0.5,
        pulseOffset: Math.random() * Math.PI * 2,
        flickerPhase: Math.random() * Math.PI * 2
      };

      this.bioLights.push(light);
      this.scene.add(light);

      // Add visible glow sphere with better material
      const glowGeometry = new THREE.SphereGeometry(0.3, 12, 12);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: light.color,
        transparent: true,
        opacity: 0
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(light.position);
      light.userData.glow = glow;
      this.scene.add(glow);

      // Add outer glow halo
      const haloGeometry = new THREE.SphereGeometry(1.5, 8, 8);
      const haloMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: light.color },
          uIntensity: { value: 0 }
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec3 vNormal;

          void main() {
            float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
            rim = pow(rim, 3.0);
            gl_FragColor = vec4(uColor, rim * uIntensity * 0.6);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.position.copy(light.position);
      light.userData.halo = halo;
      this.scene.add(halo);
    }
  }

  /**
   * Calculate light color at depth using Beer-Lambert absorption
   * @param {number} depth - Depth in meters (positive value)
   * @returns {THREE.Color} - Absorbed light color
   */
  calculateAbsorbedColor(depth) {
    const absDepth = Math.abs(depth);

    // Beer-Lambert law: I = I0 * e^(-α * d)
    const r = Math.exp(-this.absorptionCoefficients.red * absDepth);
    const g = Math.exp(-this.absorptionCoefficients.green * absDepth);
    const b = Math.exp(-this.absorptionCoefficients.blue * absDepth);

    return new THREE.Color(r, g, b);
  }

  update(deltaTime, cameraY, time) {
    // Guard against update being called before init completes
    if (!this.lights.ambient) return;

    const depth = Math.abs(cameraY);
    const lighting = getLightingForDepth(cameraY);

    // Calculate wavelength-absorbed light color
    const absorbedColor = this.calculateAbsorbedColor(depth);

    // Adjust ambient light based on depth and absorption
    this.lights.ambient.intensity = lighting.ambient * 0.4;
    this.lights.ambient.color.copy(absorbedColor).multiplyScalar(0.8);
    this.lights.ambient.color.offsetHSL(0.55, 0.3, 0); // Shift toward blue

    // Adjust sun intensity and color - fades and shifts blue with depth
    const sunIntensity = Math.max(0, 1 - depth * 0.006);
    this.lights.sun.intensity = sunIntensity * 1.2;
    this.lights.sun.color.setRGB(
      absorbedColor.r * 0.9 + 0.1,
      absorbedColor.g * 0.95 + 0.05,
      absorbedColor.b
    );

    // Adjust hemisphere light
    const hemiIntensity = Math.max(0.05, 0.3 - depth * 0.002);
    this.lights.hemi.intensity = hemiIntensity;
    // Sky color shifts to deeper blue with depth
    this.lights.hemi.color.setHSL(
      0.55 + depth * 0.0005, // Shift toward deeper blue
      0.6 - depth * 0.002,
      0.4 - depth * 0.001
    );

    // Fill light fades with depth
    this.lights.fill.intensity = Math.max(0, 0.15 - depth * 0.001);

    // Animate bioluminescence in deep water
    const bioActive = depth > 70;
    this.bioLights.forEach((light, index) => {
      const { baseIntensity, pulseSpeed, pulseOffset, flickerPhase, glow, halo } = light.userData;

      if (bioActive) {
        // Organic pulsing with occasional flicker
        const pulse = Math.sin(time * pulseSpeed + pulseOffset) * 0.4 + 0.6;
        const flicker = Math.sin(time * 15 + flickerPhase) > 0.95 ? 0.5 : 1.0;
        const depthFactor = Math.min(1, (depth - 70) / 40);

        const intensity = baseIntensity * pulse * flicker * depthFactor;
        light.intensity = intensity;

        if (glow) {
          glow.material.opacity = intensity * 0.9;
          // Subtle size pulsing
          const scale = 0.3 + pulse * 0.1;
          glow.scale.setScalar(scale);
        }

        if (halo) {
          halo.material.uniforms.uIntensity.value = intensity;
        }
      } else {
        light.intensity = 0;
        if (glow) glow.material.opacity = 0;
        if (halo) halo.material.uniforms.uIntensity.value = 0;
      }
    });

    // Update fog color based on depth - shifts from bright blue to deep navy
    const fogColor = new THREE.Color(lighting.fogColor);
    // Apply absorption to fog color
    fogColor.multiply(absorbedColor);
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = lighting.fog;
    this.scene.background.copy(fogColor);
  }

  // Set dramatic lighting for cinematic shots
  setCinematicLighting(preset) {
    switch (preset) {
      case 'surface':
        this.lights.sun.intensity = 1.5;
        this.lights.sun.color.setHex(0xfff8e0);
        this.lights.ambient.intensity = 0.5;
        break;
      case 'midwater':
        this.lights.sun.intensity = 0.5;
        this.lights.sun.color.setHex(0x88ccff);
        this.lights.ambient.intensity = 0.25;
        break;
      case 'abyss':
        this.lights.sun.intensity = 0;
        this.lights.ambient.intensity = 0.05;
        this.lights.ambient.color.setHex(0x0a1a2a);
        break;
      case 'dramatic':
        this.lights.sun.intensity = 2.0;
        this.lights.sun.color.setHex(0xffd700);
        this.lights.ambient.intensity = 0.2;
        break;
      case 'bioluminescent':
        this.lights.sun.intensity = 0;
        this.lights.ambient.intensity = 0.03;
        // Boost all bio lights
        this.bioLights.forEach(light => {
          light.intensity = light.userData.baseIntensity * 2;
        });
        break;
    }
  }

  getEnvironmentMap() {
    return this.envMap;
  }

  dispose() {
    Object.values(this.lights).forEach(light => {
      this.scene.remove(light);
    });

    this.bioLights.forEach(light => {
      if (light.userData.glow) {
        light.userData.glow.geometry.dispose();
        light.userData.glow.material.dispose();
        this.scene.remove(light.userData.glow);
      }
      if (light.userData.halo) {
        light.userData.halo.geometry.dispose();
        light.userData.halo.material.dispose();
        this.scene.remove(light.userData.halo);
      }
      this.scene.remove(light);
    });

    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
    }
    if (this.envMap) {
      this.envMap.dispose();
    }
  }
}
