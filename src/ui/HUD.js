import { WEALTH_BRACKETS, formatWealth, formatPopulation, getBracketByDepth } from '../data/wealthData.js';
import { CREATURE_TYPES } from '../data/creatureConfig.js';

/**
 * HUD - Heads-up display showing wealth information
 * Updates based on camera depth position
 */
export class HUD {
  constructor() {
    this.elements = {};
    this.currentBracket = null;
    this.visible = true;

    this.init();
  }

  init() {
    // Cache DOM elements
    this.elements = {
      depthIndicator: document.querySelector('.depth-indicator'),
      depthValue: document.querySelector('.depth-value'),
      depthMarkers: document.querySelector('.depth-markers'),
      infoCreature: document.querySelector('.info-creature'),
      infoWealth: document.querySelector('.info-wealth'),
      infoPopulation: document.querySelector('.info-population'),
      hud: document.getElementById('hud'),
      controlsHint: document.getElementById('controls-hint')
    };

    // Create depth markers
    this.createDepthMarkers();
  }

  createDepthMarkers() {
    const container = this.elements.depthMarkers;
    if (!container) return;

    container.innerHTML = '';

    WEALTH_BRACKETS.forEach(bracket => {
      // Calculate position (0 at top = billionaires, 400 at bottom = poverty)
      const centerDepth = (bracket.depth.min + bracket.depth.max) / 2;
      const position = (centerDepth / 200) * 100; // Convert to percentage

      const marker = document.createElement('div');
      marker.className = 'zone-label';
      marker.style.top = `${position}%`;
      marker.textContent = bracket.name;
      marker.style.color = `#${bracket.color.toString(16).padStart(6, '0')}`;

      container.appendChild(marker);
    });
  }

  update(cameraY, nearbyCreatures = []) {
    const depth = Math.abs(cameraY);
    const bracket = getBracketByDepth(cameraY);

    // Update depth indicator position
    if (this.elements.depthIndicator) {
      const position = (depth / 200) * 100;
      this.elements.depthIndicator.style.top = `${Math.min(100, position)}%`;
    }

    // Update depth value
    if (this.elements.depthValue) {
      // Show wealth range for current depth
      if (bracket) {
        this.elements.depthValue.textContent =
          `${formatWealth(bracket.minWealth)} - ${formatWealth(bracket.maxWealth)}`;
      }
    }

    // Update info panel if bracket changed
    if (bracket && bracket.id !== this.currentBracket?.id) {
      this.currentBracket = bracket;
      this.updateInfoPanel(bracket);
    }

    // Check for nearby whale (billionaire)
    const nearbyWhale = nearbyCreatures.find(c => c.type === 'whale');
    if (nearbyWhale) {
      this.showWhaleInfo(nearbyWhale.whale);
    }
  }

  updateInfoPanel(bracket) {
    const creature = CREATURE_TYPES[bracket.creature];

    if (this.elements.infoCreature) {
      this.elements.infoCreature.textContent = creature?.name || bracket.creature;
      this.elements.infoCreature.style.color =
        `#${bracket.color.toString(16).padStart(6, '0')}`;
    }

    if (this.elements.infoWealth) {
      this.elements.infoWealth.textContent =
        `${formatWealth(bracket.minWealth)} - ${formatWealth(bracket.maxWealth)}`;
    }

    if (this.elements.infoPopulation) {
      this.elements.infoPopulation.textContent =
        `${formatPopulation(bracket.population)} people`;
    }
  }

  showWhaleInfo(whale) {
    if (!whale?.billionaire) return;

    if (this.elements.infoCreature) {
      this.elements.infoCreature.textContent = whale.billionaire.name;
      this.elements.infoCreature.style.color = '#ffd700';
    }

    if (this.elements.infoWealth) {
      this.elements.infoWealth.textContent = formatWealth(whale.billionaire.wealth);
    }

    if (this.elements.infoPopulation) {
      this.elements.infoPopulation.textContent = whale.billionaire.company;
    }
  }

  setVisible(visible) {
    this.visible = visible;
    if (this.elements.hud) {
      this.elements.hud.style.opacity = visible ? '1' : '0';
      this.elements.hud.style.pointerEvents = visible ? 'auto' : 'none';
    }
  }

  showMessage(message, duration = 3000) {
    // Create temporary message overlay
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(10, 22, 40, 0.9);
      border: 1px solid rgba(100, 200, 255, 0.3);
      border-radius: 10px;
      padding: 20px 40px;
      font-size: 24px;
      color: rgba(100, 200, 255, 0.8);
      text-shadow: 0 0 10px rgba(100, 200, 255, 0.8);
      z-index: 1000;
      animation: fadeInOut ${duration}ms ease-in-out forwards;
    `;
    messageEl.textContent = message;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(messageEl);

    setTimeout(() => {
      messageEl.remove();
      style.remove();
    }, duration);
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
      setTimeout(() => loading.remove(), 500);
    }
  }

  updateLoadingProgress(progress) {
    const progressBar = document.querySelector('.loading-progress');
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }
  }
}
