import * as THREE from 'three';

/**
 * FlyControls - First-person flying camera controls for exploring the ocean
 * WASD movement, mouse look, Q/E for up/down
 */
export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Movement state
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;

    // Mouse state
    this.isLocked = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Movement speed
    this.movementSpeed = 30;
    this.lookSpeed = 0.002;

    // Velocity for smooth movement
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    // Depth limits
    this.minY = -195; // Ocean floor
    this.maxY = 10;   // Above surface

    this.enabled = true;

    this.init();
  }

  init() {
    // Pointer lock
    this.domElement.addEventListener('click', () => {
      if (this.enabled) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Touch controls for mobile
    this.initTouchControls();
  }

  initTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;

    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    });

    this.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        this.euler.y -= deltaX * this.lookSpeed;
        this.euler.x -= deltaY * this.lookSpeed;
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

        this.camera.quaternion.setFromEuler(this.euler);

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        // Move forward while touching
        this.moveForward = true;
      }
    });

    this.domElement.addEventListener('touchend', () => {
      this.moveForward = false;
    });
  }

  onMouseMove(event) {
    if (!this.isLocked || !this.enabled) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.y -= movementX * this.lookSpeed;
    this.euler.x -= movementY * this.lookSpeed;

    // Clamp vertical look
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  onKeyDown(event) {
    if (!this.enabled) return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'KeyQ':
      case 'ShiftLeft':
        this.moveDown = true;
        break;
      case 'KeyE':
      case 'Space':
        this.moveUp = true;
        event.preventDefault();
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
      case 'KeyQ':
      case 'ShiftLeft':
        this.moveDown = false;
        break;
      case 'KeyE':
      case 'Space':
        this.moveUp = false;
        break;
    }
  }

  update(deltaTime) {
    if (!this.enabled) return;

    // Deceleration
    this.velocity.x -= this.velocity.x * 5.0 * deltaTime;
    this.velocity.y -= this.velocity.y * 5.0 * deltaTime;
    this.velocity.z -= this.velocity.z * 5.0 * deltaTime;

    // Direction based on input
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.y = Number(this.moveUp) - Number(this.moveDown);
    this.direction.normalize();

    // Apply movement
    const speed = this.movementSpeed;

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * speed * deltaTime;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x += this.direction.x * speed * deltaTime;
    }
    if (this.moveUp || this.moveDown) {
      this.velocity.y += this.direction.y * speed * deltaTime;
    }

    // Apply velocity to camera
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    this.camera.position.addScaledVector(forward, -this.velocity.z * deltaTime);
    this.camera.position.addScaledVector(right, this.velocity.x * deltaTime);
    this.camera.position.y += this.velocity.y * deltaTime;

    // Clamp to ocean bounds
    this.camera.position.y = Math.max(this.minY, Math.min(this.maxY, this.camera.position.y));

    // Keep within horizontal bounds
    const maxHorizontal = 240;
    this.camera.position.x = Math.max(-maxHorizontal, Math.min(maxHorizontal, this.camera.position.x));
    this.camera.position.z = Math.max(-maxHorizontal, Math.min(maxHorizontal, this.camera.position.z));
  }

  // Smoothly move camera to a target position
  moveTo(targetPosition, duration = 2) {
    return new Promise((resolve) => {
      const startPosition = this.camera.position.clone();
      const startTime = performance.now();

      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed / duration, 1);

        // Smooth easing
        const ease = t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;

        this.camera.position.lerpVectors(startPosition, targetPosition, ease);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  // Look at a target
  lookAt(target) {
    this.camera.lookAt(target);
    this.euler.setFromQuaternion(this.camera.quaternion);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.isLocked) {
      document.exitPointerLock();
    }
  }

  getPosition() {
    return this.camera.position.clone();
  }

  dispose() {
    document.exitPointerLock();
  }
}
