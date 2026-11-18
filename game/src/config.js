// Solcayo Heat — one place for every number the game tunes by.
// The island is a fixed 2560x1920 world. The camera shows a 1280x720
// window of it and follows the player, so no rule here depends on the
// size of the browser window.
export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60; // fixed simulation step, seconds

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 350,
  health: 100,
  armor: 50,
  startAmmo: 48,
  startMoney: 150,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 560,
  maxReverse: 160,
  steer: 2.6,
  grip: 6.0,
  health: 100,
};

// How many cars and walkers the city keeps around the player.
export const TRAFFIC = {
  cars: 14,
  speedMin: 95,
  speedMax: 150,
  spawnRadius: 900,
  despawnRadius: 1200,
};
export const PEDS = { count: 26, walkMin: 45, walkMax: 80, fleeSpeed: 190 };

export const WANTED = {
  max: 5,
  decaySeconds: 14, // quiet seconds before one star fades
  copCarsPerStar: 1,
  maxCopCars: 6,
  bustSeconds: 1.6, // a cop beside a slow player arrests them after this long
};

export const BULLET = {
  speed: 950,
  range: 520,
  damage: 34,
  enemyDamage: 9,
  fireDelay: 0.22,
};

export const PRICES = {
  repair: 120,
  clearWanted: 150,
  ammoBox: 80,
  armor: 100,
  heal: 60,
};

export const PALETTE = {
  ocean: '#1e7fa8',
  oceanDeep: '#14648a',
  sand: '#e8d29a',
  sandDark: '#d9c184',
  grass: '#5da24a',
  grassDark: '#4c8a3d',
  road: '#3a3f4a',
  roadEdge: '#2c303a',
  lane: '#e8d44d',
  sidewalk: '#9aa0ab',
  buildingRoof: '#c9a37e',
  text: '#f4f1e8',
  muted: '#b9b3a4',
  panel: 'rgba(12, 16, 24, 0.78)',
  hudAccent: '#ffb02e',
  wantedStar: '#ffd23e',
  policeBlue: '#3a7bff',
  policeRed: '#ff3b30',
  money: '#7ee081',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Trebuchet MS", system-ui, sans-serif';

export const SAVE_KEY = 'solcayo-heat.save.v1';
export const BEST_KEY = 'solcayo-heat.best.v1';
