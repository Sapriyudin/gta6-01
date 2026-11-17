// HUD: dark glass panels (21st.dev: dark-first, one amber accent), cash, wanted stars,
// health/armor, speed or ammo, the mission objective, the mission timer, the dialogue box,
// the mission banner, and the minimap. Title, pause, busted, game-over and win screens.
import { VIEW, PALETTE, MISSION_SPOTS } from './config.js';
import { missionTitle, currentDialogue, currentPendingDialogue } from './missions.js';

const MM = { x: 1056, y: 12, w: 212, h: 158 };

function panel(g, x, y, w, h) {
  g.fillStyle = PALETTE.hudBg;
  g.beginPath();
  g.roundRect(x, y, w, h, 10);
  g.fill();
  g.strokeStyle = PALETTE.hudLine;
  g.lineWidth = 1;
  g.stroke();
}

function drawStars(g, x, y, stars) {
  g.font = '20px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle = i < stars ? PALETTE.accent : 'rgba(255,255,255,0.22)';
    g.fillText('★', x + i * 24, y);
  }
}

function drawMinimap(g, state) {
  const sx = MM.w / 3200, sy = MM.h / 2400;
  panel(g, MM.x - 6, MM.y - 6, MM.w + 12, MM.h + 12);
  g.save();
  g.beginPath();
  g.rect(MM.x, MM.y, MM.w, MM.h);
  g.clip();
  g.fillStyle = '#0a0f1e';
  g.fillRect(MM.x, MM.y, MM.w, MM.h);
  // Beach and sea.
  g.fillStyle = '#1d1a2e';
  g.fillRect(MM.x, MM.y + 2220 * sy, MM.w, (2400 - 2220) * sy);
  g.fillStyle = '#0a2438';
  g.fillRect(MM.x, MM.y + 2330 * sy, MM.w, (2400 - 2330) * sy);
  // Roads.
  g.strokeStyle = '#2c3a55';
  g.lineWidth = 1;
  for (const rx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
    g.beginPath(); g.moveTo(MM.x + rx * sx, MM.y); g.lineTo(MM.x + rx * sx, MM.y + MM.h); g.stroke();
  }
  for (const ry of [200, 600, 1000, 1400, 1800, 2200]) {
    g.beginPath(); g.moveTo(MM.x, MM.y + ry * sy); g.lineTo(MM.x + MM.w, MM.y + ry * sy); g.stroke();
  }
  const dot = (x, y, color, r) => {
    g.fillStyle = color;
    g.beginPath(); g.arc(MM.x + x * sx, MM.y + y * sy, r, 0, Math.PI * 2); g.fill();
  };
  // Safehouse (once unlocked).
  if (state.safehouseActive) dot(MISSION_SPOTS.safehouse.x, MISSION_SPOTS.safehouse.y, PALETTE.good, 4);
  // Mission marker.
  if (state.mission) {
    const step = state.mission.steps[state.mission.step];
    if (step) dot(step.x, step.y, PALETTE.marker, 5);
  }
  // Cops (red), player (white arrow).
  for (const cop of state.cops) {
    if (cop.state === 'down') continue;
    dot(cop.x, cop.y, '#ff5a5a', 3);
  }
  const p = state.player;
  g.save();
  g.translate(MM.x + p.x * sx, MM.y + p.y * sy);
  g.rotate(p.angle);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-5, 5); g.closePath(); g.fill();
  g.restore();
  g.restore();
  g.fillStyle = 'rgba(10,14,24,0.7)';
  g.fillRect(MM.x, MM.y + MM.h + 8, 96, 16);
  g.fillStyle = PALETTE.text;
  g.font = 'bold 11px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('SOLMAR CITY', MM.x + 4, MM.y + MM.h + 16);
}

function drawDialogue(g, line) {
  if (!line) return;
  const w = 760, h = 64;
  const x = (VIEW.width - w) / 2, y = VIEW.height - h - 96;
  panel(g, x, y, w, h);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 14px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText(line.who, x + 16, y + 10);
  g.fillStyle = PALETTE.text;
  g.font = '15px sans-serif';
  wrapText(g, line.line, x + 16, y + 32, w - 32, 19);
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else line = test;
  }
  g.fillText(line, x, yy);
}

export function drawHUD(g, state, screen, best) {
  const p = state.player;
  if (screen === 'title') {
    drawTitle(g, state, best);
    return;
  }
  if (screen === 'paused') drawPaused(g);
  if (screen === 'over') drawOver(g, state);
  if (screen === 'busted') drawBusted(g, state);
  if (screen === 'win') drawWin(g, state);
  if (screen !== 'play' && screen !== 'paused') return;

  // Cash + score.
  panel(g, 12, 12, 210, 54);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 24px sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText(`$${state.cash}`, 24, 20);
  g.fillStyle = PALETTE.dim;
  g.font = '12px sans-serif';
  g.fillText(`SCORE ${state.score}`, 24, 48);
  // Wanted stars.
  panel(g, 12, 74, 210, 40);
  g.fillStyle = PALETTE.dim;
  g.font = 'bold 12px sans-serif';
  g.fillText('WANTED', 24, 86);
  drawStars(g, 96, 94, state.wanted.stars);
  // Mission objective + timer.
  if (state.mission) {
    const step = state.mission.steps[state.mission.step];
    if (step) {
      let text = step.text;
      if (step.type === 'fight') {
        const alive = state.mission.rivals.filter((r) => r.health > 0).length;
        text = `${step.text} (${step.count - alive}/${step.count})`;
      }
      if (state.mission.timer !== null) text += ` — ${Math.ceil(state.mission.timer)}s`;
      g.font = 'bold 15px sans-serif';
      const w = g.measureText(text).width + 32;
      panel(g, (VIEW.width - w) / 2, 12, w, 36);
      g.fillStyle = PALETTE.accent;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, VIEW.width / 2, 30);
      g.textAlign = 'left';
    }
    g.fillStyle = PALETTE.dim;
    g.font = '12px sans-serif';
    g.fillText(missionTitle(state.mission.index), 24, 126);
  } else if (state.storyDone) {
    g.fillStyle = PALETTE.good;
    g.font = 'bold 13px sans-serif';
    g.fillText('STORY COMPLETE — FREE ROAM', 24, 126);
  }
  // Health + armor.
  panel(g, 12, VIEW.height - 66, 210, 54);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(24, VIEW.height - 54, 130, 10);
  g.fillStyle = p.health > 30 ? PALETTE.good : PALETTE.bad;
  g.fillRect(24, VIEW.height - 54, 130 * Math.max(0, p.health / 100), 10);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(24, VIEW.height - 38, 130, 6);
  g.fillStyle = '#7dd3fc';
  g.fillRect(24, VIEW.height - 38, 130 * Math.max(0, p.armor / 50), 6);
  g.fillStyle = PALETTE.text;
  g.font = 'bold 12px sans-serif';
  g.fillText(`HP ${Math.ceil(p.health)}`, 162, VIEW.height - 56);
  g.fillStyle = PALETTE.dim;
  g.font = '11px sans-serif';
  g.fillText(`ARMOR ${Math.floor(p.armor)}`, 162, VIEW.height - 40);
  // Speed or ammo.
  panel(g, VIEW.width - 222, VIEW.height - 66, 210, 54);
  if (p.inCar) {
    g.fillStyle = PALETTE.text;
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'right';
    g.fillText(`${Math.round(Math.abs(p.inCar.speed) * 3.6)}`, VIEW.width - 58, VIEW.height - 56);
    g.fillStyle = PALETTE.dim;
    g.font = '11px sans-serif';
    g.fillText('KM/H', VIEW.width - 24, VIEW.height - 48);
    g.fillStyle = PALETTE.accent;
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'left';
    g.fillText(p.inCar.model.toUpperCase(), VIEW.width - 210, VIEW.height - 52);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(VIEW.width - 210, VIEW.height - 34, 186, 6);
    g.fillStyle = p.inCar.health > 30 ? PALETTE.good : PALETTE.bad;
    g.fillRect(VIEW.width - 210, VIEW.height - 34, 186 * Math.max(0, p.inCar.health / 100), 6);
  } else {
    g.fillStyle = PALETTE.text;
    g.font = 'bold 22px sans-serif';
    g.textAlign = 'left';
    g.fillText(`AMMO ${p.ammo}`, VIEW.width - 210, VIEW.height - 54);
    g.fillStyle = PALETTE.dim;
    g.font = '11px sans-serif';
    g.fillText('PISTOL — click to fire, F to punch', VIEW.width - 210, VIEW.height - 32);
  }
  // Controls hint.
  g.fillStyle = 'rgba(244,246,251,0.55)';
  g.font = '11px sans-serif';
  g.textAlign = 'center';
  g.fillText(p.inCar ? 'WASD drive · SPACE handbrake · E exit car · P pause · M mute' : 'WASD move · SHIFT run · E enter car · CLICK shoot · F punch · P pause · M mute', VIEW.width / 2, VIEW.height - 12);
  // Banner.
  if (state.banner) {
    g.font = 'bold 20px sans-serif';
    const w = g.measureText(state.banner.text).width + 40;
    panel(g, (VIEW.width - w) / 2, 64, w, 40);
    g.fillStyle = PALETTE.accent;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(state.banner.text, VIEW.width / 2, 84);
    g.textAlign = 'left';
  }
  // Unlocks + safehouse status.
  if (state.unlocks.size > 1 || state.safehouseActive) {
    const items = [];
    if (state.unlocks.size > 1) items.push(`CARS: ${[...state.unlocks].join(' · ')}`);
    if (state.safehouseActive) items.push('SAFEHOUSE OPEN — rest to heal');
    g.fillStyle = PALETTE.good;
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'left';
    g.fillText(items.join('   '), 24, 148);
  }
  // Dialogue (mission lines first, then post-mission lines).
  drawDialogue(g, currentDialogue(state) || currentPendingDialogue(state));
  drawMinimap(g, state);
}

function drawTitle(g, state, best) {
  g.fillStyle = 'rgba(4, 6, 14, 0.72)';
  g.fillRect(0, 0, VIEW.width, VIEW.height);
  g.fillStyle = PALETTE.neonPink;
  g.shadowColor = PALETTE.neonPink;
  g.shadowBlur = 24;
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SOLMAR CITY', VIEW.width / 2, 150);
  g.shadowBlur = 0;
  g.fillStyle = PALETTE.neonCyan;
  g.font = 'bold 20px sans-serif';
  g.fillText('— AFTER DARK —', VIEW.width / 2, 205);
  g.shadowBlur = 0;
  g.fillStyle = PALETTE.text;
  g.font = '20px sans-serif';
  g.fillText('An open-world story at night — steal cars, outrun the law, run the jobs.', VIEW.width / 2, 252);
  g.fillStyle = PALETTE.dim;
  g.font = '16px sans-serif';
  g.fillText('Dario Cole, wheelman. Marisol Vega, fixer. Five jobs stand between you and the city.', VIEW.width / 2, 282);
  panel(g, VIEW.width / 2 - 300, 330, 600, 150);
  g.fillStyle = PALETTE.text;
  g.font = '15px sans-serif';
  g.textAlign = 'left';
  const rows = [
    ['WASD / arrows — walk & drive', 'SHIFT — run'],
    ['E — steal / enter a car', 'SPACE — handbrake'],
    ['CLICK — shoot the pistol', 'F — punch'],
    ['ENTER — start the next job', 'P — pause'],
  ];
  rows.forEach((row, i) => {
    g.fillText(row[0], VIEW.width / 2 - 280, 360 + i * 32);
    g.fillText(row[1], VIEW.width / 2 + 20, 360 + i * 32);
  });
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 22px sans-serif';
  g.textAlign = 'center';
  g.fillText('ENTER — START THE STORY', VIEW.width / 2, 530);
  if (best && best > 0) {
    g.fillStyle = PALETTE.dim;
    g.font = '14px sans-serif';
    g.fillText(`Best score: ${best}`, VIEW.width / 2, 566);
  }
  if (state.cash > 0 || state.missionIndex > 0) {
    g.fillStyle = PALETTE.good;
    g.font = '15px sans-serif';
    g.fillText(`Continue: $${state.cash} · job ${state.missionIndex + 1} of 5`, VIEW.width / 2, 596);
  }
}

function drawPaused(g) {
  g.fillStyle = 'rgba(4, 6, 14, 0.6)';
  g.fillRect(0, 0, VIEW.width, VIEW.height);
  g.fillStyle = PALETTE.text;
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2);
  g.font = '16px sans-serif';
  g.fillStyle = PALETTE.dim;
  g.fillText('P or ENTER to resume', VIEW.width / 2, VIEW.height / 2 + 40);
}

function drawOver(g, state) {
  g.fillStyle = 'rgba(4, 6, 14, 0.78)';
  g.fillRect(0, 0, VIEW.width, VIEW.height);
  g.fillStyle = PALETTE.bad;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.fillText('FLATLINED', VIEW.width / 2, 300);
  g.fillStyle = PALETTE.text;
  g.font = '18px sans-serif';
  g.fillText(`The night took you. Cash $${state.cash} · Score ${state.score}`, VIEW.width / 2, 350);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 20px sans-serif';
  g.fillText('ENTER — TRY AGAIN', VIEW.width / 2, 410);
}

function drawBusted(g, state) {
  g.fillStyle = 'rgba(4, 6, 14, 0.78)';
  g.fillRect(0, 0, VIEW.width, VIEW.height);
  g.fillStyle = '#7dd3fc';
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.fillText('BUSTED', VIEW.width / 2, 300);
  g.fillStyle = PALETTE.text;
  g.font = '18px sans-serif';
  g.fillText('The night shift caught you. A fine eats your cash — then you walk free.', VIEW.width / 2, 350);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 20px sans-serif';
  g.fillText('ENTER — WALK FREE', VIEW.width / 2, 410);
}

function drawWin(g, state) {
  g.fillStyle = 'rgba(4, 6, 14, 0.78)';
  g.fillRect(0, 0, VIEW.width, VIEW.height);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.fillText('THE CITY IS YOURS', VIEW.width / 2, 300);
  g.fillStyle = PALETTE.text;
  g.font = '18px sans-serif';
  g.fillText(`All five jobs done. Cash $${state.cash} · Score ${state.score} — free roam continues.`, VIEW.width / 2, 350);
  g.fillStyle = PALETTE.accent;
  g.font = 'bold 20px sans-serif';
  g.fillText('ENTER — KEEP DRIVING', VIEW.width / 2, 410);
}
