import * as THREE from 'three';
import { WEALTH_BRACKETS } from '../data/wealthData.js';

/**
 * CameraPath - Cinematic camera animations for YouTube recording
 * Pre-defined dramatic camera movements through the wealth ocean
 */
export class CameraPath {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.isPlaying = false;
    this.currentPath = null;
    this.pathProgress = 0;
    this.pathDuration = 0;
    this.onComplete = null;

    // Define cinematic paths
    this.paths = this.definePaths();
  }

  definePaths() {
    return {
      // "The Dive" - Start at surface with whales, descend to krill
      theDive: {
        name: 'The Dive',
        duration: 30,
        points: [
          { position: new THREE.Vector3(0, 5, 100), lookAt: new THREE.Vector3(0, 0, 0), time: 0 },
          { position: new THREE.Vector3(50, -10, 50), lookAt: new THREE.Vector3(0, -20, 0), time: 0.1 },
          { position: new THREE.Vector3(30, -40, 30), lookAt: new THREE.Vector3(0, -50, 0), time: 0.25 },
          { position: new THREE.Vector3(-20, -80, 40), lookAt: new THREE.Vector3(0, -90, 0), time: 0.45 },
          { position: new THREE.Vector3(10, -120, 20), lookAt: new THREE.Vector3(0, -130, 0), time: 0.65 },
          { position: new THREE.Vector3(-30, -160, 30), lookAt: new THREE.Vector3(0, -170, 0), time: 0.8 },
          { position: new THREE.Vector3(0, -190, 50), lookAt: new THREE.Vector3(0, -190, 0), time: 1.0 }
        ]
      },

      // "The Rise" - Reverse journey from poverty to billionaires
      theRise: {
        name: 'The Rise',
        duration: 25,
        points: [
          { position: new THREE.Vector3(0, -190, 50), lookAt: new THREE.Vector3(0, -180, 0), time: 0 },
          { position: new THREE.Vector3(20, -150, 30), lookAt: new THREE.Vector3(0, -140, 0), time: 0.15 },
          { position: new THREE.Vector3(-10, -100, 40), lookAt: new THREE.Vector3(0, -90, 0), time: 0.35 },
          { position: new THREE.Vector3(30, -50, 30), lookAt: new THREE.Vector3(0, -40, 0), time: 0.55 },
          { position: new THREE.Vector3(-20, -20, 50), lookAt: new THREE.Vector3(0, -10, 0), time: 0.75 },
          { position: new THREE.Vector3(0, 5, 80), lookAt: new THREE.Vector3(0, 0, 0), time: 1.0 }
        ]
      },

      // "The Whale Watch" - Circle around the billionaire whales
      whaleWatch: {
        name: 'Whale Watch',
        duration: 20,
        points: [
          { position: new THREE.Vector3(100, -5, 0), lookAt: new THREE.Vector3(0, -5, 0), time: 0 },
          { position: new THREE.Vector3(70, -8, 70), lookAt: new THREE.Vector3(0, -5, 0), time: 0.25 },
          { position: new THREE.Vector3(0, -10, 100), lookAt: new THREE.Vector3(0, -5, 0), time: 0.5 },
          { position: new THREE.Vector3(-70, -8, 70), lookAt: new THREE.Vector3(0, -5, 0), time: 0.75 },
          { position: new THREE.Vector3(-100, -5, 0), lookAt: new THREE.Vector3(0, -5, 0), time: 1.0 }
        ]
      },

      // "Scale Comparison" - Show size difference between whale and krill
      scaleComparison: {
        name: 'Scale Comparison',
        duration: 15,
        points: [
          { position: new THREE.Vector3(50, -5, 50), lookAt: new THREE.Vector3(30, -5, 30), time: 0 },
          { position: new THREE.Vector3(35, -5, 35), lookAt: new THREE.Vector3(30, -5, 30), time: 0.3 },
          { position: new THREE.Vector3(30, -100, 30), lookAt: new THREE.Vector3(30, -180, 30), time: 0.6 },
          { position: new THREE.Vector3(30, -185, 30), lookAt: new THREE.Vector3(0, -190, 0), time: 1.0 }
        ]
      },

      // "The Overview" - Wide shot showing all layers
      overview: {
        name: 'Overview',
        duration: 20,
        points: [
          { position: new THREE.Vector3(200, 50, 200), lookAt: new THREE.Vector3(0, -100, 0), time: 0 },
          { position: new THREE.Vector3(-200, 30, 200), lookAt: new THREE.Vector3(0, -100, 0), time: 0.5 },
          { position: new THREE.Vector3(-200, 10, -200), lookAt: new THREE.Vector3(0, -100, 0), time: 1.0 }
        ]
      },

      // "The Lonely Whale" - Follow the richest whale
      lonelyWhale: {
        name: 'The Lonely Whale',
        duration: 25,
        points: [
          { position: new THREE.Vector3(80, -3, 30), lookAt: new THREE.Vector3(50, -5, 0), time: 0 },
          { position: new THREE.Vector3(60, -5, 10), lookAt: new THREE.Vector3(50, -5, 0), time: 0.2 },
          { position: new THREE.Vector3(55, -6, -5), lookAt: new THREE.Vector3(50, -5, 0), time: 0.4 },
          { position: new THREE.Vector3(45, -4, -20), lookAt: new THREE.Vector3(50, -5, 0), time: 0.6 },
          { position: new THREE.Vector3(30, -8, -10), lookAt: new THREE.Vector3(50, -5, 0), time: 0.8 },
          { position: new THREE.Vector3(20, -10, 20), lookAt: new THREE.Vector3(50, -5, 0), time: 1.0 }
        ]
      }
    };
  }

  // Play a cinematic path
  play(pathName, onComplete = null) {
    const path = this.paths[pathName];
    if (!path) {
      console.error(`Path "${pathName}" not found`);
      return;
    }

    this.currentPath = path;
    this.pathProgress = 0;
    this.pathDuration = path.duration;
    this.isPlaying = true;
    this.onComplete = onComplete;

    // Disable user controls during playback
    if (this.controls) {
      this.controls.setEnabled(false);
    }

    console.log(`Playing cinematic: ${path.name}`);
  }

  // Stop current path
  stop() {
    this.isPlaying = false;
    this.currentPath = null;

    // Re-enable user controls
    if (this.controls) {
      this.controls.setEnabled(true);
    }
  }

  // Update camera position along path
  update(deltaTime) {
    if (!this.isPlaying || !this.currentPath) return;

    // Advance progress
    this.pathProgress += deltaTime / this.pathDuration;

    if (this.pathProgress >= 1) {
      this.pathProgress = 1;
      this.isPlaying = false;

      // Re-enable controls
      if (this.controls) {
        this.controls.setEnabled(true);
      }

      if (this.onComplete) {
        this.onComplete();
      }
      return;
    }

    // Find surrounding keyframes
    const points = this.currentPath.points;
    let p1 = points[0];
    let p2 = points[1];

    for (let i = 0; i < points.length - 1; i++) {
      if (this.pathProgress >= points[i].time && this.pathProgress < points[i + 1].time) {
        p1 = points[i];
        p2 = points[i + 1];
        break;
      }
    }

    // Interpolate between keyframes
    const segmentProgress = (this.pathProgress - p1.time) / (p2.time - p1.time);
    const t = this.easeInOutCubic(segmentProgress);

    // Interpolate position
    const position = new THREE.Vector3().lerpVectors(p1.position, p2.position, t);
    this.camera.position.copy(position);

    // Interpolate look target
    const lookAt = new THREE.Vector3().lerpVectors(p1.lookAt, p2.lookAt, t);
    this.camera.lookAt(lookAt);
  }

  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Get list of available paths
  getPathList() {
    return Object.entries(this.paths).map(([key, path]) => ({
      id: key,
      name: path.name,
      duration: path.duration
    }));
  }

  // Play all paths in sequence (for full demo)
  async playAll(pauseBetween = 2) {
    const pathNames = Object.keys(this.paths);

    for (const pathName of pathNames) {
      await new Promise(resolve => {
        this.play(pathName, resolve);
      });

      // Pause between paths
      await new Promise(resolve => setTimeout(resolve, pauseBetween * 1000));
    }
  }

  // Create custom path from current position
  recordPath() {
    // Could be used to record custom camera movements
    // For now, returns current camera state
    return {
      position: this.camera.position.clone(),
      rotation: this.camera.rotation.clone(),
      quaternion: this.camera.quaternion.clone()
    };
  }
}
