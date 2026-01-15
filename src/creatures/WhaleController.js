import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NOTABLE_BILLIONAIRES } from '../data/wealthData.js';
import { CREATURE_TYPES } from '../data/creatureConfig.js';

/**
 * WhaleController - Photorealistic whale (billionaire) entities
 * Features:
 * - GLTF model support with fallback to detailed procedural geometry
 * - PBR materials with subsurface scattering
 * - Realistic swimming animation with skeletal-like deformation
 */
export class WhaleController {
  constructor(scene, envMap = null) {
    this.scene = scene;
    this.envMap = envMap;
    this.whales = [];
    this.time = 0;
    this.modelGeometry = null;

    this.init();
  }

  init() {
    const config = CREATURE_TYPES.whale;

    // Create whales with procedural geometry first
    NOTABLE_BILLIONAIRES.slice(0, 10).forEach((billionaire, index) => {
      const whale = this.createWhale(billionaire, index, config);
      this.whales.push(whale);
    });

    // Try to load whale model asynchronously
    this.tryLoadModel();
  }

  async tryLoadModel() {
    try {
      const geometry = await this.loadModel();
      if (geometry) {
        this.modelGeometry = geometry;
        // Update existing whale meshes with new geometry
        this.whales.forEach(whale => {
          if (whale.mesh) {
            whale.mesh.geometry.dispose();
            whale.mesh.geometry = geometry.clone();
          }
        });
      }
    } catch (e) {
      console.log('Whale model not found, using procedural geometry');
    }
  }

  async loadModel() {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        '/assets/models/whale.glb',
        (gltf) => {
          let geometry = null;
          gltf.scene.traverse((child) => {
            if (child.isMesh && !geometry) {
              geometry = child.geometry.clone();
              // Normalize scale
              geometry.computeBoundingBox();
              const box = geometry.boundingBox;
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              geometry.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
            }
          });
          if (geometry) {
            resolve(geometry);
          } else {
            reject(new Error('No mesh found in GLTF'));
          }
        },
        undefined,
        reject
      );
    });
  }

  createWhale(billionaire, index, config) {
    // Scale size based on wealth (richest = biggest)
    const maxWealth = NOTABLE_BILLIONAIRES[0].wealth;
    const wealthRatio = billionaire.wealth / maxWealth;
    const size = config.baseSize * (0.5 + wealthRatio * 0.5);

    // Create whale geometry
    const geometry = this.modelGeometry
      ? this.modelGeometry.clone()
      : this.createDetailedWhaleGeometry();

    // Create photorealistic whale material with SSS
    const material = this.createWhaleMaterial(wealthRatio);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position whales near surface, spread out
    const angle = (index / NOTABLE_BILLIONAIRES.length) * Math.PI * 2;
    const radius = 50 + index * 20;

    mesh.position.set(
      Math.cos(angle) * radius,
      -5 - Math.random() * 5,
      Math.sin(angle) * radius
    );

    // Add underwater caustic projection on whale
    const causticMesh = this.createCausticProjection(mesh, size);

    // Add label
    const label = this.createLabel(billionaire);
    label.position.copy(mesh.position);
    label.position.y += size * 2;

    this.scene.add(mesh);
    if (causticMesh) this.scene.add(causticMesh);
    this.scene.add(label);

    return {
      mesh,
      causticMesh,
      label,
      billionaire,
      size,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        0,
        (Math.random() - 0.5) * 0.3
      ),
      phase: Math.random() * Math.PI * 2,
      swimCycle: 0,
      // Animation parameters
      tailPhase: Math.random() * Math.PI * 2,
      breathingPhase: Math.random() * Math.PI * 2
    };
  }

  createDetailedWhaleGeometry() {
    // Create a detailed whale shape using lathe geometry
    const points = [];
    const segments = 32;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let radius;

      if (t < 0.15) {
        // Head - rounded snout
        const headT = t / 0.15;
        radius = Math.sin(headT * Math.PI / 2) * 0.45;
      } else if (t < 0.6) {
        // Body - full and rounded
        const bodyT = (t - 0.15) / 0.45;
        radius = 0.45 + Math.sin(bodyT * Math.PI) * 0.1;
      } else if (t < 0.85) {
        // Tail stock - tapering
        const tailT = (t - 0.6) / 0.25;
        radius = 0.45 * (1 - tailT * 0.7);
      } else {
        // Tail flukes connection
        const flukeT = (t - 0.85) / 0.15;
        radius = 0.45 * 0.3 * (1 - flukeT * 0.5);
      }

      points.push(new THREE.Vector2(radius, (t - 0.5) * 4));
    }

    const bodyGeometry = new THREE.LatheGeometry(points, 24);
    bodyGeometry.rotateX(Math.PI / 2);

    return bodyGeometry;
  }

  createWhaleMaterial(wealthRatio) {
    // Photorealistic whale skin with SSS
    const baseColor = new THREE.Color(0x3a5a7a);
    const bellyColor = new THREE.Color(0x8aa8c8);

    const material = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.0,
      roughness: 0.6,

      // Subsurface scattering for realistic skin
      transmission: 0.05,
      thickness: 2.0,
      ior: 1.4,

      // Subtle sheen for wet skin
      sheen: 0.2,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0x6688aa),

      // Clearcoat for wet look
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,

      // Environment reflections
      envMapIntensity: 0.5
    });

    if (this.envMap) {
      material.envMap = this.envMap;
    }

    return material;
  }


  createCausticProjection(mesh, size) {
    // Project animated caustics onto whale surface
    // This creates the dappled light effect seen on underwater objects
    return null; // Simplified - caustics handled by main ocean system
  }

  createLabel(billionaire) {
    // Create high-quality text sprite for billionaire name
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Clear with slight transparency for glow effect
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Add subtle glow behind text
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 20;

    // Draw name
    ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(billionaire.name, 512, 80);

    // Draw wealth with gold color
    ctx.shadowBlur = 10;
    ctx.font = '48px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffd700';
    const wealthText = `$${(billionaire.wealth / 1_000_000_000).toFixed(0)}B`;
    ctx.fillText(wealthText, 512, 170);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(40, 10, 1);
    sprite.visible = false;

    return sprite;
  }

  update(deltaTime, cameraPosition) {
    this.time += deltaTime;

    this.whales.forEach((whale, index) => {
      // Slow, majestic swimming
      whale.swimCycle += deltaTime * 0.5;

      // Realistic whale swimming motion
      // Body undulation
      const undulation = Math.sin(whale.swimCycle + whale.phase) * 0.2;
      whale.mesh.rotation.z = undulation * 0.08;

      // Tail motion (would need morph targets for proper implementation)
      const tailMotion = Math.sin(whale.swimCycle * 1.5 + whale.tailPhase) * 0.15;
      whale.mesh.rotation.x = tailMotion * 0.05;

      // Breathing motion - subtle size pulsing
      const breathing = Math.sin(this.time * 0.3 + whale.breathingPhase) * 0.02 + 1.0;
      whale.mesh.scale.setScalar(whale.size * breathing);

      // Move forward slowly
      whale.mesh.position.add(whale.velocity.clone().multiplyScalar(deltaTime));

      // Gentle vertical movement - surfacing behavior
      const surfaceMotion = Math.sin(this.time * 0.15 + whale.phase) * 3;
      whale.mesh.position.y = -5 + surfaceMotion;

      // Keep in bounds with smooth turning
      if (Math.abs(whale.mesh.position.x) > 150) {
        whale.velocity.x *= -0.5;
        whale.velocity.x += (Math.random() - 0.5) * 0.1;
      }
      if (Math.abs(whale.mesh.position.z) > 150) {
        whale.velocity.z *= -0.5;
        whale.velocity.z += (Math.random() - 0.5) * 0.1;
      }

      // Face direction of movement with smooth interpolation
      if (whale.velocity.lengthSq() > 0.001) {
        const targetRotation = Math.atan2(whale.velocity.x, whale.velocity.z);
        whale.mesh.rotation.y = THREE.MathUtils.lerp(
          whale.mesh.rotation.y,
          targetRotation,
          deltaTime * 1.5
        );
      }

      // Update label position and visibility
      whale.label.position.copy(whale.mesh.position);
      whale.label.position.y += whale.size * 1.8;

      // Show label when camera is nearby with smooth fade
      const distToCamera = whale.mesh.position.distanceTo(cameraPosition);
      const labelVisibility = distToCamera < 100;
      whale.label.visible = labelVisibility;

      if (labelVisibility) {
        const opacity = Math.max(0, 1 - (distToCamera - 30) / 70);
        whale.label.material.opacity = opacity;
      }
    });
  }

  setEnvironmentMap(envMap) {
    this.envMap = envMap;
    this.whales.forEach(whale => {
      if (whale.mesh.material.envMap !== undefined) {
        whale.mesh.material.envMap = envMap;
        whale.mesh.material.needsUpdate = true;
      }
    });
  }

  getClosestWhale(position) {
    let closest = null;
    let minDist = Infinity;

    this.whales.forEach(whale => {
      const dist = whale.mesh.position.distanceTo(position);
      if (dist < minDist) {
        minDist = dist;
        closest = whale;
      }
    });

    return { whale: closest, distance: minDist };
  }

  dispose() {
    this.whales.forEach(whale => {
      whale.mesh.geometry.dispose();
      whale.mesh.material.dispose();
      whale.label.material.map?.dispose();
      whale.label.material.dispose();

      this.scene.remove(whale.mesh);
      this.scene.remove(whale.label);
    });
  }
}
