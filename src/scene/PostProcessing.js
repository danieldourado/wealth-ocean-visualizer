import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * PostProcessing - Cinematic post-processing pipeline
 * Features:
 * - Unreal-style bloom for bioluminescence and sun
 * - Depth of field (Bokeh) for cinematic focus
 * - Underwater color grading with depth-based shift
 * - SMAA anti-aliasing
 * - Vignette effect
 */
export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.enabled = true;
    this.currentDepth = 0;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create effect composer
    this.composer = new EffectComposer(this.renderer);

    // 1. Render pass - base scene render
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 2. Bloom pass - for glowing effects
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8,    // Strength
      0.4,    // Radius
      0.85    // Threshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Depth of field (Bokeh) pass
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 50.0,
      aperture: 0.00015,
      maxblur: 0.008
    });
    this.bokehPass.enabled = false; // Disabled by default, enable for cinematic shots
    this.composer.addPass(this.bokehPass);

    // 4. Underwater color grading shader
    this.colorGradePass = new ShaderPass(this.createColorGradeShader());
    this.composer.addPass(this.colorGradePass);

    // 5. Vignette and film grain shader
    this.vignettePass = new ShaderPass(this.createVignetteShader());
    this.composer.addPass(this.vignettePass);

    // 6. FXAA anti-aliasing
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
    this.composer.addPass(this.fxaaPass);

    // 7. Output pass (tone mapping and color space conversion)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  createColorGradeShader() {
    return {
      uniforms: {
        tDiffuse: { value: null },
        uDepth: { value: 0 },
        uSaturation: { value: 1.0 },
        uContrast: { value: 1.05 },
        uBrightness: { value: 0.0 },
        // Underwater color shift
        uTintColor: { value: new THREE.Color(0.2, 0.5, 0.8) },
        uTintStrength: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uDepth;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uBrightness;
        uniform vec3 uTintColor;
        uniform float uTintStrength;

        varying vec2 vUv;

        // Color grading functions
        vec3 adjustSaturation(vec3 color, float saturation) {
          float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(grey), color, saturation);
        }

        vec3 adjustContrast(vec3 color, float contrast) {
          return (color - 0.5) * contrast + 0.5;
        }

        // Filmic tone mapping (ACES approximation)
        vec3 ACESFilm(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;

          // Apply underwater tint based on depth
          color = mix(color, color * uTintColor, uTintStrength);

          // Adjust saturation (underwater tends to be less saturated)
          color = adjustSaturation(color, uSaturation);

          // Adjust contrast
          color = adjustContrast(color, uContrast);

          // Adjust brightness
          color += uBrightness;

          // Apply subtle filmic tone mapping
          color = ACESFilm(color);

          // Depth-based blue shift (Beer-Lambert approximation)
          float depthFactor = clamp(uDepth / 200.0, 0.0, 1.0);
          vec3 deepColor = vec3(0.05, 0.15, 0.3);
          color = mix(color, color * mix(vec3(1.0), deepColor, depthFactor * 0.5), depthFactor * 0.3);

          gl_FragColor = vec4(color, texel.a);
        }
      `
    };
  }

  createVignetteShader() {
    return {
      uniforms: {
        tDiffuse: { value: null },
        uVignetteStrength: { value: 0.4 },
        uVignetteRadius: { value: 0.8 },
        uTime: { value: 0 },
        uGrainStrength: { value: 0.03 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uVignetteStrength;
        uniform float uVignetteRadius;
        uniform float uTime;
        uniform float uGrainStrength;

        varying vec2 vUv;

        // Film grain noise
        float random(vec2 co) {
          return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;

          // Vignette
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float vignette = smoothstep(uVignetteRadius, uVignetteRadius - 0.3, dist);
          vignette = mix(1.0, vignette, uVignetteStrength);
          color *= vignette;

          // Subtle film grain
          float grain = random(vUv + fract(uTime)) * 2.0 - 1.0;
          color += grain * uGrainStrength;

          // Subtle chromatic aberration at edges
          float aberration = dist * 0.002;
          vec3 colorR = texture2D(tDiffuse, vUv + vec2(aberration, 0.0)).rgb;
          vec3 colorB = texture2D(tDiffuse, vUv - vec2(aberration, 0.0)).rgb;
          color.r = mix(color.r, colorR.r, dist * 0.3);
          color.b = mix(color.b, colorB.b, dist * 0.3);

          gl_FragColor = vec4(color, texel.a);
        }
      `
    };
  }

  update(deltaTime, cameraY) {
    this.currentDepth = Math.abs(cameraY);

    // Update color grading based on depth
    const depthFactor = Math.min(1, this.currentDepth / 150);

    // Underwater gets progressively more blue/cyan tinted
    this.colorGradePass.uniforms.uDepth.value = this.currentDepth;
    this.colorGradePass.uniforms.uTintStrength.value = depthFactor * 0.4;

    // Reduce saturation with depth
    this.colorGradePass.uniforms.uSaturation.value = 1.0 - depthFactor * 0.3;

    // Adjust bloom based on depth (more bloom near surface for god rays)
    const surfaceBloom = Math.max(0, 1 - this.currentDepth * 0.02);
    this.bloomPass.strength = 0.5 + surfaceBloom * 0.5;

    // Update vignette time for grain animation
    this.vignettePass.uniforms.uTime.value += deltaTime;
  }

  // Enable/disable depth of field
  setDepthOfField(enabled, focus = 50, aperture = 0.00015) {
    this.bokehPass.enabled = enabled;
    if (enabled) {
      this.bokehPass.uniforms.focus.value = focus;
      this.bokehPass.uniforms.aperture.value = aperture;
    }
  }

  // Set cinematic mode with enhanced effects
  setCinematicMode(enabled) {
    if (enabled) {
      this.bloomPass.strength = 1.2;
      this.vignettePass.uniforms.uVignetteStrength.value = 0.6;
      this.colorGradePass.uniforms.uContrast.value = 1.15;
      this.setDepthOfField(true, 80, 0.0001);
    } else {
      this.bloomPass.strength = 0.8;
      this.vignettePass.uniforms.uVignetteStrength.value = 0.4;
      this.colorGradePass.uniforms.uContrast.value = 1.05;
      this.setDepthOfField(false);
    }
  }

  // Presets for different underwater zones
  setZonePreset(zone) {
    switch (zone) {
      case 'surface':
        this.bloomPass.strength = 1.0;
        this.bloomPass.threshold = 0.8;
        this.colorGradePass.uniforms.uTintColor.value.setRGB(0.3, 0.6, 0.9);
        this.colorGradePass.uniforms.uBrightness.value = 0.05;
        break;

      case 'midwater':
        this.bloomPass.strength = 0.6;
        this.bloomPass.threshold = 0.85;
        this.colorGradePass.uniforms.uTintColor.value.setRGB(0.2, 0.4, 0.7);
        this.colorGradePass.uniforms.uBrightness.value = 0.0;
        break;

      case 'deep':
        this.bloomPass.strength = 0.4;
        this.bloomPass.threshold = 0.9;
        this.colorGradePass.uniforms.uTintColor.value.setRGB(0.1, 0.2, 0.4);
        this.colorGradePass.uniforms.uBrightness.value = -0.05;
        break;

      case 'abyss':
        this.bloomPass.strength = 1.5; // High bloom for bioluminescence
        this.bloomPass.threshold = 0.7;
        this.colorGradePass.uniforms.uTintColor.value.setRGB(0.05, 0.1, 0.2);
        this.colorGradePass.uniforms.uBrightness.value = -0.1;
        break;
    }
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    if (this.fxaaPass) {
      this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  dispose() {
    this.composer.dispose();
  }
}
