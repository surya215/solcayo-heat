// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, end and complete screens.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { createWorld, stepWorld, saveGame, missionApi } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED } from './render.js';
import { createAudio } from './audio.js';
import { startMission, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function bestSummary() {
  return { completedMissions: world.completedMissions, money: world.money, stats: world.stats };
}

function runShot(name) {
  const scene = stageShot(name, world, stepWorld);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let last = performance.now();
  let accumulator = 0;
  const MAX_FRAME = 0.25;

  function announce(message) {
    status.textContent = message;
  }

  function startPlay() {
    if (world.completedMissions === 0 && !world.mission && !world.storyDone) {
      startMission(world, 0, missionApi(world, audio));
    }
    screen = SCREEN_PLAY;
    announce('Playing Solcayo Heat.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const { actions, clicked } = input.takeActions();
    if (actions & input.ACTION_MUTE) audio.toggleMute();
    if (clicked) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & input.ACTION_CONFIRM) {
        audio.unlock();
        startPlay();
      }
    } else if (screen === SCREEN_PLAY) {
      if (world.endScreen) {
        if (actions & input.ACTION_CONFIRM) {
          world.endScreen = null;
          announce('Playing Solcayo Heat.');
        }
      } else if (world.storyDone && !world.completeShown) {
        if (actions & input.ACTION_CONFIRM) {
          world.completeShown = true;
          announce('Free roam in Solcayo.');
        }
      } else if (actions & input.ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        // Aim with the mouse, in world coordinates.
        const p = world.player;
        const mwx = world.camera.x - 640 + input.mouseX;
        const mwy = world.camera.y - 360 + input.mouseY;
        p.aimAngle = Math.atan2(mwy - p.y, mwx - p.x);
        while (accumulator >= STEP) {
          stepWorld(world, input, STEP, audio, actions);
          accumulator -= STEP;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (input.ACTION_PAUSE | input.ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing Solcayo Heat.');
      }
      accumulator = 0;
    }
    renderer.draw(world, screen, bestSummary());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY && !world.endScreen) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solcayo Heat. Press Enter to start.');
  requestAnimationFrame(frame);
  void MISSIONS;
}

if (shot) runShot(shot);
else runGame();
