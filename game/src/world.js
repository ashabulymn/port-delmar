// Port Delmar itself: the city, its traffic and pedestrians, the police and the wanted level,
// the five story missions, combat and the particles. Everything is deterministic from the seed
// the world was created with, so the same seed always builds the same city.
//
// The world advances in fixed STEP seconds. step() returns a bitmask of events for the loop:
// EVENT_HIT (the player took damage), EVENT_MISSION (a mission was completed),
// EVENT_CRIME (the wanted level changed) and EVENT_OVER (wasted, busted or story complete).

import { CAR, MISSIONS, PALETTE, PLAYER, ROADS_H, ROADS_V, ROAD_W, STEP, WANTED, WATER_Y, WORLD } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_MISSION = 2;
export const EVENT_CRIME = 4;
export const EVENT_OVER = 8;

const TAU = Math.PI * 2;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return angle + clamp(d, -maxStep, maxStep);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return Math.abs(d);
}
/** Push a circle out of a rectangle; returns true when they overlapped. */
function circleRectPush(p, r, rect) {
  const nx = clamp(p.x, rect.x, rect.x + rect.w);
  const ny = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - nx;
  const dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
  } else {
    p.y = rect.y - r;
  }
  return true;
}
function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2 + 8) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2 + 8) return true;
  return false;
}
function inWater(x, y) {
  if (y < WATER_Y) return false;
  // The pier is walkable: a wooden strip out into the water.
  if (x > 1560 && x < 1640 && y < 2400) return false;
  return true;
}

export function createWorld(random) {
  const state = {
    time: 0,
    seed: 0,
    buildings: [],
    trees: [],
    cars: [],
    peds: [],
    particles: [],
    player: null,
    camera: { x: 640, y: 480 },
    missionIndex: 0,
    stepIndex: 0,
    cash: 0,
    checkpointCash: 0,
    wanted: 0,
    wantedTimer: 0,
    crimeCd: 0,
    hasPistol: false,
    passenger: false,
    packageTaken: false,
    defeated: 0,
    bustedMeter: 0,
    over: null,
    message: '',
    messageUntil: 0,
    banner: '',
    bannerSub: '',
    bannerUntil: 0,
    objective: '',
    hurtTimer: 0,
    lastDamage: -99,
    copCd: 0,
    exhaustTimer: 0,
  };

  function say(text, seconds = 5) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }
  function showBanner(text, sub = '', seconds = 3) {
    state.banner = text;
    state.bannerSub = sub;
    state.bannerUntil = state.time + seconds;
  }
  function addStars(n, reason) {
    if (n <= 0) return;
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.crimeCd = 3;
    state.wantedTimer = 0;
    if (state.wanted !== before) {
      state.crimeEvent = true;
      if (reason) say(reason, 3);
    }
  }
  function addParticles(x, y, n, color, speed = 120, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = random.next() * TAU;
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(life * 0.5, life), maxLife: life, color, size: random.range(2, 5) });
    }
  }

  function buildCity() {
    state.buildings = [];
    state.trees = [];
    const xEdges = [0, ...ROADS_V.map((x) => x - ROAD_W / 2), WORLD.width];
    const xStarts = [0];
    for (const rx of ROADS_V) xStarts.push(rx + ROAD_W / 2);
    const yStarts = [0];
    for (const ry of ROADS_H) yStarts.push(ry + ROAD_W / 2);
    const xEnds = [...ROADS_V.map((x) => x - ROAD_W / 2), WORLD.width];
    const yEnds = [...ROADS_H.map((y) => y - ROAD_W / 2), WATER_Y];
    void xEdges;
    for (let bx = 0; bx < xStarts.length; bx++) {
      for (let by = 0; by < yStarts.length; by++) {
        const x0 = xStarts[bx] + 24;
        const x1 = xEnds[bx] - 24;
        const y0 = yStarts[by] + 24;
        const y1 = yEnds[by] - 24;
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        const isPark = bx === 2 && by === 2;
        const isMarina = bx === 4 && by === 4;
        if (isPark) {
          for (let i = 0; i < 14; i++) state.trees.push({ x: random.range(x0, x1), y: random.range(y0, y1), r: random.range(10, 18) });
          continue;
        }
        if (isMarina) continue;
        const n = random.int(1, 3);
        for (let i = 0; i < n; i++) {
          const w = random.range(110, Math.min(220, x1 - x0 - 20));
          const h = random.range(90, Math.min(180, y1 - y0 - 20));
          const x = random.range(x0, Math.max(x0 + 1, x1 - w));
          const y = random.range(y0, Math.max(y0 + 1, y1 - h));
          state.buildings.push({ x, y, w, h, color: random.pick(PALETTE.buildingRoof) });
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      const road = random.pick(ROADS_V);
      const y = random.range(80, WATER_Y - 80);
      state.trees.push({ x: road + (random.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 26), y, r: random.range(9, 15) });
    }
  }

  function spawnTraffic() {
    const colors = ['#c8c8c8', '#3a6ab8', '#b83a3a', '#3a8a4a', '#c8a83a', '#7a7a8a', '#e8e8e8'];
    for (let i = 0; i < 24; i++) {
      const vertical = random.next() < 0.5;
      const road = vertical ? random.pick(ROADS_V) : random.pick(ROADS_H);
      const dir = random.next() < 0.5 ? 1 : -1;
      const lane = (random.next() < 0.5 ? -1 : 1) * 30;
      const car = {
        id: `traffic${i}`,
        kind: 'traffic',
        color: random.pick(colors),
        road: vertical ? 'v' : 'h',
        roadPos: road,
        lane,
        dir,
        speed: random.range(130, 200),
        baseSpeed: 0,
        x: vertical ? road + lane : random.range(0, WORLD.width),
        y: vertical ? random.range(0, WORLD.height) : road + lane,
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      };
      car.baseSpeed = car.speed;
      state.cars.push(car);
    }
  }

  function spawnParked() {
    const spots = [
      [430, 700, -Math.PI / 2], [430, 820, -Math.PI / 2], [970, 430, 0], [1030, 430, 0],
      [1570, 930, Math.PI / 2], [1630, 930, Math.PI / 2], [2170, 1430, 0], [2230, 1430, 0],
      [2770, 430, -Math.PI / 2], [2770, 930, Math.PI / 2], [970, 1870, 0], [1570, 430, 0],
      [2230, 930, Math.PI / 2], [2830, 1430, Math.PI],
    ];
    const colors = ['#c8c8c8', '#3a6ab8', '#b83a3a', '#3a8a4a', '#c8a83a', '#7a7a8a'];
    spots.forEach(([x, y, angle], i) => {
      state.cars.push({ id: `parked${i}`, kind: 'parked', color: colors[i % colors.length], x, y, angle, speed: 0 });
    });
    // The mission cars, parked where the story needs them.
    state.cars.push({ id: 'taxi', kind: 'parked', color: PALETTE.taxi, x: 430, y: 560, angle: -Math.PI / 2, speed: 0 });
    state.cars.push({ id: 'comet', kind: 'parked', color: PALETTE.comet, x: 2350, y: 2100, angle: 0, speed: 0 });
  }

  function spawnPeds() {
    for (let i = 0; i < 36; i++) {
      const vertical = random.next() < 0.5;
      const road = vertical ? random.pick(ROADS_V) : random.pick(ROADS_H);
      const off = (random.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 22);
      state.peds.push({
        kind: 'ped',
        x: vertical ? road + off : random.range(0, WORLD.width),
        y: vertical ? random.range(0, WATER_Y) : road + off,
        angle: random.next() * TAU,
        speed: random.range(40, 70),
        color: random.pick(PALETTE.ped),
        state: 'walk',
        fleeUntil: 0,
        health: 100,
        punchCd: 0,
      });
    }
  }

  function spawnThugs() {
    const spots = [[1850, 1620], [1950, 1680], [1900, 1720]];
    spots.forEach(([x, y], i) => {
      state.peds.push({
        kind: 'thug',
        x,
        y,
        angle: angleTo(x, y, state.player.x, state.player.y),
        speed: 150,
        color: PALETTE.thug,
        state: 'hunt',
        fleeUntil: 0,
        health: 50,
        punchCd: 0,
        id: `thug${i}`,
      });
    });
  }

  function spawnCopCar() {
    // Appear on a road some distance from the player, then drive in.
    const p = state.player;
    const road = random.pick(ROADS_V);
    const x = road + (random.next() < 0.5 ? -30 : 30);
    const y = p.y < WORLD.height / 2 ? WORLD.height - 120 : 120;
    const car = { id: `cop${state.time.toFixed(0)}${random.int(0, 999)}`, kind: 'cop', color: PALETTE.cop, x, y, angle: -Math.PI / 2, speed: 0 };
    state.cars.push(car);
    return car;
  }

  function nearestCar(x, y, maxDist, filter) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (filter && !filter(car)) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function startMission(index) {
    state.missionIndex = index;
    state.stepIndex = 0;
    state.defeated = 0;
    state.passenger = false;
    state.packageTaken = false;
    const mission = MISSIONS[index];
    if (!mission) return;
    state.checkpointCash = state.cash;
    say(mission.intro, 6);
    if (mission.startWanted) {
      state.wanted = mission.startWanted;
      state.crimeCd = 3;
    }
    if (mission.id === 'alley') {
      state.hasPistol = true;
      spawnThugs();
    }
    if (mission.id === 'score') {
      state.cars.push({ id: 'getaway', kind: 'parked', color: '#2a2a3a', x: 1030, y: 930, angle: 0, speed: 0 });
    }
    updateObjective();
  }

  function updateObjective() {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) {
      state.objective = 'Free roam — explore Port Delmar.';
      return;
    }
    const step = mission.steps[state.stepIndex];
    state.objective = step ? `${mission.title}: ${step.text}` : mission.title;
  }

  function nextStep() {
    const mission = MISSIONS[state.missionIndex];
    state.stepIndex += 1;
    if (state.stepIndex >= mission.steps.length) {
      state.cash += mission.reward;
      showBanner('Mission complete!', `+$${mission.reward} — ${mission.title}`, 3);
      state.missionIndex += 1;
      if (state.missionIndex >= MISSIONS.length) {
        state.over = 'complete';
        return;
      }
      startMission(state.missionIndex);
      return;
    }
    updateObjective();
  }

  function checkStep() {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return;
    const step = mission.steps[state.stepIndex];
    if (!step) return;
    const p = state.player;
    if (step.type === 'enter') {
      if (p.car && p.car.id === step.carId) {
        if (step.carId === 'taxi') say('Fare: "Grand Hotel, and step on it."', 4);
        nextStep();
      }
    } else if (step.type === 'goto' || step.type === 'reach') {
      if (dist(p.x, p.y, step.x, step.y) < step.r) {
        if (mission.id === 'fare' && state.stepIndex === 1) {
          state.passenger = true;
          say('Fare aboard. Now the Grand Hotel.', 4);
        }
        nextStep();
      }
    } else if (step.type === 'defeat') {
      if (state.defeated >= step.count) nextStep();
    } else if (step.type === 'take') {
      if (dist(p.x, p.y, step.x, step.y) < step.r) {
        state.packageTaken = true;
        nextStep();
      }
    } else if (step.type === 'lose') {
      if (state.wanted === 0) nextStep();
    }
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (state.hurtTimer > 0 || state.over) return false;
    p.health -= amount;
    state.hurtTimer = 0.6;
    state.lastDamage = state.time;
    addParticles(p.x, p.y, 8, '#e5534b', 140, 0.4);
    return true;
  }

  function hurtEnemy(ped, amount, fromX, fromY) {
    ped.health -= amount;
    const a = angleTo(fromX, fromY, ped.x, ped.y);
    ped.x += Math.cos(a) * 14;
    ped.y += Math.sin(a) * 14;
    addParticles(ped.x, ped.y, 6, '#ffd23f', 120, 0.35);
    if (ped.health <= 0 && ped.state !== 'down') {
      ped.state = 'down';
      if (ped.kind === 'thug') {
        state.defeated += 1;
        say(`Viper down — ${state.defeated} of 3.`, 3);
      }
    }
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      let speed = car.baseSpeed;
      // Slow down for a car ahead in the same lane.
      for (const other of state.cars) {
        if (other === car || other.kind !== 'traffic') continue;
        if (other.road !== car.road || other.roadPos !== car.roadPos || other.lane !== car.lane || other.dir !== car.dir) continue;
        const ahead = car.dir * (car.road === 'v' ? other.y - car.y : other.x - car.x);
        if (ahead > 0 && ahead < 90) speed = Math.min(speed, other.speed * 0.85);
      }
      car.speed += (speed - car.speed) * Math.min(1, dt * 2);
      if (car.road === 'v') {
        car.y += car.dir * car.speed * dt;
        if (car.y < -80) car.y = WORLD.height + 80;
        if (car.y > WORLD.height + 80) car.y = -80;
      } else {
        car.x += car.dir * car.speed * dt;
        if (car.x < -80) car.x = WORLD.width + 80;
        if (car.x > WORLD.width + 80) car.x = -80;
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      ped.punchCd = Math.max(0, ped.punchCd - dt);
      if (ped.kind === 'thug' || ped.kind === 'cop') {
        // Hunt the player.
        const d = dist(ped.x, ped.y, p.x, p.y);
        const a = angleTo(ped.x, ped.y, p.x, p.y);
        ped.angle = a;
        if (d > 34) {
          ped.x += Math.cos(a) * ped.speed * dt;
          ped.y += Math.sin(a) * ped.speed * dt;
        } else if (ped.punchCd <= 0) {
          ped.punchCd = 1;
          if (damagePlayer(ped.kind === 'cop' ? 8 : 10)) {
            /* hit */
          }
        }
        continue;
      }
      if (ped.state === 'flee') {
        if (state.time > ped.fleeUntil) ped.state = 'walk';
        else {
          const a = angleTo(p.x, p.y, ped.x, ped.y);
          ped.angle = a;
          ped.x += Math.cos(a) * ped.speed * 2.4 * dt;
          ped.y += Math.sin(a) * ped.speed * 2.4 * dt;
        }
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (random.next() < dt * 0.05) ped.angle += (random.next() - 0.5) * 1.6;
        if (!onRoad(ped.x, ped.y) && random.next() < dt * 0.2) ped.angle += Math.PI / 2;
      }
      ped.x = clamp(ped.x, 20, WORLD.width - 20);
      ped.y = clamp(ped.y, 20, WATER_Y - 20);
    }
    // Remove the dead weight: peds that fell stay down where they fell.
  }

  function updatePolice(dt) {
    const p = state.player;
    const want = Math.min(state.wanted, 4);
    const cops = state.cars.filter((c) => c.kind === 'cop');
    if (state.wanted > 0 && cops.length < want && state.copCd <= 0) {
      spawnCopCar();
      state.copCd = 2.5;
    }
    state.copCd = Math.max(0, state.copCd - dt);
    for (const cop of [...cops]) {
      if (state.wanted === 0) {
        state.cars.splice(state.cars.indexOf(cop), 1);
        continue;
      }
      const d = dist(cop.x, cop.y, p.x, p.y);
      const desired = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = turnToward(cop.angle, desired, 3.4 * dt);
      const targetSpeed = d > 260 ? 400 + state.wanted * 25 : 300;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.5);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      for (const b of state.buildings) circleRectPush(cop, 18, b);
      cop.x = clamp(cop.x, 20, WORLD.width - 20);
      cop.y = clamp(cop.y, 20, WATER_Y - 20);
      // Ram the player.
      if (d < 46) {
        if (p.car) {
          p.car.speed *= 0.55;
          if (damagePlayer(6)) addParticles(p.x, p.y, 10, '#ffb03a', 160, 0.4);
        } else if (damagePlayer(8)) {
          addParticles(p.x, p.y, 10, '#ffb03a', 160, 0.4);
        }
      }
      // On foot, a cop gets out and chases.
      if (!p.car && d < 170) {
        const active = state.peds.filter((e) => e.kind === 'cop' && e.state !== 'down').length;
        if (active < 2) {
          state.peds.push({
            kind: 'cop', x: cop.x + 30, y: cop.y + 30, angle: desired, speed: 175,
            color: PALETTE.cop, state: 'hunt', fleeUntil: 0, health: 100, punchCd: 0,
          });
          cop.speed = 0;
        }
      }
    }
    // Busted: a cop ped standing on the player for long enough.
    const near = state.peds.some((e) => e.kind === 'cop' && e.state !== 'down' && dist(e.x, e.y, p.x, p.y) < 46);
    if (!p.car && state.wanted > 0 && near) {
      state.bustedMeter += dt;
      if (state.bustedMeter > 2.5) state.over = 'busted';
    } else {
      state.bustedMeter = Math.max(0, state.bustedMeter - dt * 2);
    }
  }

  function updateWanted(dt) {
    state.crimeCd = Math.max(0, state.crimeCd - dt);
    if (state.wanted === 0 || state.crimeCd > 0) return;
    const p = state.player;
    const policeNear = state.cars.some((c) => c.kind === 'cop' && dist(c.x, c.y, p.x, p.y) < 700)
      || state.peds.some((e) => e.kind === 'cop' && e.state !== 'down' && dist(e.x, e.y, p.x, p.y) < 700);
    if (policeNear) {
      state.wantedTimer = 0;
      return;
    }
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED.decaySeconds) {
      state.wantedTimer = 0;
      state.wanted -= 1;
      state.crimeEvent = true;
      if (state.wanted === 0) say('You lost them. The heat is off.', 4);
    }
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    state.hurtTimer = Math.max(0, state.hurtTimer - dt);
    if (state.time - state.lastDamage > 8 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + 3 * dt);
    }
    if (p.car) {
      const car = p.car;
      const s = input.steer();
      const gas = s.y < 0;
      const brake = s.y > 0;
      if (gas) car.speed += CAR.accel * dt;
      else if (brake) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const turn = s.x * CAR.turnRate * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += turn * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      let hit = false;
      for (const b of state.buildings) if (circleRectPush(car, 18, b)) hit = true;
      if (inWater(car.x, car.y)) {
        car.y = WATER_Y - 24;
        car.speed *= 0.4;
      }
      car.x = clamp(car.x, 20, WORLD.width - 20);
      car.y = clamp(car.y, 20, WORLD.height - 20);
      if (hit && Math.abs(car.speed) > 120) {
        car.speed *= 0.35;
        addParticles(car.x, car.y, 8, '#ffb03a', 140, 0.35);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      // Running over pedestrians is a crime.
      for (const ped of state.peds) {
        if (ped.state === 'down' || ped.kind === 'thug' || ped.kind === 'cop') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
          ped.state = 'down';
          ped.health = 0;
          addStars(WANTED.hitPedStars, 'You ran someone over! The cops are coming.');
          state.crimeEvent = true;
          addParticles(ped.x, ped.y, 10, '#e5534b', 150, 0.5);
        }
      }
      // Exhaust puffs.
      state.exhaustTimer -= dt;
      if (Math.abs(car.speed) > 120 && state.exhaustTimer <= 0) {
        state.exhaustTimer = 0.09;
        const bx = car.x - Math.cos(car.angle) * 28;
        const by = car.y - Math.sin(car.angle) * 28;
        state.particles.push({ x: bx, y: by, vx: -Math.cos(car.angle) * 40, vy: -Math.sin(car.angle) * 40, life: 0.5, maxLife: 0.5, color: '#9aa0aa', size: 4 });
      }
      return;
    }
    // On foot.
    const s = input.steer();
    const len = Math.hypot(s.x, s.y);
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      p.x += (s.x / len) * speed * dt;
      p.y += (s.y / len) * speed * dt;
      p.angle = Math.atan2(s.y, s.x);
      p.moving = true;
    } else {
      p.moving = false;
    }
    for (const b of state.buildings) circleRectPush(p, PLAYER.radius, b);
    for (const car of state.cars) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < PLAYER.radius + 20 && d > 0.01) {
        p.x += ((p.x - car.x) / d) * (PLAYER.radius + 20 - d);
        p.y += ((p.y - car.y) / d) * (PLAYER.radius + 20 - d);
      }
    }
    if (inWater(p.x, p.y)) p.y = WATER_Y - PLAYER.radius;
    p.x = clamp(p.x, 20, WORLD.width - 20);
    p.y = clamp(p.y, 20, WORLD.height - 20);
  }

  function enterOrExitCar() {
    const p = state.player;
    if (p.car) {
      const car = p.car;
      car.owner = 'player-parked';
      p.car = null;
      p.x = car.x + 34;
      p.y = car.y + 34;
      p.angle = car.angle;
      return;
    }
    const car = nearestCar(p.x, p.y, 64, (c) => c.kind !== 'traffic' && c.kind !== 'cop');
    if (!car) return;
    if (car.kind === 'parked') {
      car.kind = 'player';
      // The taxi and the getaway car are assigned to Rook — taking them is not a crime.
      // Stealing any other parked car is.
      if (car.id !== 'taxi' && car.id !== 'getaway') {
        addStars(WANTED.stealStars, 'You stole a car! The cops are coming.');
        state.crimeEvent = true;
      }
      for (const ped of state.peds) {
        if (ped.kind === 'ped' && dist(ped.x, ped.y, p.x, p.y) < 320) {
          ped.state = 'flee';
          ped.fleeUntil = state.time + 3;
        }
      }
    } else if (car.kind === 'player-parked') {
      car.kind = 'player';
    }
    p.car = car;
    car.speed = 0;
  }

  function punch() {
    const p = state.player;
    if (p.car || p.punchCd > 0) return;
    p.punchCd = PLAYER.punchCooldown;
    let hitAny = false;
    for (const ped of state.peds) {
      if (ped.state === 'down' || ped.kind === 'ped') continue;
      if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange && angleDiff(angleTo(p.x, p.y, ped.x, ped.y), p.angle) < 1.1) {
        hurtEnemy(ped, PLAYER.punchDamage, p.x, p.y);
        hitAny = true;
      }
    }
    if (hitAny) {
      /* sound handled by the loop via EVENT_HIT-like cue: reuse crime event flag */
    }
  }

  function shoot() {
    const p = state.player;
    if (p.car || !state.hasPistol || p.shootCd > 0) return;
    p.shootCd = PLAYER.shootCooldown;
    addParticles(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 4, '#ffd23f', 200, 0.15);
    for (const ped of state.peds) {
      if (ped.kind === 'ped' || ped.state === 'down') continue;
      if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.shootRange && angleDiff(angleTo(p.x, p.y, ped.x, ped.y), p.angle) < 0.35) {
        if (ped.kind === 'cop') addStars(WANTED.shootStars, 'You shot at a cop!');
        hurtEnemy(ped, PLAYER.shootDamage, p.x, p.y);
        return;
      }
    }
    for (const other of state.peds) {
      if (other.kind === 'ped' && dist(other.x, other.y, p.x, p.y) < 320) {
        other.state = 'flee';
        other.fleeUntil = state.time + 3;
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateCamera(dt) {
    const p = state.player;
    const tx = clamp(p.x, FIELD_W2(), WORLD.width - FIELD_W2());
    const ty = clamp(p.y, FIELD_H2(), WORLD.height - FIELD_H2());
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  }
  // Half of the 1280x720 view, used to clamp the camera.
  function FIELD_W2() {
    return 640;
  }
  function FIELD_H2() {
    return 360;
  }

  function reset() {
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.particles = [];
    state.missionIndex = 0;
    state.stepIndex = 0;
    state.cash = 0;
    state.checkpointCash = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeCd = 0;
    state.hasPistol = false;
    state.passenger = false;
    state.packageTaken = false;
    state.defeated = 0;
    state.bustedMeter = 0;
    state.over = null;
    state.message = '';
    state.banner = '';
    state.objective = '';
    state.hurtTimer = 0;
    state.lastDamage = -99;
    state.copCd = 0;
    state.player = {
      x: 520, y: 520, angle: -Math.PI / 2, speed: 0, health: PLAYER.health,
      onFoot: true, car: null, punchCd: 0, shootCd: 0, moving: false,
    };
    buildCity();
    spawnTraffic();
    spawnParked();
    spawnPeds();
    state.camera.x = 640;
    state.camera.y = 480;
    startMission(0);
  }

  function setupShot(name) {
    reset();
    const p = state.player;
    if (name === 'drive') {
      // Mid-mission 2: Rook driving the Comet GT down the main road, traffic around.
      state.missionIndex = 1;
      state.stepIndex = 2;
      const comet = state.cars.find((c) => c.id === 'comet');
      comet.kind = 'player';
      comet.x = 1600;
      comet.y = 1300;
      comet.angle = -Math.PI / 2;
      comet.speed = 320;
      p.car = comet;
      p.x = comet.x;
      p.y = comet.y;
      p.angle = comet.angle;
      state.camera.x = 1600;
      state.camera.y = 1200;
      updateObjective();
      say(MISSIONS[1].intro, 6);
    } else if (name === 'chase') {
      // Three stars: Rook fleeing in a car, three cop cars on his tail.
      state.missionIndex = 3;
      state.stepIndex = 0;
      state.wanted = 3;
      const car = state.cars.find((c) => c.id === 'taxi');
      car.kind = 'player';
      car.x = 1600;
      car.y = 1100;
      car.angle = -Math.PI / 2;
      car.speed = 380;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      for (let i = 0; i < 3; i++) {
        state.cars.push({ id: `cop-shot${i}`, kind: 'cop', color: PALETTE.cop, x: 1560 + i * 70, y: 1300 + i * 50, angle: -Math.PI / 2, speed: 360 });
      }
      state.camera.x = 1600;
      state.camera.y = 1080;
      updateObjective();
      say('Mama Lou: "Lose them, Rook!"', 6);
    } else if (name === 'mission') {
      // Mission 3: on foot in the alley, three Vipers closing in.
      state.missionIndex = 2;
      state.stepIndex = 1;
      state.hasPistol = true;
      spawnThugs();
      p.x = 1900;
      p.y = 1560;
      p.angle = Math.PI / 2;
      state.camera.x = 1900;
      state.camera.y = 1620;
      updateObjective();
      say('Viper: "This turf is ours, Rook."', 6);
    } else {
      // start: the title scene — Rook on foot by the taxi at dawn in Port Delmar.
      p.x = 520;
      p.y = 560;
      p.angle = -Math.PI / 2;
      state.camera.x = 640;
      state.camera.y = 560;
    }
  }

  reset();

  return {
    state,
    reset,
    setupShot,
    startMission,
    enterOrExitCar,
    punch,
    shoot,
    say,
    showBanner,
    updateObjective,
    /**
     * Advance the world one fixed step. input is the input object (or null in title mode).
     * titleMode steps only the traffic and pedestrians, for the animated title backdrop.
     */
    step(dt, input, titleMode = false) {
      state.time += dt;
      state.crimeEvent = false;
      updateTraffic(dt);
      updatePeds(dt);
      updateParticles(dt);
      if (titleMode) {
        state.camera.x = 640 + Math.sin(state.time * 0.05) * 260;
        state.camera.y = 560 + Math.cos(state.time * 0.04) * 120;
        return 0;
      }
      if (state.over) return EVENT_OVER;
      updatePlayer(dt, input);
      updatePolice(dt);
      updateWanted(dt);
      updateCamera(dt);
      checkStep();
      let events = 0;
      if (state.crimeEvent) events |= EVENT_CRIME;
      if (state.player.health <= 0) {
        state.over = 'wasted';
        events |= EVENT_OVER;
      } else if (state.over === 'busted' || state.over === 'complete') {
        events |= EVENT_OVER;
      }
      return events;
    },
    serialize() {
      return { missionIndex: state.missionIndex, cash: state.cash, hasPistol: state.hasPistol };
    },
    restore(save) {
      if (!save) return;
      state.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
      state.cash = save.cash || 0;
      state.hasPistol = !!save.hasPistol;
      state.stepIndex = 0;
      state.checkpointCash = state.cash;
      const mission = MISSIONS[state.missionIndex];
      if (mission) {
        if (mission.startWanted) state.wanted = mission.startWanted;
        if (mission.id === 'alley') {
          state.hasPistol = true;
          spawnThugs();
        }
        if (mission.id === 'score') {
          state.cars.push({ id: 'getaway', kind: 'parked', color: '#2a2a3a', x: 1030, y: 930, angle: 0, speed: 0 });
        }
      }
      updateObjective();
    },
  };
}
