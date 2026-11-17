// The top-down renderer: paints the city, the cars, the people and the effects from the world
// state. One canvas, one logical 1280x720 view, a camera that follows the player and shakes on
// impacts. No images anywhere — every building, car and person is drawn from shapes.

import { VIEW, WORLD, PALETTE, ROAD_W, BEACH_Y, WATER_Y, clamp } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  let ctx = canvas.getContext('2d');
  // The static city (grass, roads, buildings) is painted once into an offscreen canvas and
  // blitted each frame — redrawing thousands of shapes per frame would waste the main thread.
  let groundCache = null;
  let groundForCity = null;

  function ensureGround(state) {
    if (groundCache && groundForCity === state.city) return groundCache;
    const off = document.createElement('canvas');
    off.width = WORLD.width;
    off.height = WORLD.height;
    const saved = ctx;
    ctx = off.getContext('2d');
    drawGround(state);
    ctx = saved;
    groundCache = off;
    groundForCity = state.city;
    return off;
  }

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  fit();
  window.addEventListener('resize', fit);

  function draw(state, screen) {
    fit();
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(w / VIEW.width, 0, 0, h / VIEW.height, 0, 0);
    // Sky-blue letterbox behind everything (only visible if the window is oddly shaped).
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const scale = screen === SCREEN_TITLE ? 0.55 : 0.95;
    ctx.save();
    ctx.translate(VIEW.width / 2, VIEW.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    ctx.drawImage(ensureGround(state), 0, 0);
    drawMarker(state);
    drawPickups(state);
    drawCars(state);
    drawPeds(state);
    drawRivals(state);
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    ctx.restore();
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < WORLD.height; y += 160) {
      if ((y / 160) % 2 === 0) ctx.fillRect(0, y, WORLD.width, 80);
    }
    // Beach and sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 260) {
      ctx.fillRect(x, WATER_Y + 18, 130, 5);
      ctx.fillRect(x + 90, WATER_Y + 52, 130, 5);
    }
    // Parks and the plaza.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkPath;
      ctx.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
      ctx.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
      ctx.fillStyle = '#4a7a38';
      for (let i = 0; i < 6; i += 1) {
        const tx = park.x + 30 + ((i * 47) % (park.w - 60));
        const ty = park.y + 30 + ((i * 83) % (park.h - 60));
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const plaza of city.plazas) {
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    }
    // Roads: sidewalk border, asphalt, centre dashes.
    for (const rx of ROAD_XS) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(rx - ROAD_W / 2 - 10, 0, ROAD_W + 20, BEACH_Y);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
      ctx.fillStyle = PALETTE.lane;
      for (let y = 0; y < BEACH_Y; y += 56) ctx.fillRect(rx - 3, y, 6, 28);
    }
    for (const ry of ROAD_YS) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD.width, ROAD_W + 20);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
      ctx.fillStyle = PALETTE.lane;
      for (let x = 0; x < WORLD.width; x += 56) ctx.fillRect(x, ry - 3, 28, 6);
    }
    // Buildings: long noon shadow, roof, windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.height, b.y + b.height, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x, b.y, b.w, 5);
      ctx.fillStyle = PALETTE.glass;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (((i * 7 + j * 13 + Math.floor(b.seed * 100)) % 3) === 0) continue;
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 16, 12);
        }
      }
    }
  }

  function drawMarker(state) {
    const m = missionMarker(state);
    if (!m) return;
    const pulse = 1 + 0.18 * Math.sin(state.time * 4);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = '#ffd21a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,26,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob * 3) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(0, 4, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#ff5d5d' : pk.kind === 'armor' ? '#5d8fe8' : pk.kind === 'ammo' ? '#ffd21a' : '#37d67a';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'ammo' ? '»' : '$', 0, 1);
      ctx.restore();
    }
  }

  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.wrecked) {
      ctx.fillStyle = '#2c2c30';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-26, -13 + 4, 52, 26);
      ctx.fillStyle = car.color;
    }
    roundRect(-26, -13, 52, 26, 8);
    ctx.fill();
    ctx.fillStyle = car.wrecked ? '#3a3a3e' : 'rgba(255,255,255,0.28)';
    ctx.fillRect(-6, -11, 18, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(14, -11, 8, 22);
    if (!car.wrecked) {
      ctx.fillStyle = '#fff8c8';
      ctx.fillRect(24, -11, 3, 5); ctx.fillRect(24, 6, 3, 5);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(-27, -11, 3, 5); ctx.fillRect(-27, 6, 3, 5);
    }
    if (car.driver === 'cop') {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(-4, -13, 8, 5);
      ctx.fillStyle = '#4d8dff';
      ctx.fillRect(-4, 8, 8, 5);
    }
    ctx.restore();
    // Health bar over a damaged car.
    if (car.health < 100 && !car.wrecked) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.x - 20, car.y - 26, 40, 5);
      ctx.fillStyle = car.health > 50 ? '#37d67a' : '#ff4d4d';
      ctx.fillRect(car.x - 20, car.y - 26, 40 * (car.health / 100), 5);
    }
  }

  function drawCars(state) {
    for (const car of state.cars) drawCarShape(car);
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      if (ped.state === 'down') {
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.shirt;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      const bob = Math.sin(state.time * 8 + ped.phase) * 2;
      ctx.rotate(ped.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(6 + bob * 0.4, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawRivals(state) {
    for (const r of state.rivals) {
      if (r.health <= 0) continue;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a2f2f';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(7, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(10, -2, 12, 4);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(r.x - 14, r.y - 24, 28, 4);
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(r.x - 14, r.y - 24, 28 * (r.health / 110), 4);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(-2, 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Dario: teal jacket, dark hair.
    ctx.fillStyle = '#0e7490';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath(); ctx.arc(5, 0, 5, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
    if (p.ammo > 0) {
      ctx.fillStyle = '#1c1f26';
      ctx.fillRect(10, -2, 14, 4);
    }
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.fillStyle = '#ffe27a';
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { draw, canvas };
}
