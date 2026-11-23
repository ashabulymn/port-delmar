// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one stages the real
// world from a fresh reset for a fixed number of steps, so the frame is what the game really
// looks like and the same seed always gives the same frame. The scenes are chosen to show the
// open world at its most complete: the title over the city, driving with traffic, a police
// chase with the wanted level and minimap, and a mission fight on foot.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A fixed input for staging: drive straight ahead (drive/chase) or stand still (mission). */
function stagedInput(forward) {
  return {
    steer() {
      return { x: 0, y: forward ? -1 : 0 };
    },
    running() {
      return false;
    },
    takeActions() {
      return 0;
    },
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best cash to show.
 * Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.setupShot(name);
  if (name === 'drive') {
    for (let i = 0; i < 2 / STEP; i++) world.step(STEP, stagedInput(true), false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    for (let i = 0; i < 2 / STEP; i++) world.step(STEP, stagedInput(true), false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    for (let i = 0; i < 0.6 / STEP; i++) world.step(STEP, stagedInput(false), false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  for (let i = 0; i < 3 / STEP; i++) world.step(STEP, stagedInput(false), true);
  return { screen: SCREEN_TITLE, best: 0 };
}
