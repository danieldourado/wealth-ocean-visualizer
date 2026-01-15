/**
 * Global Wealth Distribution Data
 * Sources: Credit Suisse Global Wealth Report, Forbes Billionaires List, World Bank
 *
 * This maps real-world wealth distribution to our ocean visualization
 */

export const WEALTH_BRACKETS = [
  {
    id: 'extreme_poverty',
    name: 'Extreme Poverty',
    minWealth: 0,
    maxWealth: 1000,
    population: 1_500_000_000, // ~1.5 billion people
    creature: 'krill',
    depth: { min: 180, max: 200 }, // Deepest, darkest
    description: 'Living on less than $2.15/day',
    color: 0x4a6741
  },
  {
    id: 'poverty',
    name: 'Low Wealth',
    minWealth: 1000,
    maxWealth: 10000,
    population: 2_000_000_000, // ~2 billion
    creature: 'anchovy',
    depth: { min: 140, max: 180 },
    description: 'Basic savings, limited security',
    color: 0x5a8a5a
  },
  {
    id: 'lower_middle',
    name: 'Lower Middle',
    minWealth: 10000,
    maxWealth: 100000,
    population: 2_000_000_000, // ~2 billion
    creature: 'mackerel',
    depth: { min: 100, max: 140 },
    description: 'Modest home equity, some savings',
    color: 0x6aaa7a
  },
  {
    id: 'middle',
    name: 'Middle Class',
    minWealth: 100000,
    maxWealth: 1000000,
    population: 500_000_000, // ~500 million
    creature: 'tuna',
    depth: { min: 60, max: 100 },
    description: 'Property owners, retirement funds',
    color: 0x7acaaa
  },
  {
    id: 'affluent',
    name: 'Affluent',
    minWealth: 1000000,
    maxWealth: 10000000,
    population: 50_000_000, // ~50 million
    creature: 'shark',
    depth: { min: 30, max: 60 },
    description: 'Millionaires, significant investments',
    color: 0x8aeaca
  },
  {
    id: 'wealthy',
    name: 'Ultra-Wealthy',
    minWealth: 10000000,
    maxWealth: 1000000000,
    population: 200_000, // ~200,000
    creature: 'orca',
    depth: { min: 10, max: 30 },
    description: 'Multi-millionaires, business owners',
    color: 0xaaffee
  },
  {
    id: 'billionaire',
    name: 'Billionaires',
    minWealth: 1000000000,
    maxWealth: 300000000000, // ~$300B (richest person)
    population: 2_700, // ~2,700 billionaires
    creature: 'whale',
    depth: { min: 0, max: 10 },
    description: 'The apex predators of wealth',
    color: 0xffd700
  }
];

// Notable billionaires for special whale rendering
export const NOTABLE_BILLIONAIRES = [
  { name: 'Elon Musk', wealth: 250_000_000_000, company: 'Tesla/SpaceX' },
  { name: 'Jeff Bezos', wealth: 200_000_000_000, company: 'Amazon' },
  { name: 'Bernard Arnault', wealth: 190_000_000_000, company: 'LVMH' },
  { name: 'Mark Zuckerberg', wealth: 170_000_000_000, company: 'Meta' },
  { name: 'Larry Ellison', wealth: 150_000_000_000, company: 'Oracle' },
  { name: 'Bill Gates', wealth: 130_000_000_000, company: 'Microsoft' },
  { name: 'Warren Buffett', wealth: 120_000_000_000, company: 'Berkshire' },
  { name: 'Larry Page', wealth: 110_000_000_000, company: 'Google' },
  { name: 'Sergey Brin', wealth: 105_000_000_000, company: 'Google' },
  { name: 'Steve Ballmer', wealth: 100_000_000_000, company: 'Microsoft' }
];

// Helper functions
export function getBracketByWealth(wealth) {
  return WEALTH_BRACKETS.find(b => wealth >= b.minWealth && wealth < b.maxWealth)
    || WEALTH_BRACKETS[WEALTH_BRACKETS.length - 1];
}

export function getBracketByDepth(depth) {
  return WEALTH_BRACKETS.find(b => depth >= b.depth.min && depth <= b.depth.max)
    || WEALTH_BRACKETS[0];
}

export function formatWealth(amount) {
  if (amount >= 1_000_000_000_000) {
    return `$${(amount / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function formatPopulation(pop) {
  if (pop >= 1_000_000_000) {
    return `${(pop / 1_000_000_000).toFixed(1)} billion`;
  }
  if (pop >= 1_000_000) {
    return `${(pop / 1_000_000).toFixed(1)} million`;
  }
  if (pop >= 1_000) {
    return `${(pop / 1_000).toFixed(1)} thousand`;
  }
  return `${pop.toLocaleString()}`;
}

// Get total wealth stats
export function getWealthStats() {
  const totalPopulation = WEALTH_BRACKETS.reduce((sum, b) => sum + b.population, 0);
  const topBracket = WEALTH_BRACKETS[WEALTH_BRACKETS.length - 1];
  const bottomBracket = WEALTH_BRACKETS[0];

  return {
    totalPopulation,
    billionaireCount: topBracket.population,
    povertyCount: bottomBracket.population,
    richestPerson: NOTABLE_BILLIONAIRES[0],
    // The ratio of the richest person's wealth to extreme poverty threshold
    wealthRatio: NOTABLE_BILLIONAIRES[0].wealth / 1000
  };
}
