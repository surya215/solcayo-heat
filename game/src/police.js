// The wanted level and the Solcayo police who answer it. Heat rises when the
// player commits crimes in sight of the law, cop cars spawn on nearby roads
// and chase, and the player is busted when a cop gets close while the player
// is slow or on foot. Lay low and the heat fades.
import { WANTED, WORLD } from './config.js';
import { randomRoadPoint, buildingAt } from './city.js';
import { makeCar, stepTrafficCar } from './traffic.js';

export function addWanted(state, amount, reason) {
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.wantedTimer = 0;
  state.timeSinceCrime = 0;
  state.lastCrime = reason;
  if (state.wanted > 0) state.banner = { text: `WANTED — ${reason}`, sub: `${state.wanted} star${state.wanted > 1 ? 's' : ''}`, t: 2.2 };
}

export function spawnCopCars(state, random) {
  const want = Math.min(WANTED.maxCopCars, state.wanted * WANTED.copCarsPerStar);
  while (state.cops.length < want) {
    const p = randomRoadPoint(random, state.player.x, state.player.y, 700);
    const cop = makeCar(random, p.x, p.y, undefined, { kind: 'cop', color: '#20242e', targetSpeed: 430 });
    cop.siren = random() * 2;
    state.cops.push(cop);
  }
  while (state.cops.length > want) state.cops.pop();
}

export function stepPolice(state, dt, random) {
  if (state.wanted > 0) {
    spawnCopCars(state, random);
    state.wantedTimer += dt;
    const nearCop = state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420);
    if (state.wantedTimer > WANTED.decaySeconds && !nearCop && state.timeSinceCrime > 6) {
      state.wanted -= 1;
      state.wantedTimer = 0;
    }
  } else {
    state.cops.length = 0;
  }
  state.timeSinceCrime += dt;
  const px = state.player.x;
  const py = state.player.y;
  for (const cop of state.cops) {
    cop.siren += dt;
    // Chase: steer straight at the player, faster than traffic, ramming on contact.
    const wantAngle = Math.atan2(py - cop.y, px - cop.x);
    let da = wantAngle - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    cop.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, da));
    const dist = Math.hypot(px - cop.x, py - cop.y);
    // Close in fast from afar, then creep up to the player instead of
    // overshooting past them at full speed.
    const wantSpeed = dist > 90 ? cop.targetSpeed : dist > 52 ? 60 : 25;
    cop.speed += Math.max(-420 * dt, Math.min(300 * dt, wantSpeed - cop.speed));
    const prevX = cop.x;
    const prevY = cop.y;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(30, Math.min(WORLD.width - 30, cop.x));
    cop.y = Math.max(30, Math.min(WORLD.height - 130, cop.y));
    // Cops cut corners chasing, but they do not drive through buildings.
    if (buildingAt(state.city, cop.x, cop.y, 13)) {
      cop.x = prevX;
      cop.y = prevY;
    }
    // Ram the player's car.
    if (state.player.inCar && state.player.car && dist < 46) {
      if ((cop.ramCd ?? 0) <= 0) {
        state.player.car.health -= 5;
        cop.ramCd = 1.5;
        cop.speed *= 0.55;
        state.player.car.speed *= 1 - 0.3;
      }
      if (state.random() < dt * 6) state.sparks.push({ x: cop.x, y: cop.y, vx: (random() - 0.5) * 200, vy: (random() - 0.5) * 200, t: 0.4, color: '#ffd23e' });
      if (state.player.car.health <= 0) state.player.car.health = 0;
    }
    if (cop.ramCd > 0) cop.ramCd -= dt;
    // Bust: a cop standing next to a player who is on foot, or in a car that
    // has all but stopped. A car still rolling through traffic can pull away.
    const playerSlow = state.player.inCar ? Math.abs(state.player.car.speed) < 10 : true;
    if (dist < 52 && playerSlow && state.wanted > 0) {
      state.bustTimer += dt;
      if (state.bustTimer > WANTED.bustSeconds) state.busted = true;
    }
  }
  if (state.cops.length === 0 || state.cops.every((c) => Math.hypot(c.x - px, c.y - py) > 52)) state.bustTimer = Math.max(0, state.bustTimer - dt * 0.5);
  void stepTrafficCar;
}
