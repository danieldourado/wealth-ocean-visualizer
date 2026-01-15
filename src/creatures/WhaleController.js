import * as THREE from 'three';
import { NOTABLE_BILLIONAIRES } from '../data/wealthData.js';
import { CREATURE_TYPES } from '../data/creatureConfig.js';

/**
 * WhaleController - Manages individual whale (billionaire) entities
 * Each whale represents a top billionaire with size based on their net worth
 */
export class WhaleController {
  constructor(scene) {
    this.scene = scene;
    this.whales = [];
    this.time = 0;

    this.init();
  }

  init() {
    const config = CREATURE_TYPES.whale;

    // Create a whale for each notable billionaire
    NOTABLE_BILLIONAIRES.slice(0, 10).forEach((billionaire, index) => {
      const whale = this.createWhale(billionaire, index, config);
      this.whales.push(whale);
    });
  }

  createWhale(billionaire, index, config) {
    // Scale size based on wealth (richest = biggest)
    const maxWealth = NOTABLE_BILLIONAIRES[0].wealth;
    const wealthRatio = billionaire.wealth / maxWealth;
    const size = config.baseSize * (0.5 + wealthRatio * 0.5);

    // Create whale geometry
    const geometry = this.createWhaleGeometry();

    // Create glowing material for billionaires - bright blue with golden glow
    const material = new THREE.MeshStandardMaterial({
      color: 0x5588bb,
      emissive: 0xffaa44,
      emissiveIntensity: 0.6 + wealthRatio * 0.6,
      metalness: 0.2,
      roughness: 0.3
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position whales near surface, spread out
    const angle = (index / NOTABLE_BILLIONAIRES.length) * Math.PI * 2;
    const radius = 50 + index * 20;

    mesh.position.set(
      Math.cos(angle) * radius,
      -5 - Math.random() * 5, // Near surface
      Math.sin(angle) * radius
    );

    // Add glow effect
    const glowMesh = this.createGlowEffect(mesh, wealthRatio);

    // Add label
    const label = this.createLabel(billionaire);
    label.position.copy(mesh.position);
    label.position.y += size * 2;

    this.scene.add(mesh);
    this.scene.add(glowMesh);
    this.scene.add(label);

    return {
      mesh,
      glowMesh,
      label,
      billionaire,
      size,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        0,
        (Math.random() - 0.5) * 0.3
      ),
      phase: Math.random() * Math.PI * 2,
      swimCycle: 0
    };
  }

  createWhaleGeometry() {
    // Create a whale shape
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.5, 12, 24);
    bodyGeometry.rotateZ(Math.PI / 2);

    // Create tail flukes
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(-0.3, 0.4, -0.6, 0.3);
    tailShape.quadraticCurveTo(-0.4, 0, -0.6, -0.3);
    tailShape.quadraticCurveTo(-0.3, -0.4, 0, 0);

    const tailGeometry = new THREE.ShapeGeometry(tailShape);
    tailGeometry.translate(-1.2, 0, 0);

    // Create dorsal fin
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(-0.1, 0.3);
    finShape.quadraticCurveTo(0.1, 0.25, 0.2, 0);
    finShape.lineTo(0, 0);

    const finGeometry = new THREE.ShapeGeometry(finShape);
    finGeometry.rotateX(-Math.PI / 2);
    finGeometry.translate(0.2, 0.35, 0);

    return bodyGeometry;
  }

  createGlowEffect(mesh, intensity) {
    // Create outer glow
    const glowGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffd700) },
        uIntensity: { value: intensity }
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
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(uColor, intensity * uIntensity * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });

    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.copy(mesh.scale).multiplyScalar(1.2);
    glowMesh.position.copy(mesh.position);

    return glowMesh;
  }

  createLabel(billionaire) {
    // Create text sprite for billionaire name
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.font = 'bold 36px Orbitron, Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Name
    ctx.fillText(billionaire.name, 256, 40);

    // Wealth
    ctx.font = '28px Orbitron, Arial';
    ctx.fillStyle = '#ffd700';
    const wealthText = `$${(billionaire.wealth / 1_000_000_000).toFixed(0)}B`;
    ctx.fillText(wealthText, 256, 85);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(30, 7.5, 1);
    sprite.visible = false; // Hidden by default, shown on hover/nearby

    return sprite;
  }

  update(deltaTime, cameraPosition) {
    this.time += deltaTime;

    this.whales.forEach((whale, index) => {
      // Slow, majestic swimming
      whale.swimCycle += deltaTime * 0.5;

      // Gentle undulation
      const undulation = Math.sin(whale.swimCycle + whale.phase) * 0.3;
      whale.mesh.rotation.z = undulation * 0.1;
      whale.mesh.rotation.x = undulation * 0.05;

      // Move forward slowly
      whale.mesh.position.add(whale.velocity.clone().multiplyScalar(deltaTime));

      // Gentle vertical movement
      whale.mesh.position.y = -5 + Math.sin(this.time * 0.2 + whale.phase) * 2;

      // Keep in bounds with smooth turning
      if (Math.abs(whale.mesh.position.x) > 150) {
        whale.velocity.x *= -0.5;
      }
      if (Math.abs(whale.mesh.position.z) > 150) {
        whale.velocity.z *= -0.5;
      }

      // Face direction of movement
      if (whale.velocity.lengthSq() > 0.001) {
        const targetRotation = Math.atan2(whale.velocity.x, whale.velocity.z);
        whale.mesh.rotation.y = THREE.MathUtils.lerp(
          whale.mesh.rotation.y,
          targetRotation,
          deltaTime * 2
        );
      }

      // Update glow position
      whale.glowMesh.position.copy(whale.mesh.position);
      whale.glowMesh.rotation.copy(whale.mesh.rotation);

      // Update label position and visibility
      whale.label.position.copy(whale.mesh.position);
      whale.label.position.y += whale.size * 1.5;

      // Show label when camera is nearby
      const distToCamera = whale.mesh.position.distanceTo(cameraPosition);
      whale.label.visible = distToCamera < 80;
      whale.label.material.opacity = Math.max(0, 1 - distToCamera / 80);

      // Pulse glow
      const pulse = Math.sin(this.time * 2 + index) * 0.1 + 0.9;
      whale.glowMesh.material.uniforms.uIntensity.value =
        (whale.billionaire.wealth / NOTABLE_BILLIONAIRES[0].wealth) * pulse;
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
      whale.glowMesh.geometry.dispose();
      whale.glowMesh.material.dispose();
      whale.label.material.map?.dispose();
      whale.label.material.dispose();

      this.scene.remove(whale.mesh);
      this.scene.remove(whale.glowMesh);
      this.scene.remove(whale.label);
    });
  }
}
