import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CREATURE_TYPES, SWIM_PATTERNS } from '../data/creatureConfig.js';

/**
 * FishSchool - Photorealistic fish rendering with instanced meshes
 * Features:
 * - GLTF model support with fallback to procedural geometry
 * - PBR materials with subsurface scattering simulation
 * - Iridescent scales shader
 * - Realistic schooling behavior
 */
export class FishSchool {
  constructor(scene, creatureType, bracket, envMap = null) {
    this.scene = scene;
    this.config = CREATURE_TYPES[creatureType];
    this.bracket = bracket;
    this.pattern = SWIM_PATTERNS[this.config.swimPattern];
    this.envMap = envMap;
    this.creatureType = creatureType;

    this.time = 0;
    this.fishes = [];
    this.modelLoaded = false;
    this.mesh = null;

    this.init();
  }

  init() {
    const count = this.config.schoolSize;

    // Use procedural geometry (GLTF loading can be added later)
    const geometry = this.createGeometry();

    // Create PBR material with SSS simulation
    const material = this.createPBRMaterial();

    // Create instanced mesh
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // Prevent popping

    // Initialize fish positions and velocities
    this.initializeFish(count);

    this.scene.add(this.mesh);

    // Try to load GLTF model asynchronously (will replace geometry if successful)
    this.tryLoadModel();
  }

  async tryLoadModel() {
    try {
      const geometry = await this.loadModel();
      if (this.mesh && geometry) {
        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
        this.modelLoaded = true;
      }
    } catch (e) {
      // Keep using procedural geometry
    }
  }

  async loadModel() {
    const loader = new GLTFLoader();
    const modelPath = this.getModelPath();

    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => {
          // Extract geometry from loaded model
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

  getModelPath() {
    const modelMap = {
      krill: '/assets/models/krill.glb',
      anchovy: '/assets/models/fish_small.glb',
      mackerel: '/assets/models/fish_medium.glb',
      tuna: '/assets/models/fish_large.glb',
      shark: '/assets/models/shark.glb'
    };
    return modelMap[this.creatureType] || '/assets/models/fish_generic.glb';
  }

  createGeometry() {
    const type = this.config.modelType;

    switch (type) {
      case 'simple':
        return this.createKrillGeometry();
      case 'fish':
        return this.createRealisticFishGeometry();
      case 'shark':
        return this.createSharkGeometry();
      case 'whale':
        return this.createWhaleGeometry();
      default:
        return new THREE.SphereGeometry(1, 12, 12);
    }
  }

  createKrillGeometry() {
    // Detailed krill shape
    const geometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }

  createRealisticFishGeometry() {
    // More detailed fish body using lathe geometry
    const points = [];
    const segments = 20;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Fish profile - tapered at both ends, fuller in middle
      let radius;
      if (t < 0.3) {
        // Head - tapers to point
        radius = Math.sin(t / 0.3 * Math.PI / 2) * 0.15;
      } else if (t < 0.7) {
        // Body - full
        const bodyT = (t - 0.3) / 0.4;
        radius = 0.15 + Math.sin(bodyT * Math.PI) * 0.08;
      } else {
        // Tail - tapers
        const tailT = (t - 0.7) / 0.3;
        radius = 0.15 * (1 - tailT * 0.8);
      }
      points.push(new THREE.Vector2(radius, (t - 0.5) * 2));
    }

    const bodyGeometry = new THREE.LatheGeometry(points, 12);
    bodyGeometry.rotateX(Math.PI / 2);

    // Add fins using buffer geometry merging
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.quadraticCurveTo(0.1, 0.15, 0.05, 0.3);
    finShape.quadraticCurveTo(-0.05, 0.15, 0, 0);

    const dorsalFin = new THREE.ShapeGeometry(finShape);
    dorsalFin.rotateX(-Math.PI / 2);
    dorsalFin.translate(0, 0.2, -0.1);

    // Tail fin
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(-0.15, 0.2, -0.1, 0.35);
    tailShape.lineTo(0, 0.25);
    tailShape.lineTo(0.1, 0.35);
    tailShape.quadraticCurveTo(0.15, 0.2, 0, 0);

    const tailFin = new THREE.ShapeGeometry(tailShape);
    tailFin.rotateY(Math.PI / 2);
    tailFin.translate(-1, 0, 0);

    return bodyGeometry;
  }

  createSharkGeometry() {
    // Streamlined shark body
    const points = [];
    const segments = 24;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let radius;
      if (t < 0.2) {
        // Snout
        radius = Math.pow(t / 0.2, 0.7) * 0.2;
      } else if (t < 0.6) {
        // Body
        const bodyT = (t - 0.2) / 0.4;
        radius = 0.2 + Math.sin(bodyT * Math.PI) * 0.1;
      } else {
        // Tail
        const tailT = (t - 0.6) / 0.4;
        radius = 0.2 * Math.pow(1 - tailT, 0.5);
      }
      points.push(new THREE.Vector2(radius, (t - 0.5) * 3));
    }

    const geometry = new THREE.LatheGeometry(points, 16);
    geometry.rotateX(Math.PI / 2);

    return geometry;
  }

  createWhaleGeometry() {
    // Massive whale body
    const geometry = new THREE.CapsuleGeometry(0.5, 2.5, 12, 24);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }

  createPBRMaterial() {
    // Photorealistic fish material with SSS and iridescence
    const baseColor = new THREE.Color(this.config.color);

    // Use MeshPhysicalMaterial for advanced PBR features
    const material = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.1,
      roughness: 0.35,

      // Subsurface scattering simulation via transmission
      transmission: this.config.modelType === 'simple' ? 0.3 : 0.15,
      thickness: 0.5,

      // Index of refraction (fish scales ~1.35-1.4)
      ior: 1.38,

      // Iridescence for scale shimmer
      iridescence: this.config.modelType === 'fish' ? 0.6 : 0.2,
      iridescenceIOR: 1.5,
      iridescenceThicknessRange: [100, 400],

      // Sheen for soft highlight
      sheen: 0.3,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xaaccff),

      // Clearcoat for wet look
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,

      // Environment map for reflections
      envMapIntensity: 0.8,

      transparent: this.config.opacity < 1,
      opacity: this.config.opacity
    });

    // Set environment map if available
    if (this.envMap) {
      material.envMap = this.envMap;
    }

    return material;
  }

  // Create custom iridescent shader material (alternative to MeshPhysicalMaterial)
  createIridescentMaterial() {
    const baseColor = new THREE.Color(this.config.color);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: baseColor },
        uIridescenceStrength: { value: 0.6 },
        uEnvMap: { value: this.envMap },
        uRoughness: { value: 0.3 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform float uIridescenceStrength;
        uniform float uRoughness;

        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;

        // Thin-film interference for iridescence
        vec3 thinFilmInterference(float cosTheta, float thickness) {
          float delta = thickness * cosTheta;

          // Wavelength-dependent phase shift
          vec3 wavelengths = vec3(650.0, 510.0, 475.0); // RGB wavelengths in nm
          vec3 phase = 2.0 * 3.14159 * 2.0 * delta / wavelengths;

          // Interference pattern
          vec3 interference = 0.5 + 0.5 * cos(phase);

          return interference;
        }

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          float NdotV = max(dot(normal, viewDir), 0.0);

          // Fresnel
          float fresnel = pow(1.0 - NdotV, 4.0);

          // Iridescence
          float thickness = 400.0 + sin(vUv.x * 50.0 + vUv.y * 30.0) * 100.0;
          vec3 iridescence = thinFilmInterference(NdotV, thickness);

          // Combine base color with iridescence
          vec3 color = mix(uBaseColor, iridescence, uIridescenceStrength * fresnel);

          // Add specular highlight
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
          vec3 halfVec = normalize(lightDir + viewDir);
          float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);
          color += vec3(1.0) * spec * 0.5;

          // Subsurface scattering approximation
          float sss = pow(max(dot(-lightDir, viewDir), 0.0), 2.0) * 0.3;
          color += uBaseColor * sss;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide
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
        phase: Math.random() * Math.PI * 2,
        swimFrequency: 6 + Math.random() * 4 // Individual swim speed variation
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
    if (!this.mesh) return;

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

      // Realistic swimming animation - S-curve body motion
      const swimPhase = this.time * fish.swimFrequency + fish.phase;
      const bodyWiggle = Math.sin(swimPhase) * 0.08;
      const tailWiggle = Math.sin(swimPhase * 1.5) * 0.12;

      // Update matrix
      dummy.position.copy(fish.position);
      dummy.scale.setScalar(fish.scale);

      // Look in direction of movement with swimming motion
      if (fish.velocity.lengthSq() > 0.0001) {
        tempVec.copy(fish.position).add(fish.velocity);
        dummy.lookAt(tempVec);
        dummy.rotateY(bodyWiggle);
        dummy.rotateX(tailWiggle * 0.3);
      }

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;

    // Update material time uniform if using custom shader
    if (this.mesh.material.uniforms?.uTime) {
      this.mesh.material.uniforms.uTime.value = this.time;
    }
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

    // Random noise for natural movement
    if (pattern.noise > 0) {
      fish.velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * pattern.noise * 0.01,
        (Math.random() - 0.5) * pattern.noise * 0.005 * pattern.verticalBias,
        (Math.random() - 0.5) * pattern.noise * 0.01
      ));
    }

    // Avoid camera (flee behavior) - more gradual
    const distToCamera = fish.position.distanceTo(cameraPosition);
    if (distToCamera < 25) {
      const fleeStrength = 1 - (distToCamera / 25);
      const flee = fish.position.clone().sub(cameraPosition).normalize().multiplyScalar(0.03 * fleeStrength);
      fish.velocity.add(flee);
    }

    // Limit speed
    const maxSpeed = this.config.speed;
    if (fish.velocity.length() > maxSpeed) {
      fish.velocity.normalize().multiplyScalar(maxSpeed);
    }

    // Minimum speed to prevent stopping
    const minSpeed = maxSpeed * 0.3;
    if (fish.velocity.length() < minSpeed) {
      fish.velocity.normalize().multiplyScalar(minSpeed);
    }
  }

  getNeighbors(fish, index, count) {
    const neighbors = [];
    const searchRadius = this.config.schoolRadius * 0.3;

    for (let i = 0; i < Math.min(count, this.fishes.length); i++) {
      const checkIndex = (index + i * 7) % this.fishes.length;
      if (checkIndex === index) continue;

      const other = this.fishes[checkIndex];
      const dist = fish.position.distanceTo(other.position);

      if (dist < searchRadius) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  setEnvironmentMap(envMap) {
    this.envMap = envMap;
    if (this.mesh && this.mesh.material.envMap !== undefined) {
      this.mesh.material.envMap = envMap;
      this.mesh.material.needsUpdate = true;
    }
  }

  setVisibility(visible) {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.scene.remove(this.mesh);
    }
  }
}
