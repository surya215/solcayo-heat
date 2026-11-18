// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of seconds,
// steered by a simple autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { AVENUES, STREETS } from './city.js';
import { startMission } from './missions.js';
import { missionApi } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const noopAudio = {
  shot() {}, enemyShot() {}, crash() {}, pickup() {}, mission() {}, busted() {},
  setEngine() {}, setSiren() {}, toggleMute() {}, unlock() {},
};

function fakeInput() {
  return {
    keys: new Set(),
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    direction: () => ({ x: 0, y: 0 }),
    running: () => false,
  };
}

/**
 * A road-following driver for the screenshot scenes: it hops from one
 * intersection to the next, always along a road, steering at the far target
 * so small drifts correct themselves instead of swinging the car around.
 */
export function makeRoadDriver(state) {
  let target = null;
  let prev = null;
  // The car only ever heads for an intersection next to the one it is at:
  // steering straight at a far intersection cuts diagonally across blocks
  // and wedges the car against a building.
  function nearestIntersection(x, y) {
    const ax = AVENUES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const sy = STREETS.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
    return { x: ax, y: sy };
  }
  function pickTarget() {
    const c = state.player.car;
    const cur = nearestIntersection(c.x, c.y);
    const cands = [];
    for (const ax of AVENUES) {
      if (Math.abs(ax - cur.x) === 320) cands.push({ x: ax, y: cur.y });
    }
    for (const sy of STREETS) {
      if (Math.abs(sy - cur.y) === 320) cands.push({ x: cur.x, y: sy });
    }
    const fresh = cands.filter((n) => !(prev && n.x === prev.x && n.y === prev.y));
    const pool = fresh.length > 0 ? fresh : cands;
    // Prefer the neighbour most aligned with the heading, so the car runs
    // straight down roads and only turns when the grid forces it to.
    const dx = Math.cos(c.angle);
    const dy = Math.sin(c.angle);
    pool.sort((a, b) => ((b.x - cur.x) * dx + (b.y - cur.y) * dy) - ((a.x - cur.x) * dx + (a.y - cur.y) * dy));
    prev = cur;
    return pool[0] ?? cur;
  }
  let stuck = 0;
  return {
    steer() {
      const c = state.player.car;
      if (!c) return { x: 0, y: 0 };
      if (!target || Math.hypot(c.x - target.x, c.y - target.y) < 90) target = pickTarget();
      const want = Math.atan2(target.y - c.y, target.x - c.x);
      let da = want - c.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const steerX = da > 0.12 ? 1 : da < -0.12 ? -1 : 0;
      const distToTarget = Math.hypot(target.x - c.x, target.y - c.y);
      // Arrive at each intersection slow enough to turn: at 560 the car
      // needs 250 units to stop, but the next target is only picked 90 out,
      // so it overshoots the corner and wedges off-road.
      if (distToTarget < 160 && c.speed > 180) return { x: steerX, y: 1 };
      // Cruise at ~300 on a straight road, not at the 560 top speed.
      if (Math.abs(da) <= 0.35 && c.speed > 300) return { x: steerX, y: 0 };
      // Slow for turns early: at 560 the turning circle is far wider than a
      // 72-wide road, so the car overshoots the intersection, leaves the road
      // and wedges against a building. Brake progressively as the turn
      // sharpens. But braking at crawling speed becomes reversing, and a car
      // that reverses into a building never turns at all — so below 80, drive
      // forward through the turn instead; the car swings round as it moves.
      if (Math.abs(da) > 0.35 && c.speed > 200) return { x: steerX, y: 1 };
      if (Math.abs(da) > 0.8 && c.speed > 120) return { x: steerX, y: 1 };
      if (Math.abs(da) > 1.2 && c.speed > 80) return { x: steerX, y: 1 };
      // A car ahead in our lane: match its speed instead of braking to a
      // stop behind it — a stopped car with a cop beside it gets busted.
      const dx = Math.cos(c.angle);
      const dy = Math.sin(c.angle);
      let leader = null;
      let leaderAlong = Infinity;
      for (const o of [...state.traffic.cars, ...state.cops, ...state.parkedCars]) {
        if (o === c || o.dead) continue;
        const rx = o.x - c.x;
        const ry = o.y - c.y;
        const along = rx * dx + ry * dy;
        const lat = -rx * dy + ry * dx;
        if (along > 0 && along < 220 && Math.abs(lat) < 34 && along < leaderAlong) {
          leader = o;
          leaderAlong = along;
        }
      }
      if (leader) {
        stuck = 0;
        if (c.speed > (leader.speed ?? 0) + 30) return { x: steerX, y: 1 };
        return { x: steerX, y: -1 };
      }
      // Crawling for 3 s with a clear road means wedged against a building:
      // back out the way the car came in, steering so the nose swings round
      // toward the target (in reverse the steering sign flips).
      if (Math.abs(c.speed) < 25) stuck += 1;
      else stuck = 0;
      if (stuck > 180) {
        if (stuck > 240) stuck = 0;
        return { x: -steerX, y: 1 };
      }
      return { x: steerX, y: -1 };
    },
  };
}

function putPlayerInCar(state) {
  const car = state.parkedCars[0] || state.traffic.cars[0];
  if (!car) return;
  state.parkedCars = state.parkedCars.filter((c) => c !== car);
  state.traffic.cars = state.traffic.cars.filter((c) => c !== car);
  car.kind = 'player';
  car.health = 100;
  // The staged car is the hero car: bright yellow, so it reads at a glance
  // against the dark road in a still frame.
  car.color = '#ffcf3d';
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.camera.x = car.x;
  state.camera.y = car.y;
}

export function stageShot(name, world, stepWorld) {
  const state = world;
  const input = fakeInput();
  if (name === 'start') {
    state.time = (18.4 - 17.6) * 90; // sunset
    for (let i = 0; i < 5 / STEP; i += 1) stepWorld(state, input, STEP, noopAudio, 0);
    state.camera.x = 1120;
    state.camera.y = 1120;
    return { screen: SCREEN_TITLE, best: { completedMissions: 0, money: 150, stats: { carsStolen: 0 } } };
  }
  if (name === 'drive') {
    state.time = (10.5 - 17.6 + 24) * 90; // late morning
    putPlayerInCar(state);
    const driver = makeRoadDriver(state);
    for (let i = 0; i < 16 / STEP; i += 1) {
      input.direction = () => driver.steer();
      stepWorld(state, input, STEP, noopAudio, 0);
    }
    clearEndScreen(state);
    return { screen: SCREEN_PLAY, best: null };
  }
  if (name === 'chase') {
    state.time = (18.9 - 17.6) * 90; // dusk
    putPlayerInCar(state);
    // A staged chase is a photo shoot: the car is armoured for it, so cop
    // rams cannot end the scene before the camera fires.
    if (state.player.car) state.player.car.health = 500;
    state.wanted = 3;
    state.timeSinceCrime = 0;
    state.bustTimer = 0;
    const driver = makeRoadDriver(state);
    for (let i = 0; i < 11 / STEP; i += 1) {
      input.direction = () => driver.steer();
      stepWorld(state, input, STEP, noopAudio, 0);
    }
    clearEndScreen(state);
    return { screen: SCREEN_PLAY, best: null };
  }
  // mission: a night shootout at the marina, mission 5 in progress. Staged
  // briefly, while the gunmen are still standing and firing back.
  state.time = (21.5 - 17.6 + 24) * 90; // night
  const gate = state.city.places.marinaGate;
  state.player.x = gate.x - 160;
  state.player.y = gate.y;
  state.player.ammo = 120;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  startMission(state, 4, missionApi(state, noopAudio));
  for (let i = 0; i < 2.5 / STEP; i += 1) {
    const target = state.enemies[0];
    if (target) {
      input.mouseX = target.x - (state.camera.x - 640);
      input.mouseY = target.y - (state.camera.y - 360);
      input.mouseDown = true;
      state.player.aimAngle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    } else {
      input.mouseDown = false;
    }
    stepWorld(state, input, STEP, noopAudio, 0);
  }
  clearEndScreen(state);
  return { screen: SCREEN_PLAY, best: null };
}

/**
 * A staged scene is a photograph, not a playthrough: if the autopilot got
 * busted or wasted during staging, the frame must still show the scene.
 */
function clearEndScreen(state) {
  state.endScreen = null;
  state.bustTimer = 0;
}
