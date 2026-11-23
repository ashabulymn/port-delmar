// The renderer: paints the city, its cars and people, the HUD with its minimap, and the
// title, pause, game-over and story-complete screens. The canvas is a fixed 1280x720 logical
// area, scaled by CSS to the window; the camera follows the player through Port Delmar.

import { FIELD, FONT, MISSIONS, PALETTE, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const VIEW_W = FIELD.width;
const VIEW_H = FIELD.height;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -26, -12, 56, 28, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -27, -13, 54, 26, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,40,0.9)';
  ctx.fillRect(-6, -11, 14, 22);
  ctx.fillStyle = 'rgba(220,235,245,0.85)';
  ctx.fillRect(14, -10, 6, 20);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(26, -11, 2, 4);
  ctx.fillRect(26, 7, 2, 4);
  if (car.kind === 'cop') {
    const t = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = t ? PALETTE.copLight : PALETTE.copLight2;
    ctx.beginPath();
    ctx.arc(-14, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -27, -13, 54, 26, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'thug') {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  function blockRects() {
    const xs = [0];
    for (const rx of ROADS_V) xs.push(rx + ROAD_W / 2);
    const xe = [...ROADS_V.map((x) => x - ROAD_W / 2), WORLD.width];
    const ys = [0];
    for (const ry of ROADS_H) ys.push(ry + ROAD_W / 2);
    const ye = [...ROADS_H.map((y) => y - ROAD_W / 2), WATER_Y];
    const out = [];
    for (let bx = 0; bx < xs.length; bx++) {
      for (let by = 0; by < ys.length; by++) out.push({ x: xs[bx], y: ys[by], w: xe[bx] - xs[bx], h: ye[by] - ys[by], bx, by });
    }
    return out;
  }

  function drawWorld(state) {
    const cam = state.camera;
    const ox = cam.x - VIEW_W / 2;
    const oy = cam.y - VIEW_H / 2;
    ctx.save();
    ctx.translate(-ox, -oy);

    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(ox - 40, oy - 40, VIEW_W + 80, VIEW_H + 80);
    // City blocks (sidewalks).
    for (const b of blockRects()) {
      const isPark = b.bx === 2 && b.by === 2;
      const isMarina = b.bx === 4 && b.by === 4;
      ctx.fillStyle = isPark ? PALETTE.park : isMarina ? '#4a4a52' : PALETTE.sidewalk;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, oy - 40, ROAD_W, VIEW_H + 80);
    for (const ry of ROADS_H) ctx.fillRect(ox - 40, ry - ROAD_W / 2, VIEW_W + 80, ROAD_W);
    // Centre dashes.
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const rx of ROADS_V) {
      ctx.moveTo(rx, oy - 40);
      ctx.lineTo(rx, oy + VIEW_H + 40);
    }
    for (const ry of ROADS_H) {
      ctx.moveTo(ox - 40, ry);
      ctx.lineTo(ox + VIEW_W + 40, ry);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Water and pier.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(ox - 40, WATER_Y, VIEW_W + 80, WORLD.height - WATER_Y + 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const wy = WATER_Y + 24 + i * 16;
      ctx.beginPath();
      for (let x = ox - 40; x < ox + VIEW_W + 40; x += 40) {
        ctx.lineTo(x, wy + Math.sin(x * 0.02 + state.time * 1.4 + i) * 4);
      }
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(1560, 2200, 80, 200);
    ctx.strokeStyle = '#5a4028';
    ctx.lineWidth = 2;
    for (let y = 2210; y < 2400; y += 18) {
      ctx.beginPath();
      ctx.moveTo(1560, y);
      ctx.lineTo(1640, y);
      ctx.stroke();
    }
    // A boat waiting at the pier.
    ctx.fillStyle = '#e8e8e8';
    roundRect(ctx, 1600, 2330, 90, 26, 12);
    ctx.fill();
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(1620, 2312, 50, 20);
    // Buildings.
    for (const b of state.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + Math.floor(b.x)) % 3 !== 0) continue;
          ctx.fillRect(b.x + 12 + i * 34, b.y + 12 + j * 34, 12, 14);
        }
      }
    }
    // Trees.
    for (const t of state.trees) {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeTop;
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker.
    drawMarker(state);
    // Cars, people, particles.
    for (const car of state.cars) drawCar(ctx, car, state.player.car === car);
    for (const ped of state.peds) drawPed(ctx, ped);
    drawPlayer(state);
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMarker(state) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return;
    const step = mission.steps[state.stepIndex];
    if (!step) return;
    let tx;
    let ty;
    if (step.type === 'enter') {
      const car = state.cars.find((c) => c.id === step.carId);
      if (!car) return;
      tx = car.x;
      ty = car.y;
    } else if (step.type === 'defeat') {
      tx = 1900;
      ty = 1650;
    } else if (step.type === 'lose') {
      return;
    } else {
      tx = step.x;
      ty = step.y;
    }
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(14, -30);
    ctx.lineTo(-14, -30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Edge arrow when the marker is off screen.
    const cam = state.camera;
    const sx = tx - (cam.x - VIEW_W / 2);
    const sy = ty - (cam.y - VIEW_H / 2);
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
      const cx = Math.max(60, Math.min(VIEW_W - 60, sx));
      const cy = Math.max(60, Math.min(VIEW_H - 60, sy));
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerJacket;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS(), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS() + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function PLAYER_RADIUS() {
    return 12;
  }

  function drawMinimap(state) {
    const mw = 200;
    const mh = 150;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#2f6b35';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    ctx.strokeStyle = '#555b66';
    ctx.lineWidth = 4;
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    const mission = MISSIONS[state.missionIndex];
    if (mission) {
      const step = mission.steps[state.stepIndex];
      let tx;
      let ty;
      if (step) {
        if (step.type === 'enter') {
          const car = state.cars.find((c) => c.id === step.carId);
          if (car) {
            tx = car.x;
            ty = car.y;
          }
        } else if (step.type === 'defeat') {
          tx = 1900;
          ty = 1650;
        } else if (step.type !== 'lose') {
          tx = step.x;
          ty = step.y;
        }
      }
      if (tx !== undefined) {
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.arc(mx + tx * sx, my + ty * sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const car of state.cars) {
      if (car.kind === 'cop') {
        ctx.fillStyle = '#ff2a2a';
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawHUD(state, best) {
    const p = state.player;
    // Top-left panel: cash, health, wanted stars.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, 12, 300, 86, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 14, 12, 300, 86, 10);
    ctx.stroke();
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${state.cash}`, 28, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`Mission ${Math.min(state.missionIndex + 1, 5)}/5`, 200, 34);
    // Health bar.
    ctx.fillStyle = '#22242a';
    roundRect(ctx, 28, 56, 150, 14, 7);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 28, 56, 150 * Math.max(0, p.health / 100), 14, 7);
    ctx.fill();
    // Wanted stars, top-right.
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
      ctx.font = '30px ' + FONT;
      ctx.fillText('★', VIEW_W - 24 - i * 34, 36);
    }
    if (state.bustedMeter > 0) {
      ctx.fillStyle = '#ff2a2a';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText('BUSTED INCOMING…', VIEW_W - 24, 66);
    }
    // Objective, bottom-left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.panel;
    const obj = state.objective || '';
    ctx.font = '15px ' + FONT;
    const objW = Math.min(560, ctx.measureText(obj).width + 28);
    roundRect(ctx, 14, VIEW_H - 92, objW, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.missionText;
    ctx.fillText(obj, 28, VIEW_H - 75);
    // Dialog line above the objective, wrapped to fit the panel.
    if (state.message && state.time < state.messageUntil) {
      const words = state.message.split(' ');
      const lines = [''];
      for (const word of words) {
        const cur = lines[lines.length - 1];
        if ((cur + ' ' + word).trim().length > 92 && cur !== '') lines.push(word);
        else lines[lines.length - 1] = (cur + ' ' + word).trim();
      }
      ctx.font = '15px ' + FONT;
      const msgW = Math.min(860, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
      const boxH = 18 + lines.length * 20;
      roundRect(ctx, 14, VIEW_H - 134 - (boxH - 34), msgW, boxH, 8);
      ctx.fillStyle = PALETTE.panel;
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      lines.forEach((line, i) => ctx.fillText(line, 28, VIEW_H - 117 - (boxH - 34) + i * 20));
    }
    // Speed, above the minimap.
    if (p.car) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW_W - 216, VIEW_H - 216, 200, 40, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 22px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, VIEW_W - 30, VIEW_H - 196);
      ctx.textAlign = 'left';
    }
    // Banner.
    if (state.banner && state.time < state.bannerUntil) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, VIEW_H / 2 - 64, VIEW_W, 96);
      ctx.fillStyle = PALETTE.missionText;
      ctx.font = 'bold 44px ' + FONT;
      ctx.fillText(state.banner, VIEW_W / 2, VIEW_H / 2 - 22);
      if (state.bannerSub) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = '20px ' + FONT;
        ctx.fillText(state.bannerSub, VIEW_W / 2, VIEW_H / 2 + 18);
      }
      ctx.textAlign = 'left';
    }
    drawMinimap(state);
    // Controls hint, first seconds of play.
    if (state.time < 12 && state.missionIndex === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('WASD drive / walk   •   E enter car   •   F punch   •   Space shoot   •   P pause', VIEW_W / 2, VIEW_H - 8);
      ctx.textAlign = 'left';
    }
    void best;
  }

  function drawTitle(state, best) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.missionText;
    ctx.font = 'bold 92px ' + FONT;
    ctx.fillText('PORT DELMAR', VIEW_W / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText('An open-world crime game — drive, steal, run missions, lose the heat.', VIEW_W / 2, 240);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Rook, a driver for hire, takes jobs from Mama Lou across five missions.', VIEW_W / 2, 276);
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW_W / 2 - 330, 320, 660, 150, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    ctx.fillText('WASD / arrows — walk or drive      Shift — run', VIEW_W / 2, 352);
    ctx.fillText('E — get in / out of a car (steal it)      F — punch      Space — shoot', VIEW_W / 2, 386);
    ctx.fillText('P — pause      M — music      Enter / click — start', VIEW_W / 2, 420);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px ' + FONT;
    const blink = Math.floor(state.time * 2) % 2 === 0;
    if (blink) ctx.fillText(state.saveExists ? 'Press Enter — Continue (Mission ' + (state.missionIndex + 1) + '/5)' : 'Press Enter — New Game', VIEW_W / 2, 540);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '16px ' + FONT;
      ctx.fillText(`Best cash in one run: $${best}`, VIEW_W / 2, 580);
    }
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    const wasted = state.over === 'wasted';
    ctx.fillStyle = wasted ? '#e5534b' : '#5a8ae8';
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', VIEW_W / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText(wasted ? 'Rook went down. The city keeps moving without him.' : 'The Port Delmar PD caught up with Rook.', VIEW_W / 2, 350);
    ctx.fillText(`Cash kept: $${state.cash}    •    Best cash: $${Math.max(best, state.cash)}`, VIEW_W / 2, 390);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText('Press Enter — retry this mission', VIEW_W / 2, 470);
    ctx.textAlign = 'left';
  }

  function drawComplete(state, best) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.missionText;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('STORY COMPLETE', VIEW_W / 2, 280);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText('Rook made it to the boat. Port Delmar is behind him — for now.', VIEW_W / 2, 330);
    ctx.fillText(`Total cash earned: $${state.cash}    •    Best cash: $${Math.max(best, state.cash)}`, VIEW_W / 2, 375);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText('Press Enter — play again from the start', VIEW_W / 2, 460);
    ctx.textAlign = 'left';
  }

  return {
    draw(state, screen, best) {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) {
        drawWorld(state);
        drawHUD(state, best);
        ctx.fillStyle = 'rgba(8, 12, 22, 0.6)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
        ctx.font = '20px ' + FONT;
        ctx.fillText('P or Enter — resume', VIEW_W / 2, VIEW_H / 2 + 44);
        ctx.textAlign = 'left';
      } else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_COMPLETE) drawComplete(state, best);
      else {
        drawWorld(state);
        drawHUD(state, best);
      }
    },
  };
}
