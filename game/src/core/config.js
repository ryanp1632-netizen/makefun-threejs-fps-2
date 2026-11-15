// Every tuning number of the game in one place: simulation rate, body sizes, movement, the round
// clock and the economy. Modules read from here and never hard-code their own copies.

export const SIM = Object.freeze({
  step: 1 / 60,          // fixed simulation step (s); rendering interpolates nothing and runs at display rate
  maxStepsPerFrame: 5,   // spiral-of-death guard when a tab wakes from the background
});

export const BODY = Object.freeze({
  radius: 0.34,
  standHeight: 1.8,
  crouchHeight: 1.25,
  standEye: 1.62,
  crouchEye: 1.12,
  stepHeight: 0.38,      // a ledge this high is walked up; anything taller is a wall
  gravity: 19,
  jumpSpeed: 5.7,        // apex ~0.85 m: enough to mount a small crate, not a barrier
});

export const MOVE = Object.freeze({
  runSpeed: 5.4,         // knife-out top speed; weapons scale it down (see weapons.js speed)
  walkScale: 0.52,       // Shift: quiet, slower
  crouchScale: 0.36,
  groundAccel: 46,       // m/s^2 toward the wished velocity
  airAccel: 7,
  friction: 9.5,         // exponential ground friction once input stops
  stopSpeed: 1.6,        // below this, friction bites harder (crisp counter-strafe)
  footstepRunSpeed: 3.6, // above this a step is audible to bots
  taggedScale: 0.55,     // a body that was just hit is slowed: you cannot sprint through fire
  taggedTime: 0.45,
});

export const ROUND = Object.freeze({
  maxRounds: 12,
  winsNeeded: 7,
  halftimeAfter: 6,
  freezeTime: 7,         // buy phase, nobody moves
  buyWindow: 18,         // buying stays open this long into the round, inside your spawn
  roundTime: 105,
  bombTimer: 38,
  plantTime: 3.2,
  defuseTime: 7,
  defuseTimeKit: 3.6,
  endDelay: 5,
  teamSize: 5,
});

export const ECONOMY = Object.freeze({
  start: 800,
  max: 16000,
  winElimination: 3250,
  winObjective: 3500,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
  plantBonus: 300,
  plantedLossBonus: 800,
  defuseBonus: 300,
});

export const AI = Object.freeze({
  thinkInterval: 0.1,    // perception and decisions run at 10 Hz, staggered across bots
  fovCos: Math.cos((58 * Math.PI) / 180),
  viewRange: 78,
  closeSense: 3.2,       // inside this range a bot notices you even behind its back
  reactionMin: 0.24,
  reactionMax: 0.42,
  turnRate: 7.5,         // rad/s of aim the bot can sweep
  aimErrorStart: 0.075,  // radians of aim error the instant a target is acquired
  aimErrorSettle: 0.006, // error it settles to while tracking a still target
  aimSettleRate: 2.2,
  memory: 4.5,           // seconds a lost target is remembered
  hearGunshot: 46,
  hearStep: 13,
  hearGrenade: 22,
  hearObjective: 18,     // the click of a charge being planted or defused
});

export const TEAM_NAMES = Object.freeze({
  cell: 'Lumen Cell',
  watch: 'Quarry Watch',
});
