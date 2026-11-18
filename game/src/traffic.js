// Traffic cars that follow Solcayo's roads, and pedestrians who walk the
// sidewalks and run from trouble. Both spawn near the player and despawn
// far away, so the city always feels alive around the camera.
import { TRAFFIC, PEDS, WORLD } from './config.js';
import { AVENUES, STREETS, isOnRoad, nearestRoadPoint, randomRoadPoint, sidewalkPoint, buildingAt } from './city.js';
import { pick, range } from './random.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c53a', '#7ac74f', '#e8e8e8', '#2b2f38', '#c96fd0', '#e8912d', '#4fc3c3'];
const PED_COLORS = ['#e8b04b', '#7a5fd0', '#4fae62', '#d06f8a', '#5f8fd0', '#c2c2c2', '#e07b39'];

// Which way a point on the road faces: an avenue runs north/south, a
// street east/west; at a crossing either is fine.
export function roadAxis(random, x, y) {
  const onAvenue = AVENUES.some((ax) => Math.abs(x - ax) < 2);
  const onStreet = STREETS.some((sy) => Math.abs(y - sy) < 2);
  const axis = onAvenue && !onStreet ? 'y' : onStreet && !onAvenue ? 'x' : random() < 0.5 ? 'x' : 'y';
  const dir = random() < 0.5 ? 1 : -1;
  const angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  return { axis, dir, angle };
}

export function makeCar(random, x, y, angle, opts = {}) {
  // A car faces along the road it sits on: an avenue means north/south, a
  // street east/west. A random facing would point it across a block,
  // straight into the buildings.
  const derived = roadAxis(random, x, y);
  const axis = opts.axis ?? derived.axis;
  const dir = opts.dir ?? derived.dir;
  const facing = angle ?? (axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
  return {
    x, y, angle: facing, speed: opts.speed ?? 0,
    color: opts.color ?? pick(random, CAR_COLORS),
    kind: opts.kind ?? 'traffic',
    health: opts.health ?? 100,
    targetSpeed: opts.targetSpeed ?? range(random, TRAFFIC.speedMin, TRAFFIC.speedMax),
    axis,
    dir,
    lane: opts.lane ?? (random() < 0.5 ? 1 : -1),
    stuck: 0,
  };
}

// The next crossing ahead of a car on its own axis, or null at the edge.
function nextCrossing(car) {
  if (car.axis === 'x') {
    const ahead = STREETS.filter((sy) => (car.dir > 0 ? sy > car.y + 4 : sy < car.y - 4));
    return ahead.length ? (car.dir > 0 ? Math.min(...ahead) : Math.max(...ahead)) : null;
  }
  const ahead = AVENUES.filter((ax) => (car.dir > 0 ? ax > car.x + 4 : ax < car.x - 4));
  return ahead.length ? (car.dir > 0 ? Math.min(...ahead) : Math.max(...ahead)) : null;
}

// Is another car directly ahead within `dist`?
function blockedAhead(cars, car, dist) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  for (const o of cars) {
    if (o === car) continue;
    const rx = o.x - car.x;
    const ry = o.y - car.y;
    const along = rx * dx + ry * dy;
    const side = Math.abs(-rx * dy + ry * dx);
    if (along > 0 && along < dist && side < 30) return true;
  }
  return false;
}

function clampTurn(car, targetAngle, dt) {
  let da = targetAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  car.angle += Math.max(-3 * dt, Math.min(3 * dt, da));
  return da;
}

export function stepTrafficCar(car, cars, dt, random, city) {
  const prevX = car.x;
  const prevY = car.y;
  const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const da = clampTurn(car, targetAngle, dt);
  const want = blockedAhead(cars, car, 70) ? 0 : car.targetSpeed;
  car.speed += Math.max(-260 * dt, Math.min(160 * dt, want - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Keep to the right side of the road.
  const lane = car.lane * 18;
  if (car.axis === 'x') {
    const wantY = nearestRoadPoint(car.x, car.y).y + lane;
    car.y += Math.max(-60 * dt, Math.min(60 * dt, wantY - car.y));
  } else {
    const wantX = nearestRoadPoint(car.x, car.y).x + lane;
    car.x += Math.max(-60 * dt, Math.min(60 * dt, wantX - car.x));
  }
  // Turn around at the map edge instead of driving off it.
  if (car.x < 30 || car.x > WORLD.width - 30 || car.y < 30 || car.y > WORLD.height - 140) {
    car.dir *= -1;
    car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD.height - 150, car.y));
  }
  // A shove from the player's car can push a traffic car off the road;
  // it slides back instead of driving through a building.
  if (city && buildingAt(city, car.x, car.y, 13)) {
    car.x = prevX;
    car.y = prevY;
  }
  // At a crossing, sometimes turn onto the other road, sometimes U-turn.
  const cross = nextCrossing(car);
  if (cross !== null) {
    const dist = car.axis === 'x' ? Math.abs(cross - car.y) : Math.abs(cross - car.x);
    if (dist < 26 && Math.abs(da) < 0.2) {
      if (random() < 0.45) {
        car.axis = car.axis === 'x' ? 'y' : 'x';
        car.dir = random() < 0.5 ? 1 : -1;
        car.lane = random() < 0.5 ? 1 : -1;
      } else if (random() < 0.12) {
        car.dir *= -1;
      }
    }
  }
}

export function createTraffic(random, city, px, py) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const p = randomRoadPoint(random, px, py, TRAFFIC.spawnRadius);
    cars.push(makeCar(random, p.x, p.y, undefined, {}));
  }
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const p = sidewalkPoint(random, px, py, TRAFFIC.spawnRadius);
    peds.push({
      x: p.x, y: p.y, angle: random() * Math.PI * 2,
      speed: range(random, PEDS.walkMin, PEDS.walkMax),
      color: pick(random, PED_COLORS), flee: 0, fx: 0, fy: 0,
    });
  }
  return { cars, peds };
}

// Move anything too far from the player back to a road nearby.
export function respawnTraffic(traffic, random, px, py) {
  for (const car of traffic.cars) {
    if (Math.hypot(car.x - px, car.y - py) > TRAFFIC.despawnRadius) {
      const p = randomRoadPoint(random, px, py, TRAFFIC.spawnRadius);
      car.x = p.x; car.y = p.y; car.speed = 0;
      const derived = roadAxis(random, p.x, p.y);
      car.axis = derived.axis;
      car.dir = derived.dir;
      car.angle = derived.angle;
    }
  }
  for (const ped of traffic.peds) {
    if (Math.hypot(ped.x - px, ped.y - py) > TRAFFIC.despawnRadius) {
      const p = sidewalkPoint(random, px, py, TRAFFIC.spawnRadius);
      ped.x = p.x; ped.y = p.y; ped.flee = 0;
    }
  }
}

export function stepPeds(peds, player, cars, dt, random) {
  for (const ped of peds) {
    let threat = null;
    if (player && Math.hypot(ped.x - player.x, ped.y - player.y) < 130) {
      const rushing = player.inCar ? Math.abs(player.carSpeed ?? 0) > 200 : (player.firing ?? false);
      if (rushing || player.firing) threat = player;
    }
    if (!threat) {
      for (const c of cars) {
        if (Math.hypot(ped.x - c.x, ped.y - c.y) < 70 && Math.abs(c.speed) > 120) { threat = c; break; }
      }
    }
    if (threat) {
      ped.flee = 1.2;
      ped.fx = ped.x - threat.x;
      ped.fy = ped.y - threat.y;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const len = Math.hypot(ped.fx, ped.fy) || 1;
      ped.angle = Math.atan2(ped.fy / len, ped.fx / len);
      ped.x += Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
      ped.y += Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!isOnRoad(ped.x, ped.y) && random() < 0.02) ped.angle += (random() - 0.5) * 2.4;
      if (random() < 0.004) ped.angle = random() * Math.PI * 2;
    }
    ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD.height - 100, ped.y));
  }
}
