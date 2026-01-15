import { WEALTH_BRACKETS, formatWealth } from '../data/wealthData.js';

/**
 * DepthMeter - Visual indicator showing current depth/wealth level
 * Acts as a wealth compass showing where you are in the financial ocean
 */
export class DepthMeter {
  constructor(container) {
    this.container = container || document.getElementById('depth-meter');
    this.markers = [];

    this.init();
  }

  init() {
    if (!this.container) return;

    // Clear existing content
    const markersContainer = this.container.querySelector('.depth-markers');
    if (markersContainer) {
      this.createMarkers(markersContainer);
    }
  }

  createMarkers(container) {
    container.innerHTML = '';

    // Create markers for each wealth bracket
    WEALTH_BRACKETS.forEach((bracket, index) => {
      const marker = document.createElement('div');
      marker.className = 'depth-marker';

      // Position based on depth range
      const topPercent = (bracket.depth.min / 200) * 100;
      const bottomPercent = (bracket.depth.max / 200) * 100;
      const height = bottomPercent - topPercent;

      marker.style.cssText = `
        position: absolute;
        left: 20px;
        top: ${topPercent}%;
        height: ${height}%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding-left: 5px;
        border-left: 2px solid rgba(${this.hexToRgb(bracket.color)}, 0.5);
        transition: all 0.3s ease;
      `;

      // Creature icon/emoji
      const icon = document.createElement('span');
      icon.className = 'marker-icon';
      icon.textContent = this.getCreatureEmoji(bracket.creature);
      icon.style.cssText = `
        font-size: 14px;
        margin-bottom: 2px;
      `;

      // Wealth label
      const label = document.createElement('span');
      label.className = 'marker-label';
      label.textContent = formatWealth(bracket.maxWealth);
      label.style.cssText = `
        font-size: 9px;
        color: rgba(255, 255, 255, 0.5);
        white-space: nowrap;
      `;

      marker.appendChild(icon);
      marker.appendChild(label);
      container.appendChild(marker);

      this.markers.push({ element: marker, bracket });
    });
  }

  getCreatureEmoji(creature) {
    const emojis = {
      krill: '🦐',
      anchovy: '🐟',
      mackerel: '🐠',
      tuna: '🐡',
      shark: '🦈',
      orca: '🐋',
      whale: '🐳'
    };
    return emojis[creature] || '🐟';
  }

  hexToRgb(hex) {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `${r}, ${g}, ${b}`;
  }

  update(depth) {
    const absDepth = Math.abs(depth);

    // Highlight current bracket
    this.markers.forEach(({ element, bracket }) => {
      const isActive = absDepth >= bracket.depth.min && absDepth <= bracket.depth.max;

      if (isActive) {
        element.style.borderLeftColor = `rgba(${this.hexToRgb(bracket.color)}, 1)`;
        element.style.borderLeftWidth = '4px';
        element.style.transform = 'scale(1.1)';
        element.style.zIndex = '10';
      } else {
        element.style.borderLeftColor = `rgba(${this.hexToRgb(bracket.color)}, 0.3)`;
        element.style.borderLeftWidth = '2px';
        element.style.transform = 'scale(1)';
        element.style.zIndex = '1';
      }
    });

    // Update depth indicator position
    const indicator = this.container?.querySelector('.depth-indicator');
    if (indicator) {
      const position = (absDepth / 200) * 100;
      indicator.style.top = `${Math.min(98, Math.max(2, position))}%`;
    }
  }

  // Animate indicator for dramatic effect
  animateToDepth(targetDepth, duration = 2000) {
    const indicator = this.container?.querySelector('.depth-indicator');
    if (!indicator) return;

    indicator.style.transition = `top ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    const position = (Math.abs(targetDepth) / 200) * 100;
    indicator.style.top = `${Math.min(98, Math.max(2, position))}%`;

    // Reset transition after animation
    setTimeout(() => {
      indicator.style.transition = 'top 0.3s ease-out';
    }, duration);
  }

  setHighlight(bracketId) {
    this.markers.forEach(({ element, bracket }) => {
      if (bracket.id === bracketId) {
        element.style.boxShadow = `0 0 20px rgba(${this.hexToRgb(bracket.color)}, 0.5)`;
      } else {
        element.style.boxShadow = 'none';
      }
    });
  }

  dispose() {
    this.markers = [];
    if (this.container) {
      const markersContainer = this.container.querySelector('.depth-markers');
      if (markersContainer) {
        markersContainer.innerHTML = '';
      }
    }
  }
}
