// Selene's story: six jobs that take Jax from a driver fresh off the ferry to
// the man who owns Solcayo. Each mission is a list of stages; the world checks
// the stage's condition every step and advances or pays out.
export const MISSIONS = [
  {
    title: 'Pulang ke Solcayo',
    intro: 'Selene: "Jax! Kau kembali juga. Mampir ke La Voz Bar — ada kerjaan."',
    reward: 200,
    stages: [{ type: 'goto', text: 'Temui Selene di La Voz Bar', x: 560, y: 400, r: 60 }],
  },
  {
    title: 'Paket Panas',
    intro: 'Selene: "Ambil paket di Gudang Utara. Polisi sudah dicium — cepat."',
    reward: 450,
    stages: [
      { type: 'goto', text: 'Ambil paket di Gudang Utara', x: 1440, y: 200, r: 60 },
      { type: 'goto', text: 'Antar paket ke Rumah Jax — polisi mengintai!', x: 2000, y: 1520, r: 70, onStart: 'hot' },
    ],
  },
  {
    title: 'Penagih Utang',
    intro: 'Selene: "Tiga orang berutang padaku. Tagih — sopan dulu, baru kasar."',
    reward: 600,
    stages: [
      { type: 'interact', text: 'Tagih utang: Kios Ikan (tahan E)', x: 480, y: 800, r: 55, channel: 1.5 },
      { type: 'interact', text: 'Tagih utang: Bengkel Tua (tahan E)', x: 1760, y: 480, r: 55, channel: 1.5 },
      { type: 'interact', text: 'Tagih utang: Lapangan Park (tahan E)', x: 1120, y: 1440, r: 55, channel: 1.5 },
    ],
  },
  {
    title: 'Kurir yang Kabur',
    intro: 'Selene: "Kurir Tiburones bawa tas berisi uangku. Hentikan dia — dengan cara apa pun."',
    reward: 800,
    stages: [
      { type: 'chase', text: 'Kejar dan hentikan mobil kurir!', r: 0 },
      { type: 'grab', text: 'Ambil tas dari mobil kurir', r: 55 },
    ],
  },
  {
    title: 'Perang di Marina',
    intro: 'Selene: "Tiburones menyerbu Marina. Bersihkan mereka semua!"',
    reward: 1000,
    stages: [{ type: 'kill', text: 'Habisi semua anak buah Tiburones di Marina', x: 2320, y: 1120, r: 220, count: 6 }],
  },
  {
    title: 'El Tiburón',
    intro: 'Selene: "Marco Reyes, El Tiburón, ada di limusinnya. Akhiri ini, Jax."',
    reward: 2000,
    stages: [
      { type: 'destroy', text: 'Hancurkan limusin El Tiburón!', r: 0 },
      { type: 'goto', text: 'Kabur dari polisi — kembali ke Rumah Jax!', x: 2000, y: 1520, r: 70, onStart: 'hot4' },
    ],
  },
];

export function startMission(state, index, api) {
  const def = MISSIONS[index];
  state.mission = { index, stage: 0, def, channel: 0, targetCar: null, spawned: 0, done: false };
  state.banner = { text: def.title, sub: def.intro, t: 4 };
  enterStage(state, api);
}

export function enterStage(state, api) {
  const stage = state.mission.def.stages[state.mission.stage];
  state.mission.channel = 0;
  if (!stage) return;
  if (stage.onStart === 'hot') api.crime(2, 'Paket panas ketahuan!');
  if (stage.onStart === 'hot4') api.crime(4, 'El Tiburón tumbang — polisi mengepung!');
  if (stage.type === 'chase' || stage.type === 'destroy') api.spawnTargetCar(state);
  if (stage.type === 'kill') api.spawnGunmen(state, stage.count, stage.x, stage.y);
}

export function objectiveText(state) {
  if (!state.mission) return 'Bebas berkeliaran — tekan N untuk misi berikutnya';
  const stage = state.mission.def.stages[state.mission.stage];
  return stage ? stage.text : '';
}

export function missionTarget(state) {
  if (!state.mission) return null;
  const stage = state.mission.def.stages[state.mission.stage];
  if (!stage) return null;
  if (stage.type === 'chase' || stage.type === 'destroy') {
    const car = state.mission.targetCar;
    return car ? { x: car.x, y: car.y, r: 40 } : null;
  }
  if (stage.type === 'grab') {
    const car = state.mission.targetCar;
    return car ? { x: car.x, y: car.y, r: stage.r } : null;
  }
  if (stage.type === 'kill') return { x: stage.x, y: stage.y, r: stage.r };
  return { x: stage.x, y: stage.y, r: stage.r };
}

function completeStage(state, api) {
  state.mission.stage += 1;
  if (state.mission.stage >= state.mission.def.stages.length) {
    completeMission(state, api);
  } else {
    const stage = state.mission.def.stages[state.mission.stage];
    state.banner = { text: 'Lanjut!', sub: stage.text, t: 2.5 };
    enterStage(state, api);
  }
}

function completeMission(state, api) {
  const def = state.mission.def;
  state.money += def.reward;
  state.completedMissions = Math.max(state.completedMissions, state.mission.index + 1);
  state.banner = { text: `MISI SELESAI — ${def.title}`, sub: `+$${def.reward}`, t: 3.5 };
  state.mission = null;
  state.enemies.length = 0;
  if (state.completedMissions >= MISSIONS.length) {
    state.storyDone = true;
    state.banner = { text: 'SOLCAYO MILIKMU', sub: 'Semua misi selesai. Kota ini milik Jax Moreno.', t: 6 };
  }
  api.save();
}

/** Advance the mission state machine; called every step from the world. */
export function updateMission(state, dt, api) {
  const m = state.mission;
  if (!m) return;
  const stage = m.def.stages[m.stage];
  if (!stage) return;
  const p = state.player;
  const dist = stage.x !== undefined ? Math.hypot(p.x - stage.x, p.y - stage.y) : Infinity;
  if (stage.type === 'goto') {
    if (dist < stage.r) completeStage(state, api);
  } else if (stage.type === 'interact') {
    if (dist < stage.r && state.interactHeld) {
      m.channel += dt;
      if (m.channel >= stage.channel) completeStage(state, api);
    } else {
      m.channel = Math.max(0, m.channel - dt * 2);
    }
  } else if (stage.type === 'chase' || stage.type === 'destroy') {
    const car = m.targetCar;
    if (car && car.health <= 0) {
      car.speed = 0;
      car.dead = true;
      if (stage.type === 'destroy') completeStage(state, api);
      else {
        state.banner = { text: 'Kurir berhenti!', sub: 'Ambil tasnya.', t: 2.5 };
        completeStage(state, api);
      }
    }
  } else if (stage.type === 'grab') {
    const car = m.targetCar;
    if (car && Math.hypot(p.x - car.x, p.y - car.y) < stage.r) {
      completeStage(state, api);
    }
  } else if (stage.type === 'kill') {
    if (state.enemies.length === 0 && m.spawned >= stage.count) completeStage(state, api);
  }
}
