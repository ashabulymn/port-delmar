// Every tuning number, colour and mission in one place. The view is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The world is a 3200x2400 city, Port Delmar, with a road grid, blocks of buildings, a park,
// a marina lot and a pier on the water at the south edge.

export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Road centre lines (vertical x, horizontal y) and the road width. */
export const ROADS_V = [400, 1000, 1600, 2200, 2800];
export const ROADS_H = [400, 900, 1400, 1900];
export const ROAD_W = 120;
/** The water starts here (south edge); the pier reaches into it. */
export const WATER_Y = 2260;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  punchCooldown: 0.35,
  shootDamage: 34,
  shootRange: 460,
  shootCooldown: 0.28,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 540,
  maxReverse: 180,
  turnRate: 2.6,
  length: 54,
  width: 26,
};

export const WANTED = {
  max: 5,
  decaySeconds: 15,
  stealStars: 1,
  hitPedStars: 1,
  shootStars: 1,
};

export const SAVE_KEY = 'port-delmar.save.v1';
export const BEST_KEY = 'port-delmar.best.v1';

export const PALETTE = {
  backdrop: '#0e1420',
  grass: '#3d7a44',
  park: '#2f6b35',
  sidewalk: '#b9b3a4',
  road: '#33373f',
  roadLine: '#d8c95a',
  curb: '#8f887a',
  water: '#1e6f8e',
  pier: '#7a5c38',
  buildingRoof: ['#7a4a3a', '#4a5a7a', '#6a6a72', '#8a6a3a', '#5a7a5a', '#7a3a5a', '#3a6a7a'],
  buildingEdge: '#22242a',
  tree: '#2a5a2a',
  treeTop: '#3f8a3f',
  player: '#f2c94c',
  playerJacket: '#e5534b',
  taxi: '#f2c94c',
  comet: '#d21f2b',
  cop: '#2a4a8a',
  copLight: '#ff2a2a',
  copLight2: '#2a7aff',
  ped: ['#e8e8e8', '#7ab8e8', '#e8a87a', '#b87ae8', '#7ae8b8'],
  thug: '#5a2a5a',
  text: '#eef1f5',
  muted: '#aab2c0',
  panel: 'rgba(16, 20, 30, 0.82)',
  panelEdge: '#3a4356',
  star: '#f2c94c',
  starEmpty: '#5a6272',
  health: '#4caf50',
  healthLow: '#e5534b',
  marker: '#ffd23f',
  missionText: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * The story: five missions for Rook, a driver for hire. Each mission is a list of steps.
 * Step types: enter {carId} — get in that car; goto {x,y,r} — reach the marker (on foot or
 * by car); defeat {count} — beat that many thugs; take {x,y,r} — pick up the package;
 * lose {} — get the wanted level back to zero; reach {x,y,r} — arrive at the finish.
 */
export const MISSIONS = [
  {
    id: 'fare',
    title: 'Mission 1 — First Fare',
    intro: 'Mama Lou: "Take the taxi. Pick up the fare on Palm Row, drop him at the Grand Hotel."',
    reward: 150,
    steps: [
      { type: 'enter', carId: 'taxi', text: 'Get in the yellow taxi (E)' },
      { type: 'goto', x: 1060, y: 460, r: 70, text: 'Drive to the pickup on Palm Row' },
      { type: 'goto', x: 2260, y: 1460, r: 70, text: 'Drop the fare at the Grand Hotel' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Mission 2 — Hot Wheels',
    intro: 'Mama Lou: "A red Comet GT sits in the marina lot. Bring it to my garage, east side."',
    reward: 300,
    steps: [
      { type: 'goto', x: 2350, y: 2100, r: 80, text: 'Go to the marina lot' },
      { type: 'enter', carId: 'comet', text: 'Steal the red Comet GT (E)' },
      { type: 'goto', x: 2860, y: 1960, r: 80, text: 'Drive the Comet to Mama Lou’s garage' },
    ],
  },
  {
    id: 'alley',
    title: 'Mission 3 — Alley Pickup',
    intro: 'Mama Lou: "The package is in the alley. The Vipers guard it — fists and pistol ready."',
    reward: 250,
    steps: [
      { type: 'goto', x: 1900, y: 1650, r: 90, text: 'Go to the alley behind the market' },
      { type: 'defeat', count: 3, text: 'Deal with the three Vipers (F punch, Space shoot)' },
      { type: 'take', x: 1900, y: 1650, r: 60, text: 'Grab the package' },
    ],
  },
  {
    id: 'heat',
    title: 'Mission 4 — Hot Delivery',
    intro: 'Mama Lou: "Cops are on you already. Lose the heat, then deliver at the north docks."',
    reward: 500,
    startWanted: 2,
    steps: [
      { type: 'lose', text: 'Lose the police (wanted level to zero)' },
      { type: 'goto', x: 460, y: 960, r: 70, text: 'Deliver the package at the north docks' },
    ],
  },
  {
    id: 'score',
    title: 'Mission 5 — The Big Score',
    intro: 'Mama Lou: "Last job, Rook. The getaway car is waiting. Get to the pier boat!"',
    reward: 800,
    startWanted: 3,
    steps: [
      { type: 'enter', carId: 'getaway', text: 'Get in the getaway car (E)' },
      { type: 'reach', x: 1600, y: 2310, r: 70, text: 'Reach the pier boat — don’t stop!' },
    ],
  },
];
