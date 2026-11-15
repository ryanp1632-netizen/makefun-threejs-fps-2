// World effects, every one from a fixed pool made at load so firing allocates nothing: tracer
// streaks (one LineSegments), sparks, dust and blood (one Points cloud with per-particle alpha),
// bullet holes (one InstancedMesh), smoke clouds (sprite clusters), frag and flash bursts, the
// grenades in flight and the charge on the ground with its blinking lamp.
import * as THREE from 'three';

const TRACERS = 48;
const PARTICLES = 480;
const HOLES = 96;
const SMOKE_PUFFS = 18;

export function createEffects(scene, state, tex) {
  // ---- Tracers: a segment per round, fading over 70 ms ------------------------------------
  const tracerPos = new Float32Array(TRACERS * 6);
  const tracerCol = new Float32Array(TRACERS * 8);
  const tracerAge = new Float32Array(TRACERS).fill(1);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 4));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracers.frustumCulled = false;
  scene.add(tracers);
  let tracerNext = 0;

  function tracer(ox, oy, oz, ex, ey, ez) {
    const i = tracerNext++ % TRACERS;
    // Start a little ahead of the muzzle so the streak reads from first person.
    const dx = ex - ox, dy = ey - oy, dz = ez - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const s = Math.min(1.2, len * 0.5) / len;
    const o = i * 6;
    tracerPos[o] = ox + dx * s; tracerPos[o + 1] = oy + dy * s - 0.06; tracerPos[o + 2] = oz + dz * s;
    tracerPos[o + 3] = ex; tracerPos[o + 4] = ey; tracerPos[o + 5] = ez;
    tracerAge[i] = 0;
  }

  // ---- Particles: sparks (additive look via bright colour), dust and blood ----------------
  const pPos = new Float32Array(PARTICLES * 3);
  const pCol = new Float32Array(PARTICLES * 4);
  const pVel = new Float32Array(PARTICLES * 3);
  const pLife = new Float32Array(PARTICLES);
  const pMax = new Float32Array(PARTICLES).fill(1);
  const pGrav = new Float32Array(PARTICLES);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: tex.puff, vertexColors: true, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  let pNext = 0;

  function emit(x, y, z, vx, vy, vz, r, g, b, life, gravity) {
    const i = pNext++ % PARTICLES;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    pCol[i * 4] = r; pCol[i * 4 + 1] = g; pCol[i * 4 + 2] = b; pCol[i * 4 + 3] = 1;
    pLife[i] = life; pMax[i] = life; pGrav[i] = gravity;
  }

  function burst(x, y, z, nx, ny, nz, kind) {
    const rng = state.rng;
    if (kind === 'blood') {
      for (let k = 0; k < 10; k++) emit(x, y, z, rng.range(-1.2, 1.2), rng.range(0, 1.6), rng.range(-1.2, 1.2), 0.55, 0.05, 0.04, 0.45, 7);
      return;
    }
    for (let k = 0; k < 6; k++) emit(x, y, z, nx * 3 + rng.range(-2, 2), ny * 3 + rng.range(0, 3), nz * 3 + rng.range(-2, 2), 1.6, 1.1, 0.5, 0.18, 12);
    for (let k = 0; k < 5; k++) emit(x, y, z, nx * 0.8 + rng.range(-0.4, 0.4), ny * 0.8 + rng.range(0, 0.6), nz * 0.8 + rng.range(-0.4, 0.4), 0.62, 0.57, 0.5, 0.7, 1);
  }

  // ---- Bullet holes ------------------------------------------------------------------------
  const holes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.11, 0.11),
    new THREE.MeshBasicMaterial({ map: tex.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    HOLES,
  );
  holes.count = 0;
  holes.frustumCulled = false;
  scene.add(holes);
  let holeNext = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vPos = new THREE.Vector3();
  const vNormal = new THREE.Vector3();
  const vScale = new THREE.Vector3(1, 1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1);

  function hole(x, y, z, nx, ny, nz) {
    vNormal.set(nx, ny, nz);
    q.setFromUnitVectors(zAxis, vNormal);
    vPos.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
    m4.compose(vPos, q, vScale);
    holes.setMatrixAt(holeNext % HOLES, m4);
    holeNext++;
    holes.count = Math.min(HOLES, holeNext);
    holes.instanceMatrix.needsUpdate = true;
  }

  // ---- Smoke clouds: a cluster of soft sprites per active smoke ------------------------------
  const smokeMat = new THREE.SpriteMaterial({ map: tex.puff, color: 0xb9b4ac, transparent: true, depthWrite: false, fog: true });
  const smokeViews = state.smokes.map(() => {
    const g = new THREE.Group();
    const puffs = [];
    for (let k = 0; k < SMOKE_PUFFS; k++) {
      const s = new THREE.Sprite(smokeMat.clone());
      const a = (k / SMOKE_PUFFS) * Math.PI * 2 * 3.1;
      const r = 0.35 + (k % 6) / 6;
      s.userData.offset = new THREE.Vector3(Math.cos(a) * r, ((k * 7) % 10) / 10 - 0.35, Math.sin(a) * r);
      puffs.push(s);
      g.add(s);
    }
    g.visible = false;
    scene.add(g);
    return { g, puffs };
  });

  // ---- Bursts: frag fireball and flashbang pop, one light each ------------------------------
  const boomSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flare, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  boomSprite.visible = false;
  scene.add(boomSprite);
  const boomLight = new THREE.PointLight(0xffa050, 0, 22, 1.6);
  scene.add(boomLight);
  let boomAge = 9;

  function detonation(kind, x, y, z) {
    if (kind === 'smoke') {
      for (let k = 0; k < 14; k++) emit(x, y, z, state.rng.range(-2, 2), state.rng.range(0.5, 2), state.rng.range(-2, 2), 0.7, 0.7, 0.68, 1.2, -0.5);
      return;
    }
    boomAge = 0;
    boomSprite.position.set(x, y + 0.4, z);
    boomLight.position.set(x, y + 0.8, z);
    boomLight.color.set(kind === 'flash' ? 0xe8f0ff : 0xffa050);
    boomSprite.material.color.set(kind === 'flash' ? 0xffffff : 0xffb070);
    if (kind === 'frag') for (let k = 0; k < 40; k++) emit(x, y + 0.2, z, state.rng.range(-6, 6), state.rng.range(1, 7), state.rng.range(-6, 6), 1.4, 0.7, 0.3, 0.6, 9);
  }

  // ---- Grenades in flight and the charge -----------------------------------------------------
  const nadeMats = {
    frag: new THREE.MeshStandardMaterial({ color: 0x4b5a3c }),
    smoke: new THREE.MeshStandardMaterial({ color: 0x8b9094 }),
    flash: new THREE.MeshStandardMaterial({ color: 0x3f5d78 }),
  };
  const nadeGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const nadeViews = state.projectiles.map(() => {
    const m = new THREE.Mesh(nadeGeo, nadeMats.frag);
    m.castShadow = true;
    m.visible = false;
    scene.add(m);
    return m;
  });

  const chargeView = new THREE.Group();
  chargeView.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0x4a3f30, roughness: 0.7 })));
  const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0x1e2024 }));
  keypad.position.y = 0.1;
  chargeView.add(keypad);
  const chargeLampMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
  const chargeLamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), chargeLampMat);
  chargeLamp.position.set(0.15, 0.11, -0.08);
  chargeView.add(chargeLamp);
  const chargeGlow = new THREE.PointLight(0xff3b2f, 0, 2.5, 2);
  chargeGlow.position.y = 0.4;
  chargeView.add(chargeGlow);
  chargeView.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  chargeView.visible = false;
  scene.add(chargeView);
  let chargeBlink = 0;

  function onBeep() { chargeBlink = 0.12; }

  /** Advances every pool by one rendered frame. */
  function update(dt) {
    for (let i = 0; i < TRACERS; i++) {
      tracerAge[i] += dt;
      const a = Math.max(0, 1 - tracerAge[i] / 0.07);
      const o = i * 8;
      tracerCol[o] = 1; tracerCol[o + 1] = 0.85; tracerCol[o + 2] = 0.55; tracerCol[o + 3] = a * 0.25;
      tracerCol[o + 4] = 1; tracerCol[o + 5] = 0.92; tracerCol[o + 6] = 0.7; tracerCol[o + 7] = a;
    }
    tracerGeo.attributes.position.needsUpdate = true;
    tracerGeo.attributes.color.needsUpdate = true;

    for (let i = 0; i < PARTICLES; i++) {
      if (pLife[i] <= 0) { pCol[i * 4 + 3] = 0; continue; }
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= pGrav[i] * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pPos[i * 3 + 1] < 0.02) { pPos[i * 3 + 1] = 0.02; pVel[i * 3 + 1] *= -0.3; }
      pCol[i * 4 + 3] = Math.max(0, pLife[i] / pMax[i]);
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    for (let i = 0; i < smokeViews.length; i++) {
      const s = state.smokes[i], v = smokeViews[i];
      v.g.visible = s.active;
      if (!s.active) continue;
      v.g.position.set(s.x, s.y, s.z);
      const fade = Math.min(1, (s.life - s.age) / 2.5);
      for (let k = 0; k < v.puffs.length; k++) {
        const p = v.puffs[k], o = p.userData.offset;
        const r = s.radius;
        p.position.set(o.x * r * 0.75, o.y * r * 0.55, o.z * r * 0.75);
        const size = r * 1.25 + Math.sin(s.age * 0.6 + k) * 0.25;
        p.scale.set(size, size, 1);
        p.material.opacity = 0.92 * fade;
        p.material.rotation = k + s.age * 0.05 * (k % 2 ? 1 : -1);
      }
    }

    boomAge += dt;
    boomSprite.visible = boomAge < 0.35;
    if (boomSprite.visible) { const s = 2 + boomAge * 14; boomSprite.scale.set(s, s, 1); boomSprite.material.opacity = 1 - boomAge / 0.35; }
    boomLight.intensity = boomAge < 0.4 ? 260 * (1 - boomAge / 0.4) : 0;

    for (let i = 0; i < nadeViews.length; i++) {
      const p = state.projectiles[i], m = nadeViews[i];
      m.visible = p.active;
      if (!p.active) continue;
      m.material = nadeMats[p.kind];
      m.position.set(p.x, p.y, p.z);
    }

    const c = state.charge;
    chargeView.visible = c.phase === 'dropped' || c.phase === 'planted';
    if (chargeView.visible) {
      chargeView.position.set(c.x, c.y + 0.09, c.z);
      chargeBlink -= dt;
      const lit = c.phase === 'planted' && chargeBlink > 0;
      chargeLampMat.color.set(lit ? 0xff6050 : 0x5a1410);
      chargeGlow.intensity = lit ? 1.2 : 0;
    }
  }

  function clear() {
    holes.count = 0; holeNext = 0;
    pLife.fill(0);
    tracerAge.fill(1);
  }

  return { tracer, burst, hole, detonation, onBeep, update, clear };
}
