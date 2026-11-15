// The armoury: every weapon, grenade and piece of gear, with its price and its handling.
// Accuracy is in radians of cone half-angle. A weapon is accurate standing still and crouched,
// and its cone widens with movement speed, airtime and a spray's length, so stopping to aim pays.

// Recoil is a fixed pattern a player can learn: each entry is the [pitch, yaw] kick of that shot
// in radians. The pattern climbs first, then wanders left and right.
const LANCER_PATTERN = [
  [0.000, 0.000], [0.010, 0.000], [0.014, 0.001], [0.016, -0.001], [0.017, 0.002],
  [0.016, 0.004], [0.013, 0.006], [0.010, 0.007], [0.006, 0.006], [0.004, -0.004],
  [0.003, -0.009], [0.002, -0.011], [0.002, -0.010], [0.002, -0.006], [0.002, 0.003],
  [0.001, 0.008], [0.001, 0.010], [0.001, 0.009], [0.001, 0.004], [0.001, -0.004],
  [0.001, -0.008], [0.001, -0.009], [0.001, -0.004], [0.001, 0.003], [0.001, 0.007],
  [0.001, 0.008], [0.001, 0.004], [0.001, -0.002], [0.001, -0.006], [0.001, -0.007],
];
const HORNET_PATTERN = [
  [0.000, 0.000], [0.007, 0.001], [0.009, 0.002], [0.010, -0.002], [0.010, 0.003],
  [0.008, 0.004], [0.006, -0.004], [0.004, -0.006], [0.003, -0.005], [0.002, 0.003],
  [0.002, 0.006], [0.002, 0.006], [0.001, 0.002], [0.001, -0.004], [0.001, -0.006],
  [0.001, -0.004], [0.001, 0.002], [0.001, 0.005], [0.001, 0.004], [0.001, -0.002],
];
const SINGLE_KICK = [[0.028, 0.002]];

export const SLOT = Object.freeze({ PRIMARY: 1, SIDEARM: 2, MELEE: 3, GRENADE: 4, CHARGE: 5 });

export const WEAPONS = {
  wren: {
    id: 'wren', name: 'Wren-9', kind: 'Sidearm', slot: SLOT.SIDEARM, price: 0, killReward: 300,
    damage: 30, armorPen: 0.5, headMult: 4, rangeFalloff: 0.8, pellets: 1,
    auto: false, rpm: 400, mag: 12, reserve: 36, reload: 2.1,
    spread: 0.006, moveSpread: 0.034, airSpread: 0.09, sprayGrow: 0.012, maxSpray: 0.03, recover: 7,
    pattern: SINGLE_KICK, kick: 0.9, speed: 1.0, sound: 'pistol',
  },
  pike: {
    id: 'pike', name: 'Pike .50', kind: 'Sidearm', slot: SLOT.SIDEARM, price: 700, killReward: 300,
    damage: 54, armorPen: 0.85, headMult: 4, rangeFalloff: 0.84, pellets: 1,
    auto: false, rpm: 230, mag: 7, reserve: 35, reload: 2.3,
    spread: 0.005, moveSpread: 0.07, airSpread: 0.16, sprayGrow: 0.03, maxSpray: 0.06, recover: 4,
    pattern: [[0.05, 0.004]], kick: 1.6, speed: 0.98, sound: 'heavy',
  },
  hornet: {
    id: 'hornet', name: 'Hornet SMG', kind: 'SMG', slot: SLOT.PRIMARY, price: 1250, killReward: 600,
    damage: 26, armorPen: 0.6, headMult: 3.6, rangeFalloff: 0.7, pellets: 1,
    auto: true, rpm: 860, mag: 30, reserve: 120, reload: 2.4,
    spread: 0.009, moveSpread: 0.022, airSpread: 0.07, sprayGrow: 0.0025, maxSpray: 0.035, recover: 6,
    pattern: HORNET_PATTERN, kick: 0.6, speed: 0.95, sound: 'smg',
  },
  bracken: {
    id: 'bracken', name: 'Bracken-12', kind: 'Shotgun', slot: SLOT.PRIMARY, price: 1100, killReward: 900,
    damage: 19, armorPen: 0.5, headMult: 2.5, rangeFalloff: 0.55, pellets: 8,
    auto: false, rpm: 70, mag: 6, reserve: 32, reload: 3.2,
    spread: 0.055, moveSpread: 0.02, airSpread: 0.05, sprayGrow: 0, maxSpray: 0, recover: 3,
    pattern: [[0.06, 0.0]], kick: 2.2, speed: 0.9, sound: 'shotgun',
  },
  lancer: {
    id: 'lancer', name: 'Lancer AR', kind: 'Rifle', slot: SLOT.PRIMARY, price: 2700, killReward: 300,
    damage: 35, armorPen: 0.78, headMult: 4, rangeFalloff: 0.98, pellets: 1,
    auto: true, rpm: 600, mag: 30, reserve: 90, reload: 2.5,
    spread: 0.0035, moveSpread: 0.075, airSpread: 0.2, sprayGrow: 0.0018, maxSpray: 0.03, recover: 5,
    pattern: LANCER_PATTERN, kick: 1.0, speed: 0.86, sound: 'rifle',
  },
  vigil: {
    id: 'vigil', name: 'Vigil DMR', kind: 'Marksman', slot: SLOT.PRIMARY, price: 4500, killReward: 100,
    damage: 112, armorPen: 0.97, headMult: 2.5, rangeFalloff: 0.99, pellets: 1,
    auto: false, rpm: 44, mag: 5, reserve: 25, reload: 3.6,
    spread: 0.0006, moveSpread: 0.14, airSpread: 0.3, sprayGrow: 0, maxSpray: 0, recover: 3,
    unscopedSpread: 0.075, scope: [40, 15], pattern: [[0.06, 0.0]], kick: 2.6, speed: 0.78, sound: 'marksman',
  },
  shiv: {
    id: 'shiv', name: 'Shiv', kind: 'Melee', slot: SLOT.MELEE, price: 0, killReward: 1500,
    damage: 40, backstab: 120, reach: 1.7, rpm: 110, melee: true, speed: 1.07, sound: 'swing',
  },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Frag', price: 300, max: 1, fuse: 1.6, radius: 7.5, damage: 98 },
  smoke: { id: 'smoke', name: 'Smoke', price: 300, max: 1, fuse: 1.4, radius: 4.6, life: 17 },
  flash: { id: 'flash', name: 'Flash', price: 200, max: 2, fuse: 1.3, radius: 26 },
};

export const GEAR = {
  vest: { id: 'vest', name: 'Vest', price: 650 },
  helm: { id: 'helm', name: 'Vest + Helmet', price: 1000 },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, side: 'def' },
};

// The buy menu's layout: one column per category, the order the keys 1-4 then 1-5 pick from.
export const BUY_MENU = [
  { title: 'Sidearms', items: ['pike'] },
  { title: 'Primaries', items: ['hornet', 'bracken', 'lancer', 'vigil'] },
  { title: 'Grenades', items: ['frag', 'smoke', 'flash'] },
  { title: 'Gear', items: ['vest', 'helm', 'kit'] },
];

export function itemById(id) {
  return WEAPONS[id] ?? GRENADES[id] ?? GEAR[id] ?? null;
}
