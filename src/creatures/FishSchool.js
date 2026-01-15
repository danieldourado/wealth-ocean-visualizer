import * as THREE from 'three';
import { CREATURE_TYPES, SWIM_PATTERNS } from '../data/creatureConfig.js';

/**
 * FishSchool - Instanced mesh for rendering thousands of fish efficiently
 * Uses GPU instancing for performance with realistic schooling behavior
 */
export class FishSchool {
  constructor(scene, creatureType, bracket) {
    this.scene = scene;
    this.config = CREATURE_TYPES[creatureType];
    this.bracket = bracket;
    this.pattern = SWIM_PATTERNS[this.config.swimPattern];

    this.time = 0;
    this.fishes = [];

    this.init();
  }

  init() {
    const count = this.config.schoolSize;

    // Create geometry based on creature type
    const geometry = this.createGeometry();

    // Create material
    const material = this.createMaterial();

    // Create instanced mesh
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Initialize fish positions and velocities
    this.initializeFish(count);

    this.scene.add(this.mesh);
  }

  createGeometry() {
    const type = this.config.modelType;

    switch (type) {
      case 'simple':
        // Krill/plankton - simple ellipsoid
        return new THREE.SphereGeometry(1, 4, 4);

      case 'fish':
        // Fish body - elongated shape
        return this.createFishGeometry();

      case 'shark':
        // Shark - more angular
        return this.createSharkGeometry();

      case 'whale':
        // Whale - massive curved body
        return this.createWhaleGeometry();

      default:
        return new THREE.SphereGeometry(1, 8, 8);
    }
  }

  createFishGeometry() {
    // Custom fish shape using buffer geometry
    const shape = new THREE.Shape();

    // Fish body profile
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.3, 0.15, 0.5, 0.1);
    shape.quadraticCurveTo(0.8, 0.05, 1, 0);
    shape.quadraticCurveTo(0.8, -0.05, 0.5, -0.1);
    shape.quadraticCurveTo(0.3, -0.15, 0, 0);

    const extrudeSettings = {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    geometry.rotateY(Math.PI / 2);

    // Add tail
    const tailGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
    tailGeometry.translate(-0.6, 0, 0);
    tailGeometry.rotateZ(Math.PI / 2);

    // Merge geometries
    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.copy(geometry);

    return geometry;
  }

  createSharkGeometry() {
    // Shark shape - more predatory
    const geometry = new THREE.ConeGeometry(0.3, 2, 6);
    geometry.rotateZ(-Math.PI / 2);

    // Add dorsal fin
    const finGeometry = new THREE.ConeGeometry(0.15, 0.5, 3);
    finGeometry.rotateX(-Math.PI / 2);
    finGeometry.translate(0, 0.3, 0);

    return geometry;
  }

  createWhaleGeometry() {
    // Whale - massive rounded body
    const geometry = new THREE.CapsuleGeometry(0.5, 2, 8, 16);
    geometry.rotateZ(Math.PI / 2);

    return geometry;
  }

  createMaterial() {
    // Custom shader material for underwater look - brighter to be visible
    return new THREE.MeshStandardMaterial({
      color: this.config.color,
      emissive: this.config.color,
      emissiveIntensity: 0.4,
      metalness: 0.2,
      roughness: 0.5,
      transparent: this.config.opacity < 1,
      opacity: this.config.opacity,
      envMapIntensity: 0.8
    });
  }

  initializeFish(count) {
    const dummy = new THREE.Object3D();
    const depthRange = this.bracket.depth;
    const radius = this.config.schoolRadius;

    for (let i = 0; i < count; i++) {
      // Random position within bracket's depth range
      const depth = -(depthRange.min + Math.random() * (depthRange.max - depthRange.min));
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;

      const fish = {
        position: new THREE.Vector3(
          Math.cos(angle) * r + (Math.random() - 0.5) * 200,
          depth,
          Math.sin(angle) * r + (Math.random() - 0.5) * 200
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * this.config.speed,
          (Math.random() - 0.5) * this.config.speed * 0.2,
          (Math.random() - 0.5) * this.config.speed
        ),
        scale: this.config.baseSize + (Math.random() - 0.5) * this.config.sizeVariation * 2,
        phase: Math.random() * Math.PI * 2
      };

      this.fishes.push(fish);

      // Set initial transform
      dummy.position.copy(fish.position);
      dummy.scale.setScalar(fish.scale);
      dummy.lookAt(fish.position.clone().add(fish.velocity));
      dummy.updateMatrix();

      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(deltaTime, cameraPosition) {
    this.time += deltaTime;
    const dummy = new THREE.Object3D();
    const tempVec = new THREE.Vector3();

    for (let i = 0; i < this.fishes.length; i++) {
      const fish = this.fishes[i];

      // Apply swimming behavior based on pattern
      this.applySwimmingBehavior(fish, i, cameraPosition);

      // Update position
      fish.position.add(fish.velocity.clone().multiplyScalar(deltaTime));

      // Keep within depth bounds
      const depthRange = this.bracket.depth;
      if (fish.position.y > -depthRange.min) {
        fish.velocity.y -= 0.01;
      }
      if (fish.position.y < -depthRange.max) {
        fish.velocity.y += 0.01;
      }

      // Wrap around horizontally
      if (Math.abs(fish.position.x) > 250) fish.position.x *= -0.9;
      if (Math.abs(fish.position.z) > 250) fish.position.z *= -0.9;

      // Swimming animation - body wiggle
      const wiggle = Math.sin(this.time * 8 + fish.phase) * 0.1;

      // Update matrix
      dummy.position.copy(fish.position);
      dummy.scale.setScalar(fish.scale);

      // Look in direction of movement
      if (fish.velocity.lengthSq() > 0.0001) {
        tempVec.copy(fish.position).add(fish.velocity);
        dummy.lookAt(tempVec);
        dummy.rotateY(wiggle);
      }

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  applySwimmingBehavior(fish, index, cameraPosition) {
    const pattern = this.pattern;
    const neighbors = this.getNeighbors(fish, index, 10);

    // Cohesion - move toward center of neighbors
    if (neighbors.length > 0 && pattern.cohesion > 0) {
      const center = new THREE.Vector3();
      neighbors.forEach(n => center.add(n.position));
      center.divideScalar(neighbors.length);

      const cohesionForce = center.sub(fish.position).normalize().multiplyScalar(pattern.cohesion * 0.01);
      fish.velocity.add(cohesionForce);
    }

    // Separation - avoid crowding
    if (neighbors.length > 0 && pattern.separation > 0) {
      const separation = new THREE.Vector3();
      neighbors.forEach(n => {
        const diff = fish.position.clone().sub(n.position);
        const dist = diff.length();
        if (dist > 0 && dist < this.config.baseSize * 5) {
          separation.add(diff.normalize().divideScalar(dist));
        }
      });

      const separationForce = separation.normalize().multiplyScalar(pattern.separation * 0.02);
      fish.velocity.add(separationForce);
    }

    // Alignment - match velocity of neighbors
    if (neighbors.length > 0 && pattern.alignment > 0) {
      const avgVelocity = new THREE.Vector3();
      neighbors.forEach(n => avgVelocity.add(n.velocity));
      avgVelocity.divideScalar(neighbors.length);

      const alignmentForce = avgVelocity.sub(fish.velocity).multiplyScalar(pattern.alignment * 0.05);
      fish.velocity.add(alignmentForce);
    }

    // Random noise
    if (pattern.noise > 0) {
      fish.velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * pattern.noise * 0.01,
        (Math.random() - 0.5) * pattern.noise * 0.005 * pattern.verticalBias,
        (Math.random() - 0.5) * pattern.noise * 0.01
      ));
    }

    // Avoid camera (flee behavior)
    const distToCamera = fish.position.distanceTo(cameraPosition);
    if (distToCamera < 20) {
      const flee = fish.position.clone().sub(cameraPosition).normalize().multiplyScalar(0.05);
      fish.velocity.add(flee);
    }

    // Limit speed
    const maxSpeed = this.config.speed;
    if (fish.velocity.length() > maxSpeed) {
      fish.velocity.normalize().multiplyScalar(maxSpeed);
    }
  }

  getNeighbors(fish, index, count) {
    // Get nearby fish (simple sampling for performance)
    const neighbors = [];
    const searchRadius = this.config.schoolRadius * 0.3;

    for (let i = 0; i < Math.min(count, this.fishes.length); i++) {
      const checkIndex = (index + i * 7) % this.fishes.length; // Pseudo-random sampling
      if (checkIndex === index) continue;

      const other = this.fishes[checkIndex];
      const dist = fish.position.distanceTo(other.position);

      if (dist < searchRadius) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  setVisibility(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
