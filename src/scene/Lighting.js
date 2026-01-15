import * as THREE from 'three';
import { OCEAN_CONFIG, getLightingForDepth } from '../data/creatureConfig.js';

/**
 * Underwater Lighting System
 * Creates realistic underwater lighting with depth-based changes
 */
export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.lights = {};

    this.init();
  }

  init() {
    // Ambient light - base illumination (brighter for better creature visibility)
    this.lights.ambient = new THREE.AmbientLight(0x6699cc, 0.7);
    this.scene.add(this.lights.ambient);

    // Directional light - sun through water
    this.lights.sun = new THREE.DirectionalLight(0xffffff, 0.8);
    this.lights.sun.position.set(50, 100, 30);
    this.lights.sun.castShadow = true;
    this.lights.sun.shadow.mapSize.width = 2048;
    this.lights.sun.shadow.mapSize.height = 2048;
    this.lights.sun.shadow.camera.near = 0.5;
    this.lights.sun.shadow.camera.far = 500;
    this.lights.sun.shadow.camera.left = -200;
    this.lights.sun.shadow.camera.right = 200;
    this.lights.sun.shadow.camera.top = 200;
    this.lights.sun.shadow.camera.bottom = -200;
    this.scene.add(this.lights.sun);

    // Hemisphere light - sky/ground color blend
    this.lights.hemi = new THREE.HemisphereLight(
      0x88ccff, // Sky color (blue)
      0x0a1628, // Ground color (deep ocean)
      0.5
    );
    this.scene.add(this.lights.hemi);

    // Point lights for bioluminescence effect at depth
    this.createBioluminescence();

    // Setup fog
    this.scene.fog = new THREE.FogExp2(0x0d3b66, 0.003);
    this.scene.background = new THREE.Color(0x0d3b66);
  }

  createBioluminescence() {
    // Scattered glowing points in the deep
    this.bioLights = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(
        new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.8, 0.5),
        0,
        30,
        2
      );

      light.position.set(
        (Math.random() - 0.5) * OCEAN_CONFIG.width,
        -100 - Math.random() * 100, // Deep only
        (Math.random() - 0.5) * OCEAN_CONFIG.width
      );

      // Store initial values for animation
      light.userData = {
        baseIntensity: Math.random() * 0.5 + 0.3,
        pulseSpeed: Math.random() * 2 + 1,
        pulseOffset: Math.random() * Math.PI * 2
      };

      this.bioLights.push(light);
      this.scene.add(light);

      // Add visible glow sphere
      const glowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: light.color,
        transparent: true,
        opacity: 0
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(light.position);
      light.userData.glow = glow;
      this.scene.add(glow);
    }
  }

  update(deltaTime, cameraY, time) {
    const depth = Math.abs(cameraY);
    const lighting = getLightingForDepth(cameraY);

    // Adjust ambient light based on depth
    this.lights.ambient.intensity = lighting.ambient * 0.5;

    // Adjust sun intensity - fades with depth
    const sunIntensity = Math.max(0, 1 - depth * 0.008);
    this.lights.sun.intensity = sunIntensity * 0.8;

    // Adjust hemisphere light
    this.lights.hemi.intensity = Math.max(0.1, 0.5 - depth * 0.003);

    // Animate bioluminescence in deep water
    const bioActive = depth > 80;
    this.bioLights.forEach(light => {
      const { baseIntensity, pulseSpeed, pulseOffset, glow } = light.userData;

      if (bioActive) {
        const pulse = Math.sin(time * pulseSpeed + pulseOffset) * 0.5 + 0.5;
        const depthFactor = Math.min(1, (depth - 80) / 50);
        light.intensity = baseIntensity * pulse * depthFactor;
        glow.material.opacity = light.intensity * 0.8;
      } else {
        light.intensity = 0;
        glow.material.opacity = 0;
      }
    });
  }

  // Set dramatic lighting for cinematic shots
  setCinematicLighting(preset) {
    switch (preset) {
      case 'surface':
        this.lights.sun.intensity = 1.2;
        this.lights.ambient.intensity = 0.6;
        break;
      case 'midwater':
        this.lights.sun.intensity = 0.4;
        this.lights.ambient.intensity = 0.3;
        break;
      case 'abyss':
        this.lights.sun.intensity = 0;
        this.lights.ambient.intensity = 0.1;
        break;
      case 'dramatic':
        this.lights.sun.intensity = 1.5;
        this.lights.sun.color.setHex(0xffd700);
        break;
    }
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
      this.scene.remove(light);
    });
  }
}
