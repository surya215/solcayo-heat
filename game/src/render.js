// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view follows the camera; the HUD, minimap and menus are
// drawn on top in screen space. Flat vector art, no image files.
import { VIEW, WORLD, PALETTE, FONT, FONT_DISPLAY } from './config.js';
import { ROAD_WIDTH, AVENUES, STREETS } from './city.js';
import { missionTarget, objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

// A rounded rectangle path, ready to fill or stroke.
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow, then body, windshield and rear window.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -26 + 3, -12 + 4, 54, 26, 8);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -27, -13, 54, 26, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  rr(ctx, -6, -11, 14, 22, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,30,0.9)';
  rr(ctx, 12, -11, 8, 22, 3);
  ctx.fill();
  if (opts.cop) {
    ctx.fillStyle = '#f4f1e8';
    rr(ctx, -27, -13, 20, 26, 8);
    ctx.fill();
    const flash = Math.floor(opts.siren * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3a7bff';
    rr(ctx, -4, -13, 8, 26, 2);
    ctx.fill();
  }
  if (opts.limo) {
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(-24, -13, 4, 26);
  }
  if (opts.night) {
    ctx.fillStyle = 'rgba(255,244,180,0.85)';
    ctx.fillRect(26, -10, 4, 6);
    ctx.fillRect(26, 4, 4, 6);
  }
  ctx.restore();
}

function drawPed(ctx, x, y, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    // Knocked flat.
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = color;
    ctx.fillRect(-8, -5, 16, 10);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // How dark and how warm the light is at this hour of the game clock.
  function lightFor(clock) {
    if (clock >= 6 && clock < 18) return { dark: 0, warm: 0 }; // day
    if (clock >= 18 && clock < 19.5) return { dark: 0.12, warm: 0.35 }; // sunset
    if (clock >= 5.5 && clock < 6) return { dark: 0.25, warm: 0.2 }; // dawn
    return { dark: 0.42, warm: 0.08 }; // night
  }

  function drawCity(state) {
    const { city } = state;
    // Ground: grass everywhere, then the beach and ocean on the south
    // shore, and the marina water on the east edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
    ctx.fillStyle = PALETTE.ocean;
    ctx.fillRect(city.ocean.x, city.ocean.y, city.ocean.w, city.ocean.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let x = 40; x < WORLD.width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, city.ocean.y + 14 + Math.sin((x + state.time * 30) * 0.02) * 4);
      ctx.lineTo(x + 60, city.ocean.y + 14 + Math.sin((x + 60 + state.time * 30) * 0.02) * 4);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.oceanDeep;
    ctx.fillRect(city.marina.x, city.marina.y, city.marina.w, city.marina.h);
    ctx.fillStyle = '#8a6f4d';
    for (let y = 200; y < 1700; y += 180) ctx.fillRect(city.marina.x - 8, y, 26, 90);
    // The park, with its pond.
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    ctx.fillStyle = '#7fb8d8';
    ctx.beginPath();
    ctx.ellipse(city.park.x + city.park.w / 2, city.park.y + city.park.h / 2, 46, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roads: sidewalk first, then asphalt, then lane dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_WIDTH / 2 - 8, 0, ROAD_WIDTH + 16, WORLD.height - 60);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_WIDTH / 2 - 8, WORLD.width, ROAD_WIDTH + 16);
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD.height - 60);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_WIDTH / 2, WORLD.width, ROAD_WIDTH);
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, WORLD.height - 60);
      ctx.stroke();
    }
    for (const sy of STREETS) {
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(WORLD.width, sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings: shadow, walls, roof, a checker of windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(40,60,90,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 22));
      const rows = Math.max(1, Math.floor(b.h / 22));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i + j) % 2 === 0) ctx.fillRect(b.x + 9 + i * 22, b.y + 9 + j * 22, 9, 11);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 6);
      }
    }
    // Trees and beach palms.
    for (const t of city.trees) {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#3f9e4d' : '#2f7d3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 6, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 10, t.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Named places: a coloured pin with a label under it.
    const signs = [
      [city.places.bar, 'BAR', '#c96fd0'],
      [city.places.hideout, 'RUMAH', '#7ee081'],
      [city.places.taller, 'TALLER', '#ffb02e'],
      [city.places.gunshop, 'SENJATA', '#ff8a5c'],
      [city.places.clinic, 'KLINIK', '#7ac7ff'],
      [city.places.marinaGate, 'MARINA', '#4fc3c3'],
    ];
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    for (const [place, label, color] of signs) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(place.x, place.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14181f';
      ctx.fillText(label[0], place.x, place.y + 5);
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(12,16,24,0.75)';
      rr(ctx, place.x - w / 2, place.y + 20, w, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(label, place.x, place.y + 33);
    }
    // The mission beacon: a pulsing ring with a marker above it.
    const target = missionTarget(state);
    if (target) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.18;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 44);
      ctx.lineTo(target.x - 12, target.y - 22);
      ctx.lineTo(target.x + 12, target.y - 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#14181f';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText('!', target.x, target.y - 26);
    }
  }

  function drawEntities(state) {
    const light = lightFor(state.clock);
    const night = light.dark > 0.25;
    const p = state.player;
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.t * 4) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.textAlign = 'center';
      if (pk.kind === 'ammo') {
        ctx.fillStyle = '#ffb02e';
        rr(ctx, -10, -7, 20, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#14181f';
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText('AMMO', 0, 4);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
      } else {
        ctx.fillStyle = '#7ee081';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14181f';
        ctx.font = `bold 12px ${FONT}`;
        ctx.fillText('$', 0, 4);
      }
      ctx.restore();
    }
    for (const car of state.parkedCars) {
      if (!car.dead) drawCarShape(ctx, car.x, car.y, car.angle, car.color, { night });
    }
    for (const car of state.traffic.cars) {
      if (!car.dead) drawCarShape(ctx, car.x, car.y, car.angle, car.color, { night });
      else {
        ctx.fillStyle = 'rgba(30,30,34,0.8)';
        rr(ctx, car.x - 27, car.y - 13, 54, 26, 8);
        ctx.fill();
      }
    }
    const target = state.mission?.targetCar;
    if (target && !target.dead) {
      drawCarShape(ctx, target.x, target.y, target.angle, target.color, { night, limo: target.kind === 'limo' });
      ctx.strokeStyle = '#ff5a3d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 36, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const e of state.escorts) if (!e.dead) drawCarShape(ctx, e.x, e.y, e.angle, e.color, { night });
    for (const cop of state.cops) drawCarShape(ctx, cop.x, cop.y, cop.angle, cop.color, { night, cop: true, siren: cop.siren });
    for (const ped of state.traffic.peds) drawPed(ctx, ped.x, ped.y, ped.color, ped.down > 0);
    for (const e of state.enemies) {
      drawPed(ctx, e.x, e.y, '#c22e2e', false);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
      ctx.fillStyle = '#7ee081';
      ctx.fillRect(e.x - 12, e.y - 20, 24 * Math.max(0, e.hp / 60), 4);
    }
    // The player: a yellow car, or Jax on foot with an aim line.
    if (p.inCar && p.car) {
      drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, '#ffcf3d', { night });
      if (p.car.health < 45) {
        ctx.fillStyle = 'rgba(60,60,66,0.7)';
        ctx.beginPath();
        ctx.arc(p.car.x - 10, p.car.y - 8, 8 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawPed(ctx, p.x, p.y, '#ffcf3d', false);
      ctx.strokeStyle = '#14181f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle ?? p.angle) * 46, p.y + Math.sin(p.aimAngle ?? p.angle) * 46);
      ctx.stroke();
    }
    for (const b of state.bullets) {
      ctx.strokeStyle = b.fromPlayer ? '#ffe9a8' : '#ff8a7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.t * 1.6);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of state.sparks) {
      ctx.globalAlpha = Math.max(0, s.t * 4);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLighting(state) {
    const light = lightFor(state.clock);
    const vx = state.camera.x - 640;
    const vy = state.camera.y - 360;
    if (light.dark > 0) {
      ctx.fillStyle = `rgba(8, 12, 34, ${light.dark})`;
      ctx.fillRect(vx, vy, VIEW.width, VIEW.height);
    }
    if (light.warm > 0) {
      ctx.fillStyle = `rgba(255, 122, 40, ${light.warm * 0.25})`;
      ctx.fillRect(vx, vy, VIEW.width, VIEW.height);
    }
  }

  function drawMinimap(state) {
    const mw = 230;
    const mh = 172;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    rr(ctx, mx, my, mw, mh, 4);
    ctx.clip();
    ctx.fillStyle = '#2c4a2c';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(mx, my + 1796 * sy, mw, mh - 1796 * sy);
    ctx.fillStyle = '#3a3f4a';
    for (const ax of AVENUES) ctx.fillRect(mx + ax * sx - 2, my, 4, mh);
    for (const sy2 of STREETS) ctx.fillRect(mx, my + sy2 * sy - 2, mw, 4);
    const target = missionTarget(state);
    if (target) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.cops) {
      ctx.fillStyle = '#3a7bff';
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(244,241,232,0.5)';
    ctx.lineWidth = 1;
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.stroke();
  }

  // A horizontal bar (health, armor, car condition) on a dark track.
  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = '#3a3f4a';
    rr(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.fillStyle = color;
    rr(ctx, x, y, w * Math.max(0, Math.min(1, frac)), h, 3);
    ctx.fill();
  }

  function drawHUD(state, screen) {
    const p = state.player;
    ctx.textAlign = 'left';
    // Top-left: name, health, armor, money.
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, 14, 12, 250, 74, 8);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('JAX MORENO', 26, 34);
    bar(26, 42, 180, 10, p.health / 100, p.health > 30 ? '#7ee081' : '#ff5a5a');
    bar(26, 56, 180, 7, p.armor / 50, '#7ac7ff');
    ctx.fillStyle = PALETTE.money;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`$${state.money}`, 216, 52);
    // Top-right: wanted stars and the clock.
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, VIEW.width - 250, 12, 236, 56, 8);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.wantedStar : 'rgba(244,241,232,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('★', VIEW.width - 232 + i * 30, 46);
    }
    const hh = Math.floor(state.clock);
    const mm = Math.floor((state.clock - hh) * 60);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VIEW.width - 76, 46);
    // The current objective, bottom centre.
    const objective = objectiveText(state);
    ctx.font = `bold 16px ${FONT}`;
    const ow = ctx.measureText(objective).width + 28;
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, (VIEW.width - ow) / 2, VIEW.height - 66, ow, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(`◆ ${objective}`, VIEW.width / 2, VIEW.height - 43);
    ctx.textAlign = 'left';
    // The interaction prompt above it.
    if (state.prompt) {
      ctx.font = `bold 15px ${FONT}`;
      const pw = ctx.measureText(state.prompt).width + 24;
      ctx.fillStyle = 'rgba(255,176,46,0.92)';
      rr(ctx, (VIEW.width - pw) / 2, VIEW.height - 112, pw, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#14181f';
      ctx.textAlign = 'center';
      ctx.fillText(state.prompt, VIEW.width / 2, VIEW.height - 91);
      ctx.textAlign = 'left';
    }
    // Bottom-right: speed and car condition, or ammo on foot.
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, VIEW.width - 250, VIEW.height - 116, 236, 44, 8);
    ctx.fill();
    if (p.inCar && p.car) {
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, VIEW.width - 236, VIEW.height - 96);
      bar(VIEW.width - 236, VIEW.height - 84, 200, 8, p.car.health / 100, p.car.health > 30 ? '#7ee081' : '#ff5a5a');
    } else {
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(`PISTOL  •  ${p.ammo} peluru`, VIEW.width - 236, VIEW.height - 88);
    }
    // A big centre banner, when one is showing.
    if (state.banner) {
      ctx.globalAlpha = Math.min(1, state.banner.t);
      ctx.fillStyle = 'rgba(12,16,24,0.72)';
      rr(ctx, (VIEW.width - 720) / 2, 110, 720, 86, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.font = `bold 30px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.banner.text, VIEW.width / 2, 148);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `16px ${FONT}`;
      ctx.fillText(state.banner.sub, VIEW.width / 2, 176);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    // The bust warning, while a cop closes in.
    if (state.bustTimer > 0.4 && state.wanted > 0) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = `bold 22px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLISI MENDEKAT — KABUR!', VIEW.width / 2, 240);
      ctx.textAlign = 'left';
    }
    drawMinimap(state);
    void screen;
  }

  function drawTitle(state, best) {
    // A sunset sky, a sun and a skyline silhouette behind the menu.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, '#2a1a4a');
    grad.addColorStop(0.45, '#c65a3d');
    grad.addColorStop(0.75, '#ff9a3d');
    grad.addColorStop(1, '#1e3a5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(980, 180, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,16,32,0.9)';
    const skyline = [90, 150, 110, 190, 130, 170, 100, 210, 140, 120, 180, 100];
    let x = 0;
    for (const h of skyline) {
      ctx.fillRect(x, VIEW.height - 190 - h, 108, 190 + h);
      x += 108;
    }
    ctx.fillStyle = 'rgba(255,210,62,0.9)';
    for (let i = 0; i < 40; i += 1) {
      ctx.fillRect((i * 97) % 1240 + 20, VIEW.height - 180 + ((i * 53) % 150), 7, 9);
    }
    ctx.fillStyle = 'rgba(12,16,24,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = `bold 84px ${FONT_DISPLAY}`;
    ctx.fillText('SOLCAYO', VIEW.width / 2, 190);
    ctx.fillStyle = '#ff5a3d';
    ctx.font = `bold 84px ${FONT_DISPLAY}`;
    ctx.fillText('HEAT', VIEW.width / 2, 272);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `italic 21px ${FONT}`;
    ctx.fillText('Kota pulau. Satu pengemudi. Enam pekerjaan terakhir.', VIEW.width / 2, 316);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#b9b3a4';
    ctx.fillText('WASD bergerak / mengemudi   •   E curi & masuk mobil   •   Mouse membidik, klik menembak', VIEW.width / 2, 380);
    ctx.fillText('Shift lari   •   N mulai misi   •   Esc jeda   •   M bisu', VIEW.width / 2, 406);
    ctx.fillStyle = '#ffb02e';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(best && best.completedMissions > 0 ? '▶  LANJUTKAN — ENTER' : '▶  MULAI — ENTER', VIEW.width / 2, 470);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `15px ${FONT}`;
    if (best) {
      ctx.fillText(`Misi selesai: ${best.completedMissions}/6   •   Uang: $${best.money}   •   Mobil dicuri: ${best.stats?.carsStolen ?? 0}`, VIEW.width / 2, 512);
    }
    ctx.fillStyle = '#8b93a3';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('Kota, tokoh, kendaraan, dan cerita orisinal — dibuat dari nol untuk make.fun.', VIEW.width / 2, 660);
    ctx.textAlign = 'left';
    void state;
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `bold 54px ${FONT_DISPLAY}`;
    ctx.fillText('JEDA', VIEW.width / 2, 300);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#b9b3a4';
    ctx.fillText('Esc — lanjut bermain      Enter — lanjut bermain', VIEW.width / 2, 350);
    ctx.fillText(`Misi: ${state.completedMissions}/6 selesai   •   Uang: $${state.money}`, VIEW.width / 2, 390);
    ctx.textAlign = 'left';
  }

  function drawEnd(state) {
    const busted = state.endScreen === 'busted';
    ctx.fillStyle = busted ? 'rgba(20,40,90,0.78)' : 'rgba(90,10,10,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = busted ? '#7ac7ff' : '#ff5a5a';
    ctx.font = `bold 72px ${FONT_DISPLAY}`;
    ctx.fillText(busted ? 'TERTANGKAP!' : 'TEWAS!', VIEW.width / 2, 300);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `19px ${FONT}`;
    ctx.fillText(busted ? 'Polisi Solcayo membawamu ke kantor. Denda $100.' : 'Solcayo tidak memberi ampun. Denda $100.', VIEW.width / 2, 348);
    ctx.fillStyle = '#ffb02e';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('ENTER — coba lagi dari Rumah Jax', VIEW.width / 2, 410);
    ctx.textAlign = 'left';
  }

  function drawComplete(state) {
    ctx.fillStyle = 'rgba(10,14,10,0.8)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = `bold 64px ${FONT_DISPLAY}`;
    ctx.fillText('SOLCAYO MILIKMU', VIEW.width / 2, 280);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Enam pekerjaan selesai. El Tiburón tumbang. Kota ini milik Jax Moreno.', VIEW.width / 2, 330);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = '#b9b3a4';
    ctx.fillText(`Uang: $${state.money}   •   Mobil dicuri: ${state.stats.carsStolen}   •   Tembakan: ${state.stats.shotsFired}`, VIEW.width / 2, 372);
    ctx.fillStyle = '#ffb02e';
    ctx.font = `bold 21px ${FONT}`;
    ctx.fillText('ENTER — terus berkeliaran di Solcayo', VIEW.width / 2, 430);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    ctx.save();
    ctx.translate(640 - state.camera.x, 360 - state.camera.y);
    drawCity(state);
    drawEntities(state);
    drawLighting(state);
    ctx.restore();
    drawHUD(state, screen);
    if (screen === SCREEN_PAUSED) drawPaused(state);
    if (state.endScreen) drawEnd(state);
    if (state.storyDone && screen === SCREEN_PLAY && !state.completeShown) drawComplete(state);
  }

  return { draw };
}
