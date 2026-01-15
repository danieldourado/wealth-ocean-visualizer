import * as THREE from 'three';
import { Ocean } from './scene/Ocean.js';
import { Lighting } from './scene/Lighting.js';
import { Skybox } from './scene/Skybox.js';
import { PostProcessing } from './scene/PostProcessing.js';
import { CreatureManager } from './creatures/CreatureManager.js';
import { Controls } from './ui/Controls.js';
import { HUD } from './ui/HUD.js';
import { DepthMeter } from './ui/DepthMeter.js';
import { CameraPath } from './utils/CameraPath.js';

/**
 * Wealth Ocean Visualizer
 * An immersive 3D experience showing global wealth inequality through sea creatures
 */
class WealthOcean {
  constructor() {
    this.time = 0;
    this.clock = new THREE.Clock();
    this.cinematicMode = false;

    this.init();
  }

  async init() {
    // Setup renderer
    this.setupRenderer();

    // Setup scene
    this.setupScene();

    // Setup camera
    this.setupCamera();

    // Create environment
    this.createEnvironment();

    // Create creatures
    this.createCreatures();

    // Setup controls
    this.setupControls();

    // Setup UI
    this.setupUI();

    // Setup event listeners
    this.setupEventListeners();

    // Start animation loop
    this.animate();

    // Hide loading screen
    setTimeout(() => {
      this.hud.hideLoading();
      this.hud.showMessage('Click to explore the wealth ocean', 4000);
    }, 1500);
  }

  setupRenderer() {
    const canvas = document.getElementById('ocean-canvas');

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupScene() {
    this.scene = new THREE.Scene();
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Start near the surface to see the billionaire whales first
    this.camera.position.set(0, -15, 80);
    this.camera.lookAt(0, -15, 0);
  }

  createEnvironment() {
    // Lighting system (needs renderer for HDRI/PMREM)
    this.lighting = new Lighting(this.scene, this.renderer);

    // Ocean (water, floor, particles) - needs lighting for env map
    this.ocean = new Ocean(this.scene, this.renderer, this.lighting);

    // Skybox (visible near surface)
    this.skybox = new Skybox(this.scene);

    // Post-processing pipeline
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
  }

  createCreatures() {
    // Get environment map from lighting system
    const envMap = this.lighting.getEnvironmentMap();

    // Creature manager handles all fish schools and whales
    this.creatureManager = new CreatureManager(this.scene, envMap);

    // Log stats
    const stats = this.creatureManager.getStats();
    console.log(`Total creatures rendered: ${stats.totalCreatures}`);
    stats.details.forEach(d => {
      console.log(`  ${d.bracket}: ${d.count} (representing ${d.population.toLocaleString()} people)`);
    });
  }

  setupControls() {
    const canvas = document.getElementById('ocean-canvas');

    // Fly controls
    this.controls = new Controls(this.camera, canvas);

    // Cinematic camera paths
    this.cameraPath = new CameraPath(this.camera, this.controls);
  }

  setupUI() {
    // HUD overlay
    this.hud = new HUD();

    // Depth meter
    this.depthMeter = new DepthMeter();

    // Update loading progress
    this.hud.updateLoadingProgress(1);
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.onResize());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Visibility change (pause when tab hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clock.stop();
      } else {
        this.clock.start();
      }
    });
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update post-processing size
    if (this.postProcessing) {
      this.postProcessing.setSize(width, height);
    }
  }

  onKeyDown(event) {
    switch (event.code) {
      case 'Space':
        // Toggle cinematic mode
        if (!this.cinematicMode && !this.cameraPath.isPlaying) {
          this.startCinematic();
        } else if (this.cameraPath.isPlaying) {
          this.cameraPath.stop();
          this.cinematicMode = false;
          document.body.classList.remove('cinematic');
          this.hud.setVisible(true);
        }
        event.preventDefault();
        break;

      case 'Digit1':
        this.playCinematic('theDive');
        break;
      case 'Digit2':
        this.playCinematic('theRise');
        break;
      case 'Digit3':
        this.playCinematic('whaleWatch');
        break;
      case 'Digit4':
        this.playCinematic('scaleComparison');
        break;
      case 'Digit5':
        this.playCinematic('overview');
        break;
      case 'Digit6':
        this.playCinematic('lonelyWhale');
        break;

      case 'KeyH':
        // Toggle HUD
        this.hud.setVisible(!this.hud.visible);
        break;

      case 'KeyR':
        // Reset camera position
        this.camera.position.set(0, -50, 80);
        this.camera.lookAt(0, -50, 0);
        break;

      case 'KeyT':
        // Go to top (billionaires)
        this.controls.moveTo(new THREE.Vector3(0, 0, 80), 3);
        break;

      case 'KeyB':
        // Go to bottom (poverty)
        this.controls.moveTo(new THREE.Vector3(0, -190, 80), 3);
        break;

      case 'KeyP':
        // Toggle post-processing
        this.postProcessing.setEnabled(!this.postProcessing.enabled);
        this.hud.showMessage(
          `Post-processing: ${this.postProcessing.enabled ? 'ON' : 'OFF'}`,
          2000
        );
        break;

      case 'KeyF':
        // Toggle depth of field
        const dofEnabled = !this.postProcessing.bokehPass.enabled;
        this.postProcessing.setDepthOfField(dofEnabled);
        this.hud.showMessage(
          `Depth of Field: ${dofEnabled ? 'ON' : 'OFF'}`,
          2000
        );
        break;
    }
  }

  startCinematic() {
    this.cinematicMode = true;
    document.body.classList.add('cinematic');
    this.hud.setVisible(false);

    // Enable cinematic post-processing
    this.postProcessing.setCinematicMode(true);

    // Play "The Dive" by default
    this.cameraPath.play('theDive', () => {
      this.cinematicMode = false;
      document.body.classList.remove('cinematic');
      this.hud.setVisible(true);
      this.postProcessing.setCinematicMode(false);
    });

    this.hud.showMessage('Cinematic Mode - Press Space to exit', 3000);
  }

  playCinematic(pathName) {
    this.cinematicMode = true;
    document.body.classList.add('cinematic');
    this.hud.setVisible(false);

    // Enable cinematic post-processing
    this.postProcessing.setCinematicMode(true);

    this.cameraPath.play(pathName, () => {
      this.cinematicMode = false;
      document.body.classList.remove('cinematic');
      this.hud.setVisible(true);
      this.postProcessing.setCinematicMode(false);
    });

    const path = this.cameraPath.paths[pathName];
    if (path) {
      this.hud.showMessage(path.name, 3000);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    this.time += deltaTime;

    // Update controls or cinematic path
    if (this.cameraPath.isPlaying) {
      this.cameraPath.update(deltaTime);
    } else {
      this.controls.update(deltaTime);
    }

    const cameraPos = this.camera.position;
    const cameraY = cameraPos.y;

    // Update environment
    this.ocean.update(deltaTime, cameraY);
    this.ocean.updateCameraPosition(cameraPos);
    this.lighting.update(deltaTime, cameraY, this.time);
    this.skybox.update(cameraY, this.time);

    // Update creatures
    this.creatureManager.update(deltaTime, cameraPos);
    this.creatureManager.updateVisibility(cameraPos);

    // Update UI
    const nearbyCreatures = this.creatureManager.getCreaturesNearCamera(cameraPos);
    this.hud.update(cameraY, nearbyCreatures);
    this.depthMeter.update(cameraY);

    // Update post-processing
    this.postProcessing.update(deltaTime, cameraY);

    // Render with post-processing
    this.postProcessing.render();
  }

  dispose() {
    this.ocean.dispose();
    this.lighting.dispose();
    this.skybox.dispose();
    this.creatureManager.dispose();
    this.controls.dispose();
    this.depthMeter.dispose();
    this.postProcessing.dispose();

    this.renderer.dispose();
  }
}

// Initialize the application
const app = new WealthOcean();

// Expose for debugging
window.wealthOcean = app;

// Expose cinematic controls
window.cinematics = {
  dive: () => app.playCinematic('theDive'),
  rise: () => app.playCinematic('theRise'),
  whales: () => app.playCinematic('whaleWatch'),
  scale: () => app.playCinematic('scaleComparison'),
  overview: () => app.playCinematic('overview'),
  lonely: () => app.playCinematic('lonelyWhale'),
  stop: () => app.cameraPath.stop()
};

console.log(`
╔══════════════════════════════════════════════════════════════╗
║        WEALTH OCEAN VISUALIZER - PHOTOREALISTIC             ║
╠══════════════════════════════════════════════════════════════╣
║  Controls:                                                   ║
║    WASD     - Move                                          ║
║    Mouse    - Look around (click to lock)                   ║
║    Q/E      - Descend/Ascend                                ║
║    Space    - Start cinematic                               ║
║    1-6      - Play specific cinematics                      ║
║    H        - Toggle HUD                                    ║
║    R        - Reset position                                ║
║    T        - Go to top (billionaires)                      ║
║    B        - Go to bottom (poverty)                        ║
║    P        - Toggle post-processing                        ║
║    F        - Toggle depth of field                         ║
╠══════════════════════════════════════════════════════════════╣
║  Cinematics (also via console: cinematics.dive(), etc):     ║
║    1 - The Dive       4 - Scale Comparison                  ║
║    2 - The Rise       5 - Overview                          ║
║    3 - Whale Watch    6 - The Lonely Whale                  ║
╚══════════════════════════════════════════════════════════════╝
`);
