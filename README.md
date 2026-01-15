# Wealth Ocean Visualizer

An immersive 3D underwater simulation that visualizes global wealth inequality through sea creatures. Dive through the ocean depths where each creature type represents a different wealth bracket - from tiny krill representing those in extreme poverty to majestic whales embodying billionaires.

![Wealth Ocean](https://img.shields.io/badge/Three.js-black?style=flat&logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)

## Features

### Photorealistic Ocean Environment
- **Gerstner Wave Physics** - Physically accurate ocean surface with multi-layered wave simulation
- **Volumetric God Rays** - Raymarched light shafts streaming through the water
- **Voronoi Caustics** - Realistic animated light patterns on the ocean floor
- **Beer-Lambert Light Absorption** - Wavelength-based light falloff (red absorbed first, blue penetrates deepest)
- **Dynamic Fog & Atmosphere** - Depth-based visibility with color grading

### Sea Creatures
- **10,000+ Creatures** rendered using GPU instancing
- **PBR Materials** with subsurface scattering, iridescence, and clearcoat
- **Realistic Schooling Behavior** - Cohesion, separation, and alignment algorithms
- **GLTF Model Support** - Load custom 3D models with procedural fallbacks

### Wealth Representation
| Depth | Creature | Represents |
|-------|----------|------------|
| 0-10m | Whales (with golden glow) | Billionaires (~2,700 people) |
| 10-30m | Sharks | Ultra-Wealthy (~200,000 people) |
| 30-60m | Tuna | Affluent (~50 million) |
| 60-100m | Mackerel | Middle Class (~500 million) |
| 100-150m | Anchovies | Lower Middle (~2 billion) |
| 150-180m | Small Fish | Low Wealth (~2 billion) |
| 180-200m | Krill | Extreme Poverty (~1.5 billion) |

### Post-Processing Effects
- Unreal-style Bloom for bioluminescence
- Cinematic Depth of Field (Bokeh)
- Underwater Color Grading
- Film Grain & Vignette
- FXAA Anti-aliasing

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `Mouse` | Look around (click to lock) |
| `Q/E` | Descend / Ascend |
| `Space` | Start cinematic mode |
| `1-6` | Play specific cinematics |
| `H` | Toggle HUD |
| `R` | Reset position |
| `T` | Go to top (billionaires) |
| `B` | Go to bottom (poverty) |
| `P` | Toggle post-processing |
| `F` | Toggle depth of field |

## Cinematic Modes

1. **The Dive** - Descend from surface to the abyss
2. **The Rise** - Ascend from depths to billionaire whales
3. **Whale Watch** - Follow the billionaire whales
4. **Scale Comparison** - Compare creature sizes
5. **Overview** - Panoramic view of the ocean
6. **The Lonely Whale** - Focus on a single billionaire

## Installation

```bash
# Clone the repository
git clone https://github.com/danieldourado/wealth-ocean-visualizer.git
cd wealth-ocean-visualizer

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Three.js** - 3D graphics library
- **Vite** - Build tool and dev server
- **WebGL** - Hardware-accelerated rendering
- **GLSL** - Custom shaders for water, caustics, and effects

## Project Structure

```
ocean-simulator/
├── src/
│   ├── main.js              # Application entry point
│   ├── creatures/
│   │   ├── CreatureManager.js
│   │   ├── FishSchool.js    # Instanced fish rendering
│   │   └── WhaleController.js
│   ├── scene/
│   │   ├── Ocean.js         # Water, caustics, particles
│   │   ├── Lighting.js      # HDRI, absorption, bioluminescence
│   │   ├── Skybox.js
│   │   └── PostProcessing.js
│   ├── ui/
│   │   ├── Controls.js
│   │   ├── HUD.js
│   │   └── DepthMeter.js
│   ├── utils/
│   │   └── CameraPath.js
│   └── data/
│       ├── creatureConfig.js
│       └── wealthData.js
├── public/
│   └── assets/              # Models, textures, HDRI
├── styles/
│   └── main.css
└── index.html
```

## Adding Custom Assets

### HDRI Environment Map
Place an HDR file at `public/assets/hdri/underwater.hdr` for realistic reflections.

### 3D Models
Add GLTF/GLB models to `public/assets/models/`:
- `fish_small.glb`, `fish_medium.glb`, `fish_large.glb`
- `shark.glb`
- `whale.glb`

## Performance Notes

- Uses GPU instancing for 10,000+ creatures
- LOD-like visibility culling based on camera depth
- Post-processing can be toggled with `P` key for better performance
- Recommended: GPU with WebGL 2.0 support

## License

MIT License - Feel free to use, modify, and distribute.

## Acknowledgments

- Wealth data visualization concept inspired by global inequality studies
- Three.js community for excellent documentation and examples
- Gerstner wave implementation based on GPU Gems articles
