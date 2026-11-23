// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over (wasted or busted) and story complete.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRIME, EVENT_HIT, EVENT_MISSION, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
function readBest() {
  const n = readJson(BEST_KEY);
  return typeof n === 'number' ? n : 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const saved = readJson(SAVE_KEY);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let failedMission = 0;
  let failedCash = 0;

  world.state.saveExists = !!saved;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function saveProgress() {
    writeJson(SAVE_KEY, world.serialize());
    if (world.state.cash > best) {
      best = world.state.cash;
      writeJson(BEST_KEY, best);
    }
  }

  function startGame() {
    audio.unlock();
    if (saved) {
      world.reset();
      world.restore(saved);
      world.state.saveExists = true;
      announce(`Continuing. Mission ${world.state.missionIndex + 1} of 5.`);
    } else {
      world.reset();
      announce('Playing. Mission 1 of 5.');
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
  }

  function retryMission() {
    audio.unlock();
    world.reset();
    world.restore({ missionIndex: failedMission, cash: failedCash, hasPistol: failedMission >= 2 });
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Retrying mission ${failedMission + 1} of 5.`);
  }

  function endGame() {
    failedMission = world.state.missionIndex;
    failedCash = world.state.checkpointCash;
    if (world.state.over === 'complete') {
      screen = SCREEN_COMPLETE;
      saveProgress();
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      audio.jingle();
      announce(`Story complete. Total cash $${world.state.cash}.`);
      return;
    }
    screen = SCREEN_OVER;
    saveProgress();
    audio.busted();
    announce(world.state.over === 'wasted' ? `Wasted. Cash $${world.state.cash}.` : `Busted. Cash $${world.state.cash}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_OVER) retryMission();
      else if (screen === SCREEN_COMPLETE) {
        world.reset();
        accumulator = 0;
        screen = SCREEN_PLAY;
        announce('Playing. Mission 1 of 5.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      audio.unlock();
      world.enterOrExitCar();
    }
    if (actions & ACTION_PUNCH) {
      audio.unlock();
      world.punch();
      audio.thud();
    }
    if (actions & ACTION_SHOOT) {
      audio.unlock();
      world.shoot();
      audio.shot();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const events = world.step(STEP, input, false);
    if (events & EVENT_MISSION) {
      audio.jingle();
      saveProgress();
    }
    if (events & EVENT_HIT) audio.thud();
    if (events & EVENT_CRIME) {
      /* the wanted stars on the HUD already show it */
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const car = world.state.player.car;
    audio.update(STEP, car ? Math.abs(car.speed) / 540 : 0, world.state.wanted);
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Port Delmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// A handle for automated play-testing (and for the curious): the live world.
window.__game = world;
