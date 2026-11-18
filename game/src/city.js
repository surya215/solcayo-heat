// Solcayo's map: a sun-soaked island city on a road grid. A beach runs
// along the south shore, a marina lines the east waterfront, a park sits
// in the middle, and five named places anchor the story. The whole map is
// generated from one seed, so the same seed always builds the same city.
import { WORLD } from './config.js';
import { pick, range } from './random.js';

export const ROAD_WIDTH = 72;
export const AVENUES = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const STREETS = [160, 480, 800, 1120, 1440, 1760];

const ROOFS = ['#c9a37e', '#b98d68', '#d8b48f', '#a8b6c4', '#c4b49a', '#9fb3a4', '#d0a0a0', '#b3a6c9'];
const WALLS = ['#e8dcc8', '#f2e6d0', '#dfe8ee', '#f6e3c8', '#e3d5e8', '#d5e8d5'];

// The one park block: between avenues 800/1120 and streets 800/1120.
const PARK_COL = 2;
const PARK_ROW = 2;

function scatterTrees(random, list, x0, x1, y0, y1, count, palm) {
  for (let i = 0; i < count; i += 1) {
    list.push({
      x: range(random, x0, x1),
      y: range(random, y0, y1),
      r: range(random, palm ? 12 : 9, palm ? 18 : 14),
      palm: Boolean(palm),
    });
  }
}

function fillBlock(random, city, col, row) {
  const x0 = AVENUES[col] + ROAD_WIDTH / 2 + 14;
  const x1 = AVENUES[col + 1] - ROAD_WIDTH / 2 - 14;
  const y0 = STREETS[row] + ROAD_WIDTH / 2 + 14;
  const y1 = STREETS[row + 1] - ROAD_WIDTH / 2 - 14;
  if (col === PARK_COL && row === PARK_ROW) {
    scatterTrees(random, city.trees, x0 + 20, x1 - 20, y0 + 20, y1 - 20, 14, false);
    return;
  }
  // Two columns of plots, two rows (one row on the south edge, where the
  // beach begins), one building per plot with jitter, so every block reads
  // as built-up. A few plots stay empty.
  const rows = row === STREETS.length - 2 ? 1 : 2;
  const plotW = (x1 - x0) / 2;
  const plotH = (y1 - y0) / rows;
  for (let gx = 0; gx < 2; gx += 1) {
    for (let gy = 0; gy < rows; gy += 1) {
      if (random() < 0.18) continue;
      const w = range(random, 52, Math.max(56, plotW - 18));
      const h = range(random, 46, Math.max(50, plotH - 18));
      city.buildings.push({
        x: x0 + gx * plotW + range(random, 4, Math.max(5, plotW - w - 4)),
        y: y0 + gy * plotH + range(random, 4, Math.max(5, plotH - h - 4)),
        w,
        h,
        roof: pick(random, ROOFS),
        wall: pick(random, WALLS),
        tall: random() < 0.3,
      });
    }
  }
  scatterTrees(random, city.trees, x0, x1, y0, y1, 3, false);
}

export function createCity(random) {
  const city = { buildings: [], trees: [], lamps: [] };
  for (let col = 0; col < AVENUES.length - 1; col += 1) {
    for (let row = 0; row < STREETS.length - 1; row += 1) fillBlock(random, city, col, row);
  }
  // A row of palms along the beach.
  for (let x = 120; x < WORLD.width - 80; x += 90) {
    city.trees.push({ x: x + range(random, -14, 14), y: 1810 + range(random, -8, 8), r: range(random, 12, 18), palm: true });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) city.lamps.push({ x: ax + ROAD_WIDTH / 2 + 6, y: sy - ROAD_WIDTH / 2 - 6 });
  }
  city.park = {
    x: AVENUES[2] + ROAD_WIDTH / 2,
    y: STREETS[2] + ROAD_WIDTH / 2,
    w: 320 - ROAD_WIDTH,
    h: 320 - ROAD_WIDTH,
  };
  city.beach = { x: 0, y: 1796, w: WORLD.width, h: WORLD.height - 1796 };
  city.ocean = { x: 0, y: 1864, w: WORLD.width, h: WORLD.height - 1864 };
  city.marina = { x: 2436, y: 120, w: WORLD.width - 2436, h: 1640 };
  city.places = {
    bar: { name: 'La Voz Bar', x: 560, y: 400, kind: 'bar' },
    hideout: { name: 'Rumah Jax', x: 2000, y: 1520, kind: 'hideout' },
    taller: { name: 'Taller Sol', x: 1240, y: 1520, kind: 'taller' },
    gunshop: { name: 'Toko Senjata Baja', x: 1880, y: 720, kind: 'gunshop' },
    clinic: { name: 'Klinik Mar', x: 880, y: 1520, kind: 'clinic' },
    marinaGate: { name: 'Marina Solcayo', x: 2320, y: 1120, kind: 'marina' },
    packageSpot: { name: 'Gudang Utara', x: 1440, y: 200, kind: 'pickup' },
  };
  return city;
}

export function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_WIDTH / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_WIDTH / 2) return true;
  return false;
}

function inside(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function isWater(city, x, y) {
  return inside(city.ocean, x, y) || inside(city.marina, x, y);
}

export function isBeach(city, x, y) {
  return inside(city.beach, x, y) && !isWater(city, x, y);
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

// The nearest point on a road centreline (an avenue or a street) to x, y.
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

// A random point on a road near (cx, cy).
export function randomRoadPoint(random, cx, cy, radius) {
  for (let tries = 0; tries < 20; tries += 1) {
    if (random() < 0.5) {
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

// A point on the sidewalk beside a road, where pedestrians walk.
export function sidewalkPoint(random, cx, cy, radius) {
  const p = randomRoadPoint(random, cx, cy, radius);
  const onAvenue = AVENUES.some((ax) => Math.abs(p.x - ax) < 1);
  const shift = ROAD_WIDTH / 2 + 12;
  if (onAvenue) p.x += random() < 0.5 ? shift : -shift;
  else p.y += random() < 0.5 ? shift : -shift;
  return p;
}
