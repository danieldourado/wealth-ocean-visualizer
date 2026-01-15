/**
 * Creature Configuration
 * Defines the visual properties and behaviors of each sea creature type
 */

export const CREATURE_TYPES = {
  krill: {
    name: 'Krill',
    baseSize: 0.05,
    sizeVariation: 0.02,
    speed: 0.3,
    schoolSize: 5000,      // How many to render (sampled from population)
    schoolRadius: 40,      // How spread out they are
    color: 0x8fbc8f,
    emissive: 0x2f4f2f,
    swimPattern: 'swarm',  // Movement behavior
    modelType: 'simple',   // Geometry type
    opacity: 0.8
  },

  anchovy: {
    name: 'Anchovy',
    baseSize: 0.15,
    sizeVariation: 0.05,
    speed: 0.5,
    schoolSize: 3000,
    schoolRadius: 35,
    color: 0x87ceeb,
    emissive: 0x4682b4,
    swimPattern: 'school',
    modelType: 'fish',
    opacity: 0.9
  },

  mackerel: {
    name: 'Mackerel',
    baseSize: 0.3,
    sizeVariation: 0.1,
    speed: 0.7,
    schoolSize: 1500,
    schoolRadius: 45,
    color: 0x5f9ea0,
    emissive: 0x2f4f4f,
    swimPattern: 'school',
    modelType: 'fish',
    opacity: 1.0
  },

  tuna: {
    name: 'Tuna',
    baseSize: 0.8,
    sizeVariation: 0.3,
    speed: 1.0,
    schoolSize: 500,
    schoolRadius: 50,
    color: 0x4169e1,
    emissive: 0x191970,
    swimPattern: 'loose',
    modelType: 'fish',
    opacity: 1.0
  },

  shark: {
    name: 'Shark',
    baseSize: 2.0,
    sizeVariation: 0.5,
    speed: 0.8,
    schoolSize: 100,
    schoolRadius: 80,
    color: 0x708090,
    emissive: 0x2f4f4f,
    swimPattern: 'patrol',
    modelType: 'shark',
    opacity: 1.0
  },

  orca: {
    name: 'Orca',
    baseSize: 5.0,
    sizeVariation: 1.0,
    speed: 0.6,
    schoolSize: 30,
    schoolRadius: 100,
    color: 0x2a4a5e,
    emissive: 0x3a6a8e,
    swimPattern: 'pod',
    modelType: 'whale',
    opacity: 1.0,
    hasPattern: true // Black and white pattern
  },

  whale: {
    name: 'Blue Whale',
    baseSize: 15.0,
    sizeVariation: 5.0,
    speed: 0.3,
    schoolSize: 10,       // Show top 10 billionaires
    schoolRadius: 150,
    color: 0x4682b4,
    emissive: 0x1e3a5f,
    swimPattern: 'solitary',
    modelType: 'whale',
    opacity: 1.0,
    hasGlow: true         // Golden glow for billionaires
  }
};

// Swimming behavior parameters
export const SWIM_PATTERNS = {
  swarm: {
    cohesion: 0.3,
    separation: 0.5,
    alignment: 0.2,
    noise: 0.8,
    verticalBias: 0.1
  },
  school: {
    cohesion: 0.6,
    separation: 0.4,
    alignment: 0.7,
    noise: 0.3,
    verticalBias: 0.2
  },
  loose: {
    cohesion: 0.3,
    separation: 0.6,
    alignment: 0.4,
    noise: 0.5,
    verticalBias: 0.3
  },
  patrol: {
    cohesion: 0.1,
    separation: 0.8,
    alignment: 0.2,
    noise: 0.4,
    verticalBias: 0.2
  },
  pod: {
    cohesion: 0.5,
    separation: 0.5,
    alignment: 0.6,
    noise: 0.2,
    verticalBias: 0.1
  },
  solitary: {
    cohesion: 0.0,
    separation: 1.0,
    alignment: 0.0,
    noise: 0.3,
    verticalBias: 0.05
  }
};

// Ocean environment settings
export const OCEAN_CONFIG = {
  width: 500,
  depth: 200,
  surfaceY: 0,
  floorY: -200,

  // Lighting by depth
  lightLevels: [
    { depth: 0, ambient: 0.8, fog: 0.001, fogColor: 0x1e90ff },
    { depth: 50, ambient: 0.5, fog: 0.003, fogColor: 0x0d3b66 },
    { depth: 100, ambient: 0.3, fog: 0.005, fogColor: 0x0a2540 },
    { depth: 150, ambient: 0.15, fog: 0.008, fogColor: 0x051525 },
    { depth: 200, ambient: 0.05, fog: 0.012, fogColor: 0x020810 }
  ],

  // Particle settings
  particles: {
    plankton: { count: 2000, size: 0.02, speed: 0.1 },
    debris: { count: 500, size: 0.05, speed: 0.05 },
    bubbles: { count: 300, size: 0.08, speed: 0.3 }
  }
};

// Get interpolated light settings for a given depth
export function getLightingForDepth(depth) {
  const levels = OCEAN_CONFIG.lightLevels;
  const absDepth = Math.abs(depth);

  // Find surrounding levels
  let lower = levels[0];
  let upper = levels[levels.length - 1];

  for (let i = 0; i < levels.length - 1; i++) {
    if (absDepth >= levels[i].depth && absDepth < levels[i + 1].depth) {
      lower = levels[i];
      upper = levels[i + 1];
      break;
    }
  }

  // Interpolate
  const range = upper.depth - lower.depth;
  const t = range > 0 ? (absDepth - lower.depth) / range : 0;

  return {
    ambient: lower.ambient + (upper.ambient - lower.ambient) * t,
    fog: lower.fog + (upper.fog - lower.fog) * t,
    fogColor: lerpColor(lower.fogColor, upper.fogColor, t)
  };
}

function lerpColor(c1, c2, t) {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
