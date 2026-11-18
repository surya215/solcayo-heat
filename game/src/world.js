// Solcayo Heat's simulation: the player on foot and behind the wheel,
// traffic, police, gunmen, bullets, shops and the save — everything that
// moves or changes, with no drawing in it. The renderer only reads this
// state, and the screenshots stage it through the same step function.
import { PLAYER, CAR, STEP, SAVE_KEY, PRICES, WORLD } from './config.js';
import { createCity, buildingAt, isWater, nearestRoadPoint, randomRoadPoint } from './city.js';
import { createTraffic, stepTrafficCar, stepPeds, respawnTraffic, makeCar } from './traffic.js';
import { stepPolice, addWanted } from './police.js';
import { MISSIONS, startMission, updateMission, objectiveText, missionTarget } from './missions.js';
import { createRandom } from './random.js';

export { objectiveText, missionTarget };

// Does a circle at (x, y) with radius r touch any building?
function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

// Move a circle, sliding along walls and water instead of entering them.
function slideCircle(city, x, y, dx, dy, r) {
  let nx = x + dx;
  let ny = y + dy;
  if (hitsBuilding(city, nx, y, r) || isWater(city, nx, y)) nx = x;
  if (hitsBuilding(city, x, ny, r) || isWater(city, x, ny)) ny = y;
  return { x: nx, y: ny };
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const spawn = { x: 1120, y: 1000 };
  const state = {
    seed,
    random,
    city,
    time: 0,
    clock: 17.6, // the game opens in the late afternoon
    player: {
      x: spawn.x, y: spawn.y, angle: -Math.PI / 2,
      health: PLAYER.health, armor: 0, ammo: PLAYER.startAmmo,
      inCar: false, car: null, carSpeed: 0, firing: false, fireTimer: 0,
      invulnerable: 0,
    },
    money: PLAYER.startMoney,
    wanted: 0,
    wantedTimer: 0,
    timeSinceCrime: 99,
    lastCrime: '',
    bustTimer: 0,
    busted: false,
    wasted: false,
    traffic: createTraffic(random, city, spawn.x, spawn.y),
    cops: [],
    escorts: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    sparks: [],
    mission: null,
    missionIndex: 0,
    completedMissions: 0,
    storyDone: false,
    banner: null,
    prompt: '',
    interactHeld: false,
    camera: { x: spawn.x, y: spawn.y },
    stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0, moneyEarned: 0 },
    crimeCooldown: 0,
    parkedCars: [],
  };
  // A few parked cars near the spawn the player can steal.
  for (let i = 0; i < 6; i += 1) {
    const p = randomRoadPoint(random, spawn.x, spawn.y, 900);
    state.parkedCars.push(makeCar(random, p.x, p.y, undefined, { kind: 'parked', speed: 0, targetSpeed: 120 }));
  }
  loadSave(state);
  return state;
}

export function loadSave(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.money === 'number') state.money = data.money;
    if (typeof data.completedMissions === 'number') state.completedMissions = data.completedMissions;
    if (typeof data.missionIndex === 'number') state.missionIndex = data.missionIndex;
    if (data.storyDone) state.storyDone = true;
    if (data.stats) state.stats = { ...state.stats, ...data.stats };
  } catch { /* a corrupt save is just ignored */ }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      completedMissions: state.completedMissions,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      stats: state.stats,
    }));
  } catch { /* storage can be off; the game still plays */ }
}

function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 70;
  for (const car of [...state.traffic.cars, ...state.parkedCars]) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  state.traffic.cars = state.traffic.cars.filter((c) => c !== car);
  state.parkedCars = state.parkedCars.filter((c) => c !== car);
  car.kind = 'player';
  p.inCar = true;
  p.car = car;
  p.carSpeed = car.speed;
  state.stats.carsStolen += 1;
  addWanted(state, 1, 'Mencuri mobil');
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const sideX = p.x + Math.cos(p.angle + Math.PI / 2) * 40;
  const sideY = p.y + Math.sin(p.angle + Math.PI / 2) * 40;
  const spot = slideCircle(state.city, sideX, sideY, 0, 0, PLAYER.radius);
  p.x = spot.x;
  p.y = spot.y;
  car.kind = 'parked';
  car.speed = 0;
  car.targetSpeed = 120;
  state.parkedCars.push(car);
  p.inCar = false;
  p.car = null;
}

function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.5);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.invulnerable = 0.3;
  if (p.health <= 0) {
    p.health = 0;
    state.wasted = true;
  }
}

function burst(state, x, y, audio) {
  for (let i = 0; i < 26; i += 1) {
    const a = state.random() * Math.PI * 2;
    const sp = 60 + state.random() * 260;
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0.5 + state.random() * 0.5,
      color: ['#ff9a3d', '#ff5a3d', '#3a3f4a'][Math.floor(state.random() * 3)],
      r: 4 + state.random() * 7,
    });
  }
  audio.crash();
}

function fireBullet(state, shooter, input, fromPlayer, audio) {
  const p = state.player;
  let tx;
  let ty;
  if (fromPlayer) {
    tx = state.camera.x - 640 + input.mouseX;
    ty = state.camera.y - 360 + input.mouseY;
  } else {
    tx = p.x;
    ty = p.y;
  }
  const angle = Math.atan2(ty - shooter.y, tx - shooter.x);
  const spread = fromPlayer ? 0.03 : 0.16;
  const a = angle + (state.random() - 0.5) * 2 * spread;
  state.bullets.push({
    x: shooter.x + Math.cos(a) * 24,
    y: shooter.y + Math.sin(a) * 24,
    vx: Math.cos(a) * 950,
    vy: Math.sin(a) * 950,
    life: 520 / 950,
    fromPlayer,
    damage: fromPlayer ? 34 : 9,
  });
  if (fromPlayer) {
    p.ammo -= 1;
    state.stats.shotsFired += 1;
    audio.shot();
    if (state.crimeCooldown <= 0 && state.wanted < 5) {
      addWanted(state, 1, 'Tembakan di jalanan');
      state.crimeCooldown = 5;
    }
  } else {
    audio.enemyShot();
  }
  state.sparks.push({
    x: shooter.x + Math.cos(a) * 26, y: shooter.y + Math.sin(a) * 26,
    vx: 0, vy: 0, t: 0.08, color: '#ffe9a8',
  });
}

function stepOnFoot(state, input, dt, audio) {
  const p = state.player;
  const dir = input.direction();
  const len = Math.hypot(dir.x, dir.y) || 1;
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const dx = (dir.x / len) * speed * dt;
  const dy = (dir.y / len) * speed * dt;
  if (dir.x !== 0 || dir.y !== 0) {
    const moved = slideCircle(state.city, p.x, p.y, dx, dy, PLAYER.radius);
    p.x = moved.x;
    p.y = moved.y;
    p.angle = Math.atan2(dy, dx);
  }
  p.x = Math.max(16, Math.min(WORLD.width - 16, p.x));
  p.y = Math.max(16, Math.min(WORLD.height - 110, p.y));
  p.firing = input.mouseDown && p.ammo > 0;
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.firing && p.fireTimer <= 0) {
    p.fireTimer = 0.22;
    fireBullet(state, p, input, true, audio);
  }
  void audio;
}

function stepDriving(state, input, dt, audio) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.inCar = false; return; }
  const dir = input.direction();
  const forward = dir.y < 0 ? 1 : dir.y > 0 ? -1 : 0;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += dir.x * CAR.steer * steerAuthority * Math.sign(car.speed) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = hitsBuilding(state.city, nx, ny, 13) || isWater(state.city, nx, ny);
  if (blocked) {
    const slideX = hitsBuilding(state.city, nx, car.y, 22) || isWater(state.city, nx, car.y);
    const slideY = hitsBuilding(state.city, car.x, ny, 22) || isWater(state.city, car.x, ny);
    if (!slideX) car.x = nx;
    if (!slideY) car.y = ny;
    if (slideX && slideY) {
      if (Math.abs(car.speed) > 240 && (car.crashCd ?? 0) <= 0) {
        car.health -= 8;
        car.crashCd = 0.8;
        audio.crash();
        state.sparks.push({ x: car.x, y: car.y, vx: 0, vy: 0, t: 0.3, color: '#ffd23e' });
      }
      car.speed *= 0.45;
    }
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
  car.y = Math.max(24, Math.min(WORLD.height - 118, car.y));
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.carSpeed = car.speed;
  // Running over pedestrians is a crime.
  for (const ped of state.traffic.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34 && Math.abs(car.speed) > 120) {
      ped.down = 2.5;
      ped.vx = Math.cos(car.angle) * 260;
      ped.vy = Math.sin(car.angle) * 260;
      if (state.crimeCooldown <= 0) {
        addWanted(state, 1, 'Menabrak pejalan kaki');
        state.crimeCooldown = 4;
      }
    }
  }
  // Shove other cars aside, and take damage in a hard hit.
  for (const other of [...state.traffic.cars, ...state.cops, ...state.escorts]) {
    if (other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < 48) {
      const push = (48 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      other.x += ux * push;
      other.y += uy * push;
      car.x -= ux * push * 0.4;
      car.y -= uy * push * 0.4;
      if (Math.abs(car.speed) > 200 && (car.dmgCd ?? 0) <= 0) {
        other.health -= 12;
        car.health -= 4;
        car.dmgCd = 1;
        audio.crash();
      }
    }
  }
  if (car.crashCd > 0) car.crashCd -= dt;
  if (car.dmgCd > 0) car.dmgCd -= dt;
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    burst(state, car.x, car.y, audio);
    exitCar(state);
    state.player.health -= 25;
  }
}

function stepGunmen(state, dt, audio) {
  const p = state.player;
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (d > 240) {
      const moved = slideCircle(state.city, e.x, e.y, (dx / d) * 150 * dt, (dy / d) * 150 * dt, 12);
      e.x = moved.x;
      e.y = moved.y;
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 520) {
      e.fireTimer = 1.1 + state.random() * 0.9;
      fireBullet(state, e, null, false, audio);
    }
  }
}

function dropPickup(state, x, y, kind) {
  state.pickups.push({ x, y, kind, t: 0 });
}

function stepBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (buildingAt(state.city, b.x, b.y) || isWater(state.city, b.x, b.y)) {
      b.life = 0;
      state.sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0.15, color: '#ffd23e' });
      continue;
    }
    if (b.fromPlayer) {
      let spent = false;
      for (const e of state.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= b.damage;
          b.life = 0;
          state.sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0.2, color: '#ff6b5e' });
          if (e.hp <= 0) {
            state.enemies = state.enemies.filter((o) => o !== e);
            if (state.random() < 0.5) dropPickup(state, e.x, e.y, 'ammo');
            else if (state.random() < 0.4) dropPickup(state, e.x, e.y, 'money');
          }
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (const car of [...state.traffic.cars, ...state.cops, ...state.escorts, ...state.parkedCars]) {
        if (car.dead) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.health -= b.damage;
          b.life = 0;
          if (car.health <= 0 && !car.dead) {
            car.dead = true;
            burst(state, car.x, car.y, { crash() {} });
          }
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (const ped of state.traffic.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.down = 3;
          ped.vx = b.vx * 0.2;
          ped.vy = b.vy * 0.2;
          b.life = 0;
          if (state.crimeCooldown <= 0) {
            addWanted(state, 1, 'Menembak warga');
            state.crimeCooldown = 4;
          }
          break;
        }
      }
    } else if (Math.hypot(p.x - b.x, p.y - b.y) < 15) {
      b.life = 0;
      hurtPlayer(state, b.damage);
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

function stepPickups(state, dt, audio) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.t += dt;
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'ammo') { p.ammo += 24; audio.pickup(); }
      if (pk.kind === 'health') { p.health = Math.min(100, p.health + 30); audio.pickup(); }
      if (pk.kind === 'money') { state.money += 50; state.stats.moneyEarned += 50; audio.pickup(); }
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken && pk.t < 30);
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2 * dt;
    pt.vy *= 1 - 2 * dt;
    pt.t -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.t > 0);
  for (const s of state.sparks) s.t -= dt;
  state.sparks = state.sparks.filter((s) => s.t > 0);
}

// The three shops: Taller Sol (repair + clear wanted), Toko Senjata Baja
// (ammo) and Klinik Mar (health + armor).
function stepShops(state, audio) {
  const p = state.player;
  const places = state.city.places;
  const near = (place, r) => Math.hypot(p.x - place.x, p.y - place.y) < r;
  let prompt = '';
  if (near(places.taller, 90)) {
    prompt = p.inCar ? 'E — Taller Sol: reparasi + hapus buronan ($150)' : 'E — Taller Sol: hapus buronan ($150)';
    if (state.interactPressed) {
      if (state.money >= PRICES.clearWanted) {
        state.money -= PRICES.clearWanted;
        if (p.car) p.car.health = 100;
        state.wanted = 0;
        state.cops.length = 0;
        state.banner = { text: 'Taller Sol', sub: 'Mobil diperbaiki, buronan bersih.', t: 2.5 };
        audio.pickup();
      } else {
        state.banner = { text: 'Uang tidak cukup', sub: `Butuh $${PRICES.clearWanted}.`, t: 2 };
      }
    }
  } else if (near(places.gunshop, 80)) {
    prompt = 'E — Toko Senjata: beli amunisi +48 ($80)';
    if (state.interactPressed && state.money >= PRICES.ammoBox) {
      state.money -= PRICES.ammoBox;
      p.ammo += 48;
      audio.pickup();
      state.banner = { text: 'Toko Senjata Baja', sub: 'Amunisi +48.', t: 2 };
    }
  } else if (near(places.clinic, 80)) {
    prompt = 'E — Klinik Mar: pulihkan kesehatan ($60)';
    if (state.interactPressed && state.money >= PRICES.heal) {
      state.money -= PRICES.heal;
      p.health = 100;
      p.armor = 50;
      audio.pickup();
      state.banner = { text: 'Klinik Mar', sub: 'Sehat dan berarmor lagi.', t: 2 };
    }
  }
  state.prompt = prompt;
}

function spawnTargetCar(state, kind) {
  const p = state.player;
  const spot = randomRoadPoint(state.random, p.x, p.y, 600);
  const car = makeCar(state.random, spot.x, spot.y, undefined, {
    kind: kind === 'destroy' ? 'limo' : 'courier',
    color: kind === 'destroy' ? '#14141c' : '#e8c53a',
    health: kind === 'destroy' ? 170 : 100,
    targetSpeed: 380,
  });
  state.mission.targetCar = car;
  if (kind === 'destroy') {
    for (let i = 0; i < 2; i += 1) {
      const escort = makeCar(state.random, spot.x + 60 * (i ? 1 : -1), spot.y + 40, undefined, {
        kind: 'escort', color: '#3a2a2a', targetSpeed: 400,
      });
      state.escorts.push(escort);
    }
  }
}

// The mission's target car flees from the player, staying on roads when
// it can; its escorts ram the player like cop cars.
function stepTargetCar(state, dt) {
  const m = state.mission;
  if (!m || !m.targetCar || m.targetCar.dead) return;
  const car = m.targetCar;
  const p = state.player;
  const away = Math.atan2(car.y - p.y, car.x - p.x);
  const road = nearestRoadPoint(car.x + Math.cos(away) * 120, car.y + Math.sin(away) * 120);
  const wantAngle = Math.atan2(road.y - car.y, road.x - car.x);
  let da = wantAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  car.angle += Math.max(-3 * dt, Math.min(3 * dt, da));
  car.speed += Math.max(-300 * dt, Math.min(220 * dt, car.targetSpeed - car.speed));
  const prevX = car.x;
  const prevY = car.y;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsBuilding(state.city, nx, ny, 13) && !isWater(state.city, nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.angle += Math.PI / 2;
    car.speed *= 0.6;
  }
  if (buildingAt(state.city, car.x, car.y, 13)) {
    car.x = prevX;
    car.y = prevY;
  }
  if (car.health < 50 && state.random() < dt * 2) {
    state.particles.push({
      x: car.x, y: car.y - 10, vx: (state.random() - 0.5) * 40, vy: -40,
      t: 0.6, color: '#3a3f4a', r: 5,
    });
  }
  for (const e of state.escorts) {
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    let eda = want - e.angle;
    while (eda > Math.PI) eda -= Math.PI * 2;
    while (eda < -Math.PI) eda += Math.PI * 2;
    e.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, eda));
    e.speed += Math.max(-400 * dt, Math.min(300 * dt, e.targetSpeed - e.speed));
    const ePrevX = e.x;
    const ePrevY = e.y;
    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;
    if (buildingAt(state.city, e.x, e.y, 13)) {
      e.x = ePrevX;
      e.y = ePrevY;
    }
    if (state.player.inCar && state.player.car && Math.hypot(e.x - p.x, e.y - p.y) < 48) {
      state.player.car.health -= 10 * dt;
    }
  }
}

function spawnGunmen(state, count, x, y) {
  state.mission.spawned = count;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    state.enemies.push({
      x: x + Math.cos(a) * (90 + state.random() * 90),
      y: y + Math.sin(a) * (90 + state.random() * 90),
      angle: 0, hp: 60, fireTimer: 0.5 + state.random(),
    });
  }
}

// What the mission code is allowed to do to the world.
export function missionApi(state, audio) {
  return {
    crime: (n, reason) => addWanted(state, n, reason),
    spawnTargetCar: () => {
      const stage = state.mission.def.stages[state.mission.stage];
      spawnTargetCar(state, stage.type);
    },
    spawnGunmen: (s, count, x, y) => spawnGunmen(s, count, x, y),
    save: () => saveGame(state),
  };
}

// After an arrest or a death: a $100 fine, the heat cleared, the player
// back at the hideout, and the current mission restarted.
function afterArrest(state, audio) {
  const p = state.player;
  state.money = Math.max(0, state.money - 100);
  state.wanted = 0;
  state.cops.length = 0;
  state.escorts.length = 0;
  state.enemies.length = 0;
  p.health = 100;
  p.armor = 0;
  p.inCar = false;
  p.car = null;
  const home = state.city.places.hideout;
  p.x = home.x;
  p.y = home.y;
  state.busted = false;
  state.wasted = false;
  state.banner = { text: 'Kau bebas lagi', sub: 'Denda $100. Misi dimulai ulang.', t: 3 };
  audio.busted();
  if (state.mission) startMission(state, state.mission.index, missionApi(state, audio));
}

export function stepWorld(state, input, dt, audio, actions) {
  const p = state.player;
  state.time += dt;
  state.clock = (17.6 + state.time / 90) % 24; // 90 seconds of play = 1 game hour
  state.crimeCooldown = Math.max(0, state.crimeCooldown - dt);
  if (p.invulnerable > 0) p.invulnerable -= dt;
  state.interactHeld = input.keys.has('e');
  state.interactPressed = Boolean(actions & 4);

  // N starts the next mission; E enters or exits the nearest car.
  if (actions & 16) {
    if (!state.mission && state.completedMissions < MISSIONS.length) {
      state.missionIndex = state.completedMissions;
      startMission(state, state.missionIndex, missionApi(state, audio));
      audio.mission();
    }
  }
  if (actions & 4 && !p.inCar) {
    const car = nearestStealableCar(state);
    if (car) enterCar(state, car);
  } else if (actions & 4 && p.inCar) {
    exitCar(state);
  }

  if (p.inCar) stepDriving(state, input, dt, audio);
  else stepOnFoot(state, input, dt, audio);

  for (const car of state.traffic.cars) stepTrafficCar(car, [...state.traffic.cars, ...state.cops], dt, state.random, state.city);
  respawnTraffic(state.traffic, state.random, p.x, p.y);
  stepPeds(state.traffic.peds, p, state.traffic.cars, dt, state.random);
  for (const ped of state.traffic.peds) {
    if (ped.down) {
      ped.down -= dt;
      ped.x += (ped.vx ?? 0) * dt;
      ped.y += (ped.vy ?? 0) * dt;
      if (ped.down <= 0) {
        const spot = randomRoadPoint(state.random, p.x, p.y, 800);
        ped.x = spot.x;
        ped.y = spot.y;
        ped.down = 0;
      }
    }
  }
  stepPolice(state, dt, state.random);
  stepTargetCar(state, dt);
  stepGunmen(state, dt, audio);
  stepBullets(state, dt);
  stepPickups(state, dt, audio);
  stepParticles(state, dt);
  stepShops(state, audio);
  updateMission(state, dt, missionApi(state, audio));

  if (state.busted || state.wasted) {
    const wasBusted = state.busted;
    afterArrest(state, audio);
    state.endScreen = wasBusted ? 'busted' : 'wasted';
  }
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  // The camera follows the player smoothly, clamped to the world.
  const tx = Math.max(640, Math.min(WORLD.width - 640, p.x));
  const ty = Math.max(360, Math.min(WORLD.height - 360, p.y));
  state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);
  audio.setEngine(p.inCar ? Math.abs(p.carSpeed ?? 0) / 560 : 0, p.inCar);
  audio.setSiren(state.wanted > 0);
  void STEP;
}
