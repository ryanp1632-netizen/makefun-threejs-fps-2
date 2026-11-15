// Third-person bodies for every combatant, built from shared box geometry in each team's
// colours: Lumen Cell in charcoal with ember-orange visors, Quarry Watch in slate with teal.
// The model matches the hit zones in combatant.js (head sphere at ~1.66 m, chest, stomach,
// legs). It walks, crouches, pitches its rifle to its aim and falls when killed. Allies carry a
// name tag that shows through walls; the carrier wears the charge on its back.
import * as THREE from 'three';
import { PALETTE } from '../core/palette.js';

const TEAM_LOOK = {
  cell: { fatigue: 0x6a6157, vest: 0x9a5426, accent: PALETTE.cell },
  watch: { fatigue: 0x55636d, vest: 0x2c6866, accent: PALETTE.watch },
};

const GEO = {
  leg: new THREE.BoxGeometry(0.17, 0.86, 0.2).translate(0, -0.43, 0),
  boot: new THREE.BoxGeometry(0.19, 0.12, 0.3).translate(0, -0.86, 0.04),
  torso: new THREE.BoxGeometry(0.46, 0.6, 0.27).translate(0, 0.3, 0),
  vest: new THREE.BoxGeometry(0.5, 0.42, 0.33).translate(0, 0.34, 0),
  stripe: new THREE.BoxGeometry(0.51, 0.06, 0.34).translate(0, 0.46, 0),
  head: new THREE.BoxGeometry(0.24, 0.27, 0.26),
  helmet: new THREE.BoxGeometry(0.29, 0.13, 0.31).translate(0, 0.13, -0.01),
  visor: new THREE.BoxGeometry(0.22, 0.06, 0.03).translate(0, 0.03, -0.14),
  arm: new THREE.BoxGeometry(0.12, 0.12, 0.5).translate(0, 0, -0.22),
  gun: new THREE.BoxGeometry(0.07, 0.11, 0.56).translate(0, 0, -0.34),
  barrel: new THREE.BoxGeometry(0.035, 0.035, 0.3).translate(0, 0.02, -0.76),
  mag: new THREE.BoxGeometry(0.05, 0.16, 0.07).translate(0, -0.12, -0.36),
  pad: new THREE.BoxGeometry(0.16, 0.1, 0.24),
  pouch: new THREE.BoxGeometry(0.11, 0.12, 0.07),
  knee: new THREE.BoxGeometry(0.19, 0.12, 0.06).translate(0, -0.45, -0.11),
  ear: new THREE.BoxGeometry(0.05, 0.1, 0.1),
  pack: new THREE.BoxGeometry(0.34, 0.36, 0.16),
  lamp: new THREE.BoxGeometry(0.08, 0.05, 0.02),
};

function tagTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,10,14,0.85)';
  g.strokeText(name, 128, 44);
  g.fillStyle = color; g.fillText(name, 128, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildSoldier(actor, mats) {
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const legL = new THREE.Group(); legL.position.x = -0.11; hips.add(legL);
  const legR = new THREE.Group(); legR.position.x = 0.11; hips.add(legR);
  for (const leg of [legL, legR]) {
    leg.add(new THREE.Mesh(GEO.leg, mats.fatigue));
    leg.add(new THREE.Mesh(GEO.boot, mats.dark));
    leg.add(new THREE.Mesh(GEO.knee, mats.dark));
  }
  const chest = new THREE.Group(); hips.add(chest);
  chest.add(new THREE.Mesh(GEO.torso, mats.fatigue));
  chest.add(new THREE.Mesh(GEO.vest, mats.vest));
  chest.add(new THREE.Mesh(GEO.stripe, mats.accent));
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(GEO.pad, mats.accent); pad.position.set(side * 0.29, 0.56, 0); chest.add(pad);
  }
  for (const x of [-0.13, 0, 0.13]) {
    const pouch = new THREE.Mesh(GEO.pouch, mats.dark); pouch.position.set(x, 0.24, -0.19); chest.add(pouch);
  }
  const pack = new THREE.Mesh(GEO.pack, mats.charge); pack.position.set(0, 0.36, 0.24); chest.add(pack);
  const packLamp = new THREE.Mesh(GEO.lamp, mats.chargeLamp); packLamp.position.set(0.08, 0.46, 0.33); chest.add(packLamp);
  const head = new THREE.Group(); head.position.y = 0.74; chest.add(head);
  head.add(new THREE.Mesh(GEO.head, mats.skin));
  head.add(new THREE.Mesh(GEO.helmet, mats.vest));
  head.add(new THREE.Mesh(GEO.visor, mats.accent));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(GEO.ear, mats.dark); ear.position.set(side * 0.14, 0.02, 0); head.add(ear);
  }
  const arms = new THREE.Group(); arms.position.set(0, 0.5, -0.05); chest.add(arms);
  const armL = new THREE.Mesh(GEO.arm, mats.fatigue); armL.position.set(-0.2, 0, 0); armL.rotation.y = -0.35; arms.add(armL);
  const armR = new THREE.Mesh(GEO.arm, mats.fatigue); armR.position.set(0.2, -0.02, 0); armR.rotation.y = 0.2; arms.add(armR);
  const gun = new THREE.Group(); gun.position.set(0.06, -0.02, -0.05); arms.add(gun);
  gun.add(new THREE.Mesh(GEO.gun, mats.gun), new THREE.Mesh(GEO.barrel, mats.gun), new THREE.Mesh(GEO.mag, mats.gun));
  // Only the big pieces cast shadows: the silhouette reads the same at a fraction of the cost.
  for (const part of [legL.children[0], legR.children[0], chest.children[0], chest.children[1], head.children[0]]) part.castShadow = true;

  let tag = null;
  if (!actor.isPlayer) {
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(actor.name, mats.tagColor), depthTest: false, transparent: true }));
    tag.scale.set(1.3, 0.33, 1);
    tag.position.y = 2.15;
    tag.renderOrder = 10;
    root.add(tag);
  }
  return { root, hips, legL, legR, chest, arms, pack, packLamp, tag, phase: 0, fall: 0 };
}

export function createSoldiers(scene, state) {
  const matsFor = (team) => {
    const look = TEAM_LOOK[team];
    return {
      fatigue: new THREE.MeshStandardMaterial({ color: look.fatigue, roughness: 0.9 }),
      vest: new THREE.MeshStandardMaterial({ color: look.vest, roughness: 0.8 }),
      accent: new THREE.MeshStandardMaterial({ color: look.accent, emissive: look.accent, emissiveIntensity: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8a6a55, roughness: 0.8 }),
      gun: new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.5, metalness: 0.6 }),
      charge: new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.7 }),
      chargeLamp: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
      tagColor: look.accent,
    };
  };
  const mats = { cell: matsFor('cell'), watch: matsFor('watch') };
  const views = state.actors.map((a) => {
    const v = buildSoldier(a, mats[a.team]);
    scene.add(v.root);
    return v;
  });

  /** Poses every body from the simulation; `viewer` is the player (its own body is hidden). */
  function update(dt, viewer) {
    for (let i = 0; i < state.actors.length; i++) {
      const a = state.actors[i];
      const v = views[i];
      const corpse = !a.alive && a.deathTime > 0 && state.phase !== 'freeze' && a.deathTime >= state.roundStartTime;
      v.root.visible = (a.alive || corpse) && !(a === viewer && a.alive);
      if (!v.root.visible) continue;
      v.root.position.set(a.pos.x, a.pos.y, a.pos.z);
      v.root.rotation.y = a.yaw;
      if (a.alive) {
        v.fall = 0;
        v.root.rotation.x = 0;
        const speed = Math.hypot(a.vel.x, a.vel.z);
        v.phase += speed * dt * 2.1;
        const swing = Math.sin(v.phase) * Math.min(1, speed / 3.5) * 0.55;
        const crouch = a.crouch;
        v.hips.position.y = 0.92 - crouch * 0.42;
        v.legL.rotation.x = swing - crouch * 0.9;
        v.legR.rotation.x = -swing - crouch * 0.9;
        v.chest.rotation.x = crouch * 0.18;
        v.arms.rotation.x = a.pitch - crouch * 0.18;
        v.pack.visible = v.packLamp.visible = a.hasCharge;
        if (v.tag) v.tag.visible = viewer && a.team === viewer.team;
      } else {
        v.fall = Math.min(1, v.fall + dt * 3.2);
        v.root.rotation.x = (v.fall * v.fall) * 1.45;
        v.hips.position.y = 0.92 - v.fall * 0.62;
        if (v.tag) v.tag.visible = false;
      }
    }
  }
  return { update };
}
