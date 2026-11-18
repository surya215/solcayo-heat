// Solcayo's map: a sun-soaked island city on a road grid, with a beach on the
// south shore, a marina on the east waterfront, a central park and five
// named places the story uses. Everything is generated from one seed, so the
// same seed always builds the same city.
import { WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

export const ROAD_WIDTH = 72;
export const AVENUES = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const STREETS = [160, 480, 800, 1120, 1440, 1760];

const ROOF_COLORS = ['#c9a37e', '#b98d68', '#d8b48f', '#a8b6c4', '#c4b49a', '#9fb3a4', '#d0a0a0', '#b3a6c9'];
const WALL_COLORS = ['#e8dcc8', '#f2e6d0', '#dfe8ee', '#f6e3c8', '#e3d5e8', '#d5e8d5'];

function isParkBlock(col, row) {
  return col === 2 && row === 2; // between avenues 800/1120 and streets 800/1120
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  for (let col = 0; col < AVENUES.length - 1; col += 1) {
    for (let row = 0; row < STREETS.length - 1; row += 1) {
      const x0 = AVENUES[col] + ROAD_WIDTH / 2 + 14;
      const x1 = AVENUES[col + 1] - ROAD_WIDTH / 2 - 14;
      const y0 = STREETS[row] + ROAD_WIDTH / 2 + 14;
      const y1 = STREETS[row + 1] - ROAD_WIDTH / 2 - 14;
      if (isParkBlock(col, row)) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 12, 20) });
        }
        continue;
      }
      // A 2x2 grid of plots per block, one building per plot with jitter, so
      // every block reads as built-up. The south row borders the beach: one
      // row of plots only, lower and sparser.
      const rows = row === STREETS.length - 2 ? 1 : 2;
      const cw = (x1 - x0) / 2;
      const ch = (y1 - y0) / rows;
      for (let gx = 0; gx < 2; gx += 1) {
        for (let gy = 0; gy < rows; gy += 1) {
          if (random() < 0.18) continue;
          const w = range(random, 52, Math.max(56, cw - 18));
          const h = range(random, 46, Math.max(50, ch - 18));
          const x = x0 + gx * cw + range(random, 4, Math.max(5, cw - w - 4));
          const y = y0 + gy * ch + range(random, 4, Math.max(5, ch - h - 4));
          buildings.push({ x, y, w, h, roof: pick(random, ROOF_COLORS), wall: pick(random, WALL_COLORS), tall: random() < 0.3 });
        }
      }
      for (let i = 0; i < 3; i += 1) {
        trees.push({ x: range(random, x0, x1), y: range(random, y0, y1), r: range(random, 9, 14) });
      }
    }
  }
  // Palm row along the beach.
  for (let x = 120; x < WORLD.width - 80; x += 90) {
    trees.push({ x: x + range(random, -14, 14), y: 1810 + range(random, -8, 8), r: range(random, 12, 18), palm: true });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) lamps.push({ x: ax + ROAD_WIDTH / 2 + 6, y: sy - ROAD_WIDTH / 2 - 6 });
  }
  return {
    buildings,
    trees,
    lamps,
    park: { x: AVENUES[2] + ROAD_WIDTH / 2, y: STREETS[2] + ROAD_WIDTH / 2, w: 320 - ROAD_WIDTH, h: 320 - ROAD_WIDTH },
    beach: { x: 0, y: 1796, w: WORLD.width, h: WORLD.height - 1796 },
    ocean: { x: 0, y: 1864, w: WORLD.width, h: WORLD.height - 1864 },
    marina: { x: 2436, y: 120, w: WORLD.width - 2436, h: 1640 },
    places: {
      bar: { name: "La Voz Bar", x: 560, y: 400, kind: 'bar' },
      hideout: { name: 'Rumah Jax', x: 2000, y: 1520, kind: 'hideout' },
      taller: { name: 'Taller Sol', x: 1240, y: 1520, kind: 'taller' },
      gunshop: { name: 'Toko Senjata Baja', x: 1880, y: 720, kind: 'gunshop' },
      clinic: { name: 'Klinik Mar', x: 880, y: 1520, kind: 'clinic' },
      marinaGate: { name: 'Marina Solcayo', x: 2320, y: 1120, kind: 'marina' },
      packageSpot: { name: 'Gudang Utara', x: 1440, y: 200, kind: 'pickup' },
    },
  };
}

export function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_WIDTH / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_WIDTH / 2) return true;
  return false;
}

export function isWater(city, x, y) {
  const o = city.ocean;
  if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true;
  const m = city.marina;
  return x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h;
}

export function isBeach(city, x, y) {
  const b = city.beach;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && !isWater(city, x, y);
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

/** The nearest point on a road centreline (avenue or street) to x,y. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y: Math.max(0, Math.min(WORLD.height, y)) }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x: Math.max(0, Math.min(WORLD.width, x)), y: sy }; }
  }
  return best;
}

export function randomRoadPoint(random, cx, cy, radius) {
  for (let tries = 0; tries < 20; tries += 1) {
    const horizontal = random() < 0.5;
    if (horizontal) {
      const sy = pick(random, STREETS);
      const x = cx + (random() * 2 - 1) * radius;
      if (x > 40 && x < WORLD.width - 40 && Math.abs(sy - cy) < radius + 320) return { x, y: sy };
    } else {
      const ax = pick(random, AVENUES);
      const y = cy + (random() * 2 - 1) * radius;
      if (y > 40 && y < WORLD.height - 120 && Math.abs(ax - cx) < radius + 320) return { x: ax, y };
    }
  }
  return { x: 1120, y: 1120 };
}

/** A sidewalk point beside a road, where pedestrians walk. */
export function sidewalkPoint(random, cx, cy, radius) {
  const p = randomRoadPoint(random, cx, cy, radius);
  const onAvenue = AVENUES.some((ax) => Math.abs(p.x - ax) < 1);
  if (onAvenue) p.x += random() < 0.5 ? ROAD_WIDTH / 2 + 12 : -(ROAD_WIDTH / 2 + 12);
  else p.y += random() < 0.5 ? ROAD_WIDTH / 2 + 12 : -(ROAD_WIDTH / 2 + 12);
  return p;
}
