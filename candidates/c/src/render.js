// Top-down night renderer: the static city is cached once to an offscreen canvas, the
// dynamic layer draws cars, people and markers, and a lighting pass lays a sheet of darkness
// over everything with pools of light cut out around the player, headlights, lamps and
// muzzle flashes. Neon signs and lit windows glow against the dark.
import { VIEW, WORLD, PALETTE, ROAD_XS, ROAD_YS, ROAD_W, BEACH_Y, WATER_Y, clamp } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  let ground = null;
  let lightCanvas = null;
  let lightCtx = null;

  function buildGround(city) {
    ground = document.createElement('canvas');
    ground.width = WORLD.width;
    ground.height = WORLD.height;
    const g = ground.getContext('2d');
    g.fillStyle = PALETTE.block;
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Sea and beach at the south edge, with a moon path on the water.
    g.fillStyle = PALETTE.water;
    g.fillRect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y);
    g.fillStyle = PALETTE.moon;
    for (let x = 200; x < WORLD.width; x += 260) {
      g.fillRect(x, WATER_Y + 12, 120, 3);
      g.fillRect(x + 60, WATER_Y + 34, 70, 2);
    }
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, BEACH_Y, WORLD.width, WATER_Y - BEACH_Y);
    // Parks and plazas.
    for (const park of city.parks) {
      g.fillStyle = PALETTE.park;
      g.fillRect(park.x, park.y, park.w, park.h);
      g.fillStyle = '#123524';
      for (let i = 0; i < 6; i += 1) {
        const tx = park.x + 20 + ((i * 53) % Math.max(20, park.w - 40));
        const ty = park.y + 20 + ((i * 71) % Math.max(20, park.h - 40));
        g.beginPath(); g.arc(tx, ty, 12, 0, Math.PI * 2); g.fill();
      }
    }
    for (const plaza of city.plazas) {
      g.fillStyle = PALETTE.plaza;
      g.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    }
    // Roads: asphalt, neon edge lines, amber dashes, crosswalks at intersections.
    for (const rx of ROAD_XS) {
      g.fillStyle = PALETTE.sidewalk;
      g.fillRect(rx - ROAD_W / 2 - 5, 0, ROAD_W + 10, BEACH_Y);
      g.fillStyle = PALETTE.road;
      g.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
      g.fillStyle = PALETTE.edge;
      g.fillRect(rx - ROAD_W / 2 + 1, 0, 2, BEACH_Y);
      g.fillRect(rx + ROAD_W / 2 - 3, 0, 2, BEACH_Y);
      g.fillStyle = PALETTE.lane;
      for (let y = 10; y < BEACH_Y; y += 34) g.fillRect(rx - 2, y, 4, 16);
    }
    for (const ry of ROAD_YS) {
      g.fillStyle = PALETTE.sidewalk;
      g.fillRect(0, ry - ROAD_W / 2 - 5, WORLD.width, ROAD_W + 10);
      g.fillStyle = PALETTE.road;
      g.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
      g.fillStyle = PALETTE.edge;
      g.fillRect(0, ry - ROAD_W / 2 + 1, WORLD.width, 2);
      g.fillRect(0, ry + ROAD_W / 2 - 3, WORLD.width, 2);
      g.fillStyle = PALETTE.lane;
      for (let x = 10; x < WORLD.width; x += 34) g.fillRect(x, ry - 2, 16, 4);
      g.fillStyle = PALETTE.crosswalk;
      for (const rx of ROAD_XS) {
        for (let i = -3; i <= 3; i += 1) g.fillRect(rx + i * 9 - 3, ry - ROAD_W / 2 - 4, 6, 8);
      }
    }
    // Buildings: dark slabs, lit windows, neon roof signs.
    for (const b of city.buildings) {
      g.fillStyle = PALETTE.wall;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = PALETTE.roof;
      g.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      const cw = b.w / b.cols, ch = b.h / b.rows;
      for (const w of b.windows) {
        g.fillStyle = w.color;
        g.globalAlpha = 0.85;
        g.fillRect(b.x + 6 + w.cx * cw, b.y + 6 + w.cy * ch, cw - 12, ch - 12);
      }
      g.globalAlpha = 1;
      if (b.neon) {
        g.save();
        g.shadowColor = b.neon;
        g.shadowBlur = 14;
        g.fillStyle = b.neon;
        g.fillRect(b.x + b.w / 2 - 16, b.y + 2, 32, 5);
        g.restore();
      }
    }
    // Street lamps as small posts (the light pools come from the lighting pass).
    for (const lamp of city.lamps) {
      g.fillStyle = '#3a4358';
      g.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      g.fillStyle = '#ffe9a8';
      g.fillRect(lamp.x - 1, lamp.y - 1, 2, 2);
    }
  }

  function drawCar(g, car, time) {
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.angle);
    // Headlight beams: two soft cones ahead of the car.
    g.globalCompositeOperation = 'lighter';
    const beam = g.createRadialGradient(18, 0, 4, 26, 0, 90);
    beam.addColorStop(0, 'rgba(255, 240, 180, 0.30)');
    beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(16, -7); g.lineTo(96, -30); g.lineTo(96, 30); g.lineTo(16, 7);
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    // Body.
    g.fillStyle = car.wrecked ? '#3a3f4a' : car.color;
    g.beginPath();
    g.roundRect(-22, -11, 44, 22, 6);
    g.fill();
    g.fillStyle = car.wrecked ? '#2a2e38' : '#0e1420';
    g.beginPath();
    g.roundRect(-8, -9, 18, 18, 4);
    g.fill();
    // Headlights and taillights.
    g.fillStyle = '#fff6c8';
    g.fillRect(20, -8, 3, 4);
    g.fillRect(20, 4, 3, 4);
    g.fillStyle = '#ff3b30';
    g.fillRect(-23, -8, 3, 4);
    g.fillRect(-23, 4, 3, 4);
    // Cop light bar, flashing red/blue.
    if (car.driver === 'cop') {
      const on = Math.floor(time * 4) % 2 === 0;
      g.fillStyle = on ? PALETTE.copLightR : PALETTE.copLightB;
      g.shadowColor = g.fillStyle;
      g.shadowBlur = 10;
      g.fillRect(-4, -8, 8, 5);
      g.fillStyle = on ? PALETTE.copLightB : PALETTE.copLightR;
      g.fillRect(-4, 3, 8, 5);
      g.shadowBlur = 0;
    }
    g.restore();
  }

  function drawPerson(g, x, y, angle, shirt, time, bob) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(0, 3, 10, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = shirt;
    g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c39a';
    g.beginPath(); g.arc(4, 0, 5, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function punchLight(g, sx, sy, r, alpha) {
    const grad = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(255, 240, 200, ${alpha})`);
    grad.addColorStop(1, 'rgba(255, 240, 200, 0)');
    g.fillStyle = grad;
    g.fillRect(sx - r, sy - r, r * 2, r * 2);
  }

  function draw(state, screen) {
    if (!ground) buildGround(state.city);
    if (!lightCanvas) {
      lightCanvas = document.createElement('canvas');
      lightCanvas.width = VIEW.width;
      lightCanvas.height = VIEW.height;
      lightCtx = lightCanvas.getContext('2d');
    }
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    const ox = VIEW.width / 2 - cam.x + shakeX;
    const oy = VIEW.height / 2 - cam.y + shakeY;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(ground, 0, 0);
    // Safehouse zone (once unlocked): a soft green ring around the safehouse.
    if (state.safehouseActive) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(200, 200, 90, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(52, 211, 153, 0.12)';
      ctx.beginPath(); ctx.arc(200, 200, 90, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker: a pulsing ring and a beam of light.
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 1 + 0.12 * Math.sin(state.time * 4);
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 26, 0.18)';
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    }
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 2;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.shadowColor = pk.kind === 'health' ? PALETTE.good : pk.kind === 'armor' ? '#7dd3fc' : pk.kind === 'ammo' ? PALETTE.accent : '#f472b6';
      ctx.shadowBlur = 10;
      ctx.fillStyle = ctx.shadowColor;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b0f1a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'ammo' ? '•' : '$', 0, 0);
      ctx.restore();
    }
    // Cars.
    for (const car of state.cars) drawCar(ctx, car, state.time);
    // Pedestrians, rivals, cops on foot.
    for (const ped of state.peds) {
      if (ped.state === 'dead') {
        ctx.fillStyle = 'rgba(120, 30, 30, 0.8)';
        ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, state.time, ped.bob);
    }
    if (state.mission) {
      for (const r of state.mission.rivals) {
        if (r.health <= 0) continue;
        drawPerson(ctx, r.x, r.y, r.angle, PALETTE.rival, state.time, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(r.x - 14, r.y - 22, 28, 5);
        ctx.fillStyle = PALETTE.rival;
        ctx.fillRect(r.x - 14, r.y - 22, 28 * Math.max(0, r.health / 110), 5);
      }
    }
    for (const cop of state.cops) {
      if (cop.inCar) continue;
      if (cop.state === 'down') {
        ctx.fillStyle = 'rgba(40, 60, 140, 0.8)';
        ctx.beginPath(); ctx.ellipse(cop.x, cop.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      drawPerson(ctx, cop.x, cop.y, cop.angle, PALETTE.cop, state.time, 0);
    }
    // The player (on foot): a glowing figure with a direction tick.
    const p = state.player;
    if (!p.inCar) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = PALETTE.player;
      ctx.shadowBlur = 16;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b0f1a';
      ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Bullets as bright tracer lines.
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    // --- Lighting pass: darkness with pools of light. ---
    const lg = lightCtx;
    lg.clearRect(0, 0, VIEW.width, VIEW.height);
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = 'rgba(3, 5, 13, 0.62)';
    lg.fillRect(0, 0, VIEW.width, VIEW.height);
    lg.globalCompositeOperation = 'destination-out';
    const toScreen = (x, y) => [x + ox, y + oy];
    const [px, py] = toScreen(p.x, p.y);
    punchLight(lg, px, py, 250, 0.95);
    for (const car of state.cars) {
      const [cx, cy] = toScreen(car.x, car.y);
      if (cx < -120 || cx > VIEW.width + 120 || cy < -120 || cy > VIEW.height + 120) continue;
      punchLight(lg, cx, cy, 90, 0.75);
      const hx = cx + Math.cos(car.angle) * 60, hy = cy + Math.sin(car.angle) * 60;
      punchLight(lg, hx, hy, 110, 0.6);
    }
    for (const lamp of state.city.lamps) {
      const [lx, ly] = toScreen(lamp.x, lamp.y);
      if (lx < -130 || lx > VIEW.width + 130 || ly < -130 || ly > VIEW.height + 130) continue;
      punchLight(lg, lx, ly, 110, 0.7);
    }
    if (marker) {
      const [mx, my] = toScreen(marker.x, marker.y);
      punchLight(lg, mx, my, 120, 0.7);
    }
    if (state.flash > 0) {
      punchLight(lg, px, py, 260, state.flash * 0.9);
    }
    lg.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);
    // Damage flash and low-health vignette.
    if (p.invuln > 0.3) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.12)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (p.health <= 30 && !state.gameOver) {
      const vg = ctx.createRadialGradient(640, 360, 240, 640, 360, 520);
      vg.addColorStop(0, 'rgba(255,0,0,0)');
      vg.addColorStop(1, 'rgba(255,0,0,0.25)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function missionMarker(state) {
    const m = state.mission;
    if (!m) return null;
    const step = m.steps[m.step];
    if (!step) return null;
    return { x: step.x, y: step.y };
  }

  return { draw };
}
