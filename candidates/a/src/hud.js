// The HUD: cash and score, the wanted stars, health and armor bars, speed and ammo, the mission
// objective, the minimap, the mission banner, and every menu (title, pause, wasted, busted, win).
// Dark glass panels over the bright city, one accent colour, tabular numbers.

import { VIEW, WORLD, PALETTE, BEACH_Y, WATER_Y } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { MISSIONS, missionObjective, missionMarker } from './missions.js';

const MM = { x: 1056, y: 16, w: 208, h: 156 };

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudBg;
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function draw(state, screen, best) {
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(w / VIEW.width, 0, 0, h / VIEW.height, 0, 0);
    if (screen === 'title') { drawTitle(state, best); return; }
    drawTopBar(state);
    drawMinimap(state);
    drawVitals(state);
    drawObjective(state);
    drawBanner(state);
    drawHints(state);
    if (state.player.health < 35 && !state.gameOver) drawDamageFlash();
    if (screen === 'paused') drawPaused();
    if (screen === 'over') drawOver(state, best);
    if (screen === 'busted') drawBusted(state);
    if (screen === 'win') drawWin(state);
  }

  function drawTopBar(state) {
    panel(16, 14, 250, 54);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 30, 32);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '13px sans-serif';
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 30, 54);
    // Wanted stars under the cash.
    panel(16, 76, 250, 40);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WANTED', 30, 96);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted.stars ? '#ffd21a' : 'rgba(255,255,255,0.18)';
      ctx.font = '20px sans-serif';
      ctx.fillText('★', 96 + i * 26, 96);
    }
  }

  function drawMinimap(state) {
    panel(MM.x - 6, MM.y - 6, MM.w + 12, MM.h + 12);
    const sx = MM.w / WORLD.width;
    const sy = MM.h / WORLD.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(MM.x, MM.y, MM.w, MM.h);
    ctx.clip();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(MM.x, MM.y, MM.w, MM.h);
    ctx.fillStyle = '#3f6b4a';
    ctx.fillRect(MM.x, MM.y, MM.w, BEACH_Y * sy);
    ctx.fillStyle = '#e9d6a4';
    ctx.fillRect(MM.x, MM.y + BEACH_Y * sy, MM.w, (WATER_Y - BEACH_Y) * sy);
    ctx.fillStyle = '#2b8fb0';
    ctx.fillRect(MM.x, MM.y + WATER_Y * sy, MM.w, MM.h - WATER_Y * sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (const rx of ROAD_XS) {
      ctx.beginPath(); ctx.moveTo(MM.x + rx * sx, MM.y); ctx.lineTo(MM.x + rx * sx, MM.y + BEACH_Y * sy); ctx.stroke();
    }
    for (const ry of ROAD_YS) {
      ctx.beginPath(); ctx.moveTo(MM.x, MM.y + ry * sy); ctx.lineTo(MM.x + MM.w, MM.y + ry * sy); ctx.stroke();
    }
    const m = missionMarker(state);
    if (m) {
      const pulse = 4 + 2 * Math.sin(state.time * 5);
      ctx.fillStyle = '#ffd21a';
      ctx.beginPath(); ctx.arc(MM.x + m.x * sx, MM.y + m.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
    }
    // Cops as red dots, the player as a white arrow.
    for (const cop of state.cops) {
      if (cop.state === 'down') continue;
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.arc(MM.x + cop.x * sx, MM.y + cop.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(MM.x + p.x * sx, MM.y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR CITY', MM.x, MM.y + MM.h + 20);
  }

  function drawVitals(state) {
    const p = state.player;
    panel(16, 640, 300, 64);
    bar(30, 654, 200, 12, p.health / 100, '#37d67a');
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`HP ${Math.ceil(p.health)}`, 240, 660);
    bar(30, 674, 200, 8, p.armor / 100, '#5d8fe8');
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '11px sans-serif';
    ctx.fillText(`ARMOR ${Math.ceil(p.armor)}`, 240, 678);
    if (p.inCar) {
      panel(1056, 640, 208, 64);
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${kmh}`, 1210, 668);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '11px sans-serif';
      ctx.fillText('KM/H', 1240, 668);
      ctx.textAlign = 'left';
      ctx.fillText(p.inCar.model.toUpperCase(), 1070, 668);
      bar(1070, 686, 180, 6, p.inCar.health / 100, p.inCar.health > 50 ? '#37d67a' : '#ff4d4d');
    } else {
      panel(1056, 640, 208, 64);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`AMMO ${p.ammo}`, 1070, 668);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '12px sans-serif';
      ctx.fillText('PISTOL — click to fire, F to punch', 1070, 690);
    }
    ctx.textAlign = 'left';
  }

  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  function drawObjective(state) {
    const text = missionObjective(state);
    ctx.font = 'bold 15px sans-serif';
    const w = Math.min(560, ctx.measureText(text).width + 36);
    panel(VIEW.width / 2 - w / 2, 14, w, 40);
    ctx.fillStyle = PALETTE.accent;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, VIEW.width / 2, 35);
    ctx.textAlign = 'left';
  }

  function drawBanner(state) {
    const b = state.banner;
    if (!b) return;
    const alpha = Math.min(1, b.timer);
    ctx.save();
    ctx.globalAlpha = alpha;
    panel(VIEW.width / 2 - 320, 120, 640, 84);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.title, VIEW.width / 2, 152);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px sans-serif';
    wrapText(b.sub, VIEW.width / 2, 180, 600, 19);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  function wrapText(text, cx, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    ctx.textAlign = 'center';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, cx, yy);
    ctx.textAlign = 'left';
  }

  function drawHints(state) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const line = state.player.inCar
      ? 'WASD drive · SPACE handbrake · E exit car · P pause · M mute'
      : 'WASD move · SHIFT run · E enter car · CLICK shoot · F punch · P pause · M mute';
    ctx.fillText(line, VIEW.width / 2, 706);
    ctx.textAlign = 'left';
  }

  function drawDamageFlash() {
    const g = ctx.createRadialGradient(640, 360, 200, 640, 360, 720);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, 'rgba(255,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function dim() {
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawTitle(state, best) {
    dim();
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR CITY', VIEW.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px sans-serif';
    ctx.fillText('An open-world story in the sun — steal cars, outrun the law, run the jobs.', VIEW.width / 2, 258);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '16px sans-serif';
    ctx.fillText('Dario Cole, wheelman. Marisol Vega, fixer. Five jobs stand between you and the city.', VIEW.width / 2, 292);
    panel(VIEW.width / 2 - 260, 340, 520, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px sans-serif';
    const lines = [
      'WASD / arrows — walk & drive      SHIFT — run',
      'E — steal / enter a car            SPACE — handbrake',
      'CLICK — shoot the pistol           F — punch',
      'ENTER — start the next job         P — pause',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2 - 236, 372 + i * 30));
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(state.missionIndex > 0 || state.storyDone ? 'ENTER — CONTINUE THE STORY' : 'ENTER — START THE STORY', VIEW.width / 2, 548);
    if (best > 0) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '15px sans-serif';
      ctx.fillText(`Best score so far: ${best.toLocaleString('en-US')}`, VIEW.width / 2, 588);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    dim();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to keep playing', VIEW.width / 2, 380);
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    dim();
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', VIEW.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px sans-serif';
    ctx.fillText(`Solmar City got the better of Dario this time. Score ${state.score.toLocaleString('en-US')} — best ${Math.max(best, state.score).toLocaleString('en-US')}.`, VIEW.width / 2, 350);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Press ENTER to try again', VIEW.width / 2, 400);
    ctx.textAlign = 'left';
  }

  function drawBusted(state) {
    dim();
    ctx.fillStyle = '#5d8fe8';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', VIEW.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px sans-serif';
    const fine = Math.min(200, state.cash);
    ctx.fillText(`The Solmar police took you in — and took $${fine} for the trouble.`, VIEW.width / 2, 350);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Press ENTER to walk free', VIEW.width / 2, 400);
    ctx.textAlign = 'left';
  }

  function drawWin(state) {
    dim();
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE SOLMAR HEIST', VIEW.width / 2, 280);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('COMPLETE', VIEW.width / 2, 330);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Dario Cole owns this city now. Free roam continues — keep the score climbing.', VIEW.width / 2, 380);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press ENTER to keep playing', VIEW.width / 2, 440);
    ctx.textAlign = 'left';
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

  return { draw };
}
