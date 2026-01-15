import * as THREE from 'three';
import { FishSchool } from './FishSchool.js';
import { WhaleController } from './WhaleController.js';
import { WEALTH_BRACKETS } from '../data/wealthData.js';
import { CREATURE_TYPES } from '../data/creatureConfig.js';

/**
 * CreatureManager - Orchestrates all sea creatures based on wealth distribution
 * Spawns appropriate creatures at each depth level
 * Now supports environment maps for PBR materials
 */
export class CreatureManager {
  constructor(scene, envMap = null) {
    this.scene = scene;
    this.envMap = envMap;
    this.schools = new Map();
    this.whaleController = null;
    this.time = 0;

    this.init();
  }

  init() {
    // Create fish schools for each wealth bracket (except billionaires)
    WEALTH_BRACKETS.forEach(bracket => {
      if (bracket.creature === 'whale') {
        // Whales get special treatment
        this.whaleController = new WhaleController(this.scene, this.envMap);
      } else {
        const school = new FishSchool(this.scene, bracket.creature, bracket, this.envMap);
        this.schools.set(bracket.id, school);
      }
    });

    console.log(`Created ${this.schools.size} fish schools + whale controller`);
  }

  /**
   * Set environment map for all creatures (for PBR reflections)
   */
  setEnvironmentMap(envMap) {
    this.envMap = envMap;

    this.schools.forEach(school => {
      school.setEnvironmentMap(envMap);
    });

    if (this.whaleController) {
      this.whaleController.setEnvironmentMap(envMap);
    }
  }

  update(deltaTime, cameraPosition) {
    this.time += deltaTime;

    // Update all fish schools
    this.schools.forEach((school, bracketId) => {
      school.update(deltaTime, cameraPosition);
    });

    // Update whales
    if (this.whaleController) {
      this.whaleController.update(deltaTime, cameraPosition);
    }
  }

  // Get info about creatures near the camera
  getCreaturesNearCamera(cameraPosition, radius = 50) {
    const nearby = [];

    // Check which bracket the camera is in
    const depth = Math.abs(cameraPosition.y);
    const bracket = WEALTH_BRACKETS.find(b =>
      depth >= b.depth.min && depth <= b.depth.max
    );

    if (bracket) {
      nearby.push({
        type: 'bracket',
        bracket: bracket,
        creature: CREATURE_TYPES[bracket.creature]
      });
    }

    // Check for nearby whales
    if (this.whaleController) {
      const { whale, distance } = this.whaleController.getClosestWhale(cameraPosition);
      if (whale && distance < radius) {
        nearby.push({
          type: 'whale',
          whale: whale,
          distance: distance
        });
      }
    }

    return nearby;
  }

  // Get the current wealth bracket based on camera depth
  getCurrentBracket(cameraY) {
    const depth = Math.abs(cameraY);
    return WEALTH_BRACKETS.find(b =>
      depth >= b.depth.min && depth <= b.depth.max
    ) || WEALTH_BRACKETS[0];
  }

  // Get statistics for display
  getStats() {
    let totalCreatures = 0;
    const details = [];

    this.schools.forEach((school, bracketId) => {
      const bracket = WEALTH_BRACKETS.find(b => b.id === bracketId);
      totalCreatures += school.fishes.length;
      details.push({
        bracket: bracket?.name || bracketId,
        count: school.fishes.length,
        population: bracket?.population || 0
      });
    });

    if (this.whaleController) {
      totalCreatures += this.whaleController.whales.length;
      details.push({
        bracket: 'Billionaires',
        count: this.whaleController.whales.length,
        population: WEALTH_BRACKETS.find(b => b.creature === 'whale')?.population || 0
      });
    }

    return { totalCreatures, details };
  }

  // Set visibility of creatures outside view for performance
  updateVisibility(cameraPosition, viewDistance = 200) {
    this.schools.forEach((school, bracketId) => {
      const bracket = WEALTH_BRACKETS.find(b => b.id === bracketId);
      if (bracket) {
        const cameraDepth = Math.abs(cameraPosition.y);
        const bracketCenter = (bracket.depth.min + bracket.depth.max) / 2;
        const distance = Math.abs(cameraDepth - bracketCenter);

        // Show creatures within view distance
        school.setVisibility(distance < viewDistance);
      }
    });
  }

  dispose() {
    this.schools.forEach(school => school.dispose());
    this.schools.clear();

    if (this.whaleController) {
      this.whaleController.dispose();
    }
  }
}
