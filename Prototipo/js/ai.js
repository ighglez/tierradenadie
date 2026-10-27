'use strict';
// Infectados y fauna: modelos, comportamiento y aparición dinámica.
(function () {
  const A = G.ai = { zombies: [], deer: [], noises: [] };
  const W = () => G.world;
  const MAX_Z = 45, MAX_DEER = 6;

  A.noise = function (x, z, radius) {
    A.noises.push({ x, z, r: radius, t: G.state.time });
  };

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const matCache = {};
  // cápsulas redondeadas con textura de tela sucia o piel en lugar de cajas
  const capGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 10); capGeo.scale(1, 0.5, 1);
  const headGeo = new THREE.SphereGeometry(0.5, 12, 10);
  const SKIN_SET = new Set([0x8a9a7a, 0x9a9a88, 0x7a8a70, 0xa0a090]);
  const mat = (c) => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c, map: SKIN_SET.has(c) ? G.gfx.tex.skin : G.gfx.tex.cloth }));
  function part(parent, sx, sy, sz, x, y, z, color, geo) {
    const m = new THREE.Mesh(geo || (sx < 0.06 ? boxGeo : capGeo), mat(color));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
    parent.add(m); return m;
  }
  function limb(parent, px, py, pz, sx, sy, sz, color) {
    const pivot = new THREE.Group(); pivot.position.set(px, py, pz); parent.add(pivot);
    part(pivot, sx, sy, sz, 0, -sy / 2, 0, color);
    return pivot;
  }

  const SHIRTS = [0x4a5a6a, 0x6a3a2a, 0x3a4a2a, 0x7a7a6a, 0x2a2a3a, 0x8a6a4a, 0x5a2a3a, 0x445566];
  const PANTS = [0x2a3040, 0x3a3020, 0x2a2a2a, 0x4a4a3a, 0x303828];
  const SKINS = [0x8a9a7a, 0x9a9a88, 0x7a8a70, 0xa0a090];

  class Zombie {
    constructor(x, z, zone, military) {
      this.x = x; this.z = z; this.y = W().groundAt(x, z); this.zone = zone;
      this.yaw = Math.random() * Math.PI * 2;
      this.hp = 100; this.dead = false; this.state = 'idle';
      this.home = { x, z }; this.target = null; this.thinkT = Math.random() * 0.3;
      this.wanderT = Math.random() * 5; this.attackT = 0; this.lostT = 0; this.groanT = 3 + Math.random() * 8;
      this.phase = Math.random() * 10; this.speed = 0; this.deadT = 0;
      const g = this.mesh = new THREE.Group();
      const shirt = military ? 0x4d5530 : G.pick(SHIRTS), pants = military ? 0x3d4228 : G.pick(PANTS), skin = G.pick(SKINS);
      this.body = new THREE.Group(); g.add(this.body);
      part(this.body, 0.46, 0.66, 0.26, 0, 1.17, 0, shirt);
      part(this.body, 0.38, 0.22, 0.22, 0, 0.9, 0, pants); // cadera
      this.head = part(this.body, 0.23, 0.27, 0.25, 0, 1.63, 0.03, skin, headGeo);
      part(this.body, 0.12, 0.12, 0.12, 0, 1.47, 0, skin); // cuello
      part(this.body, 0.05, 0.04, 0.02, -0.06, 1.66, 0.155, 0x300000);
      part(this.body, 0.05, 0.04, 0.02, 0.06, 1.66, 0.155, 0x300000);
      this.armL = limb(this.body, -0.32, 1.44, 0, 0.13, 0.62, 0.13, shirt);
      this.armR = limb(this.body, 0.32, 1.44, 0, 0.13, 0.62, 0.13, shirt);
      part(this.armL, 0.11, 0.12, 0.11, 0, -0.66, 0, skin);
      part(this.armR, 0.11, 0.12, 0.11, 0, -0.66, 0, skin);
      this.legL = limb(this.body, -0.13, 0.86, 0, 0.18, 0.86, 0.19, pants);
      this.legR = limb(this.body, 0.13, 0.86, 0, 0.18, 0.86, 0.19, pants);
      g.position.set(x, this.y, z);
      G.scene.add(g);
    }

    takeDamage(dmg, partName, melee) {
      if (this.dead) return;
      const mult = partName === 'head' ? (melee ? 1.6 : 3) : partName === 'legs' ? 0.7 : 1;
      this.hp -= dmg * mult;
      this.state = 'chase'; this.lostT = 0;
      this.target = { x: G.player.pos.x, z: G.player.pos.z };
      this.stagger = melee ? 0.5 : 0.25;
      if (this.hp <= 0) this.die();
    }

    die() {
      this.dead = true; this.deadT = 0;
      G.state.kills++;
      A.zoneDeath(this.zone);
      if (Math.random() < 0.35) {
        const it = G.rollLoot('zombie');
        G.loot.drop(it, this.x + 0.6, W().groundAt(this.x + 0.6, this.z, this.y), this.z);
      }
    }

    perceive(P, day) {
      const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz);
      if (P.dead) return false;
      // oído: pasos del jugador
      if (d < P.noiseRadius * (this.state === 'idle' ? 0.8 : 1)) return true;
      // vista
      const vis = G.world.weather ? 1 - G.world.weather.fog * 0.5 - G.world.weather.rain * 0.2 : 1;
      let range = G.lerp(16, 55, day) * vis * (P.crouch ? 0.5 : P.prone ? (P.inside ? 0.3 : 0.18) : 1);
      if (P.flashOn && day < 0.5) range = Math.max(range, 45);
      if (d > range) return false;
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.25 && d > 3.5) return false;
      return !W().segmentBlocked(this.x, this.y + 1.6, this.z, P.pos.x, P.pos.y + P.eyeHeight(), P.pos.z);
    }

    update(dt, P, day) {
      const g = this.mesh;
      if (this.dead) {
        this.deadT += dt;
        const t = Math.min(1, this.deadT * 2.5);
        this.body.rotation.x = -t * Math.PI / 2;
        this.body.position.y = 0.15 * t;
        return;
      }
      const dx = P.pos.x - this.x, dz = P.pos.z - this.z, dist = Math.hypot(dx, dz);
      // percepción (escalonada)
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = 0.25;
        if (this.perceive(P, day)) {
          if (this.state !== 'chase' && this.state !== 'attack') G.audio.groan(this, true);
          if (this.state !== 'attack') this.state = 'chase';
          this.lostT = 0;
          this.target = { x: P.pos.x, z: P.pos.z };
        } else if (this.state === 'chase') {
          this.lostT += 0.25;
          if (this.lostT > 6) this.state = 'alert';
        }
        for (const n of A.noises) {
          if (this.state === 'chase') break;
          if (G.state.time - n.t < 0.6 && G.dist2(n.x, n.z, this.x, this.z) < n.r) {
            this.state = 'alert';
            this.target = { x: n.x + G.randRange(-6, 6), z: n.z + G.randRange(-6, 6) };
          }
        }
      }
      let speed = 0, tx = null, tz = null;
      if (this.stagger > 0) this.stagger -= dt;
      if (this.state === 'idle') {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 6 + Math.random() * 10;
          this.target = Math.random() < 0.6 ? { x: this.home.x + G.randRange(-15, 15), z: this.home.z + G.randRange(-15, 15) } : null;
        }
        if (this.target) {
          tx = this.target.x; tz = this.target.z; speed = 0.8;
          if (G.dist2(tx, tz, this.x, this.z) < 1) this.target = null;
        }
      } else if (this.state === 'alert') {
        if (this.target) { tx = this.target.x; tz = this.target.z; speed = 2.8; }
        if (!this.target || G.dist2(tx, tz, this.x, this.z) < 1.5) { this.state = 'idle'; this.home = { x: this.x, z: this.z }; this.target = null; this.wanderT = 4; }
      } else if (this.state === 'chase') {
        tx = this.target.x; tz = this.target.z;
        speed = W().insideBuilding(this.x, this.z) || W().insideBuilding(P.pos.x, P.pos.z) ? 2.2 : 5.1;
        if (dist < 1.45 && !P.dead && Math.abs(P.pos.y - this.y) < 1.8) { this.state = 'attack'; this.attackT = 0; }
        if (G.dist2(tx, tz, this.x, this.z) < 1 && dist > 3) { this.state = 'alert'; }
      } else if (this.state === 'attack') {
        tx = P.pos.x; tz = P.pos.z;
        this.attackT += dt;
        if (this.attackT > 0.55 && !this.hitDone) {
          this.hitDone = true;
          if (dist < 1.9 && !P.dead) P.damage(G.randRange(8, 16) * (P.eq.helmet ? 0.85 : 1), 0.3, 'un infectado', { dirty: true, fracture: 0.025, shock: G.randRange(12, 24) });
        }
        if (this.attackT > 1.1) {
          this.hitDone = false;
          this.state = dist < 1.6 ? 'attack' : 'chase';
          this.attackT = 0;
        }
      }
      if (this.stagger > 0) speed *= 0.2;
      // movimiento
      if (tx !== null) {
        const mx = tx - this.x, mz = tz - this.z, ml = Math.hypot(mx, mz);
        if (ml > 0.05) {
          const desired = Math.atan2(mx, mz);
          let da = desired - this.yaw;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          this.yaw += da * Math.min(1, dt * 6);
          if (this.state !== 'attack') {
            const step = Math.min(speed * dt, ml);
            this.x += mx / ml * step; this.z += mz / ml * step;
          }
        }
      }
      // separación entre infectados
      for (const o of A.zombies) {
        if (o === this || o.dead) continue;
        const ox = this.x - o.x, oz = this.z - o.z, od = ox * ox + oz * oz;
        if (od < 0.5 && od > 1e-5) { const s = Math.sqrt(od); this.x += ox / s * (0.71 - s) * 0.5; this.z += oz / s * (0.71 - s) * 0.5; }
      }
      // no atravesar al jugador
      if (dist < 0.7 && dist > 0.01) { this.x = P.pos.x - dx / dist * 0.7; this.z = P.pos.z - dz / dist * 0.7; }
      const c = W().collide(this.x, this.z, 0.3, this.y + 0.1, this.y + 1.7);
      this.x = c.x; this.z = c.z;
      const gy = W().groundAt(this.x, this.z, this.y);
      this.y += (Math.max(gy, -1.4) - this.y) * Math.min(1, dt * 10);
      g.position.set(this.x, this.y, this.z);
      g.rotation.y = this.yaw;
      // animación
      this.speed += ((tx !== null && this.state !== 'attack' ? speed : 0) - this.speed) * Math.min(1, dt * 6);
      this.phase += dt * (2 + this.speed * 2.2);
      const amp = Math.min(1, this.speed / 4) * 0.8 + (this.speed > 0.1 ? 0.15 : 0);
      this.legL.rotation.x = Math.sin(this.phase) * amp;
      this.legR.rotation.x = -Math.sin(this.phase) * amp;
      const chasing = this.state === 'chase' || this.state === 'attack';
      const armBase = chasing ? -1.35 : -0.15;
      const swipe = this.state === 'attack' ? Math.sin(this.attackT * Math.PI / 1.1 * 2) * 0.8 : 0;
      this.armL.rotation.x = armBase + Math.sin(this.phase + 1) * 0.15 - swipe;
      this.armR.rotation.x = armBase - Math.sin(this.phase + 1) * 0.15 + swipe * 0.5;
      this.body.rotation.x = chasing ? 0.15 : 0.05;
      this.head.rotation.z = Math.sin(this.phase * 0.3) * 0.2;
      // gruñidos
      this.groanT -= dt;
      if (this.groanT <= 0) { this.groanT = (chasing ? 2 : 8) + Math.random() * 8; if (dist < 60) G.audio.groan(this, chasing); }
    }
    remove() { G.scene.remove(this.mesh); }
  }

  class Deer {
    constructor(x, z) {
      this.x = x; this.z = z; this.y = W().terrainHeight(x, z);
      this.yaw = Math.random() * 6.28; this.hp = 100; this.dead = false; this.gutted = false;
      this.fleeT = 0; this.wanderT = 0; this.target = null; this.phase = 0; this.speed = 0;
      const g = this.mesh = new THREE.Group();
      const c = 0x7a5232;
      this.body = new THREE.Group(); g.add(this.body);
      part(this.body, 0.45, 0.5, 1.2, 0, 1.0, 0, c);
      part(this.body, 0.22, 0.55, 0.22, 0, 1.35, 0.58, c).rotation.x = 0.5;
      part(this.body, 0.22, 0.22, 0.4, 0, 1.6, 0.8, c);
      part(this.body, 0.08, 0.3, 0.08, -0.08, 1.85, 0.72, 0x4a3420);
      part(this.body, 0.08, 0.3, 0.08, 0.08, 1.85, 0.72, 0x4a3420);
      part(this.body, 0.15, 0.12, 0.08, 0, 1.12, -0.62, 0xe8e0d0);
      this.legs = [[-0.15, 0.45], [0.15, 0.45], [-0.15, -0.45], [0.15, -0.45]].map(([lx, lz]) => limb(this.body, lx, 0.78, lz, 0.09, 0.78, 0.09, 0x5a3a22));
      g.position.set(x, this.y, z);
      G.scene.add(g);
    }
    takeDamage(dmg, partName) {
      if (this.dead) return;
      this.hp -= dmg * (partName === 'head' ? 2.5 : 1);
      this.fleeT = 10;
      if (this.hp <= 0) { this.dead = true; this.deadT = 0; this.removeAt = G.state.time + 600; }
    }
    update(dt, P) {
      if (this.dead) {
        this.deadT += dt;
        this.body.rotation.z = Math.min(1, this.deadT * 2) * Math.PI / 2;
        this.body.position.y = -0.55 * Math.min(1, this.deadT * 2) + 0.3 * Math.min(1, this.deadT * 2);
        return;
      }
      const dx = this.x - P.pos.x, dz = this.z - P.pos.z, dist = Math.hypot(dx, dz);
      const scare = P.sprinting ? 50 : P.prone ? 7 : P.crouch ? 12 : P.walk ? 18 : 26;
      if (!P.dead && dist < scare) this.fleeT = 6;
      for (const n of A.noises) if (G.state.time - n.t < 0.5 && G.dist2(n.x, n.z, this.x, this.z) < n.r * 1.3) this.fleeT = 8;
      let speed = 0, tx = null, tz = null;
      if (this.fleeT > 0) {
        this.fleeT -= dt;
        speed = 9; tx = this.x + dx / (dist || 1) * 10; tz = this.z + dz / (dist || 1) * 10;
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = 5 + Math.random() * 10; this.target = Math.random() < 0.5 ? { x: this.x + G.randRange(-12, 12), z: this.z + G.randRange(-12, 12) } : null; }
        if (this.target) { tx = this.target.x; tz = this.target.z; speed = 1.1; if (G.dist2(tx, tz, this.x, this.z) < 1) this.target = null; }
      }
      if (tx !== null) {
        const mx = tx - this.x, mz = tz - this.z, ml = Math.hypot(mx, mz);
        if (ml > 0.05) {
          const desired = Math.atan2(mx, mz);
          let da = desired - this.yaw;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          this.yaw += da * Math.min(1, dt * 5);
          this.x += Math.sin(this.yaw) * speed * dt; this.z += Math.cos(this.yaw) * speed * dt;
        }
      }
      const c = W().collide(this.x, this.z, 0.5, this.y + 0.2, this.y + 1.6);
      this.x = c.x; this.z = c.z;
      // evitar el agua profunda
      if (W().terrainHeight(this.x, this.z) < -0.5) { this.yaw += Math.PI; this.fleeT = Math.min(this.fleeT, 1); }
      this.y = W().groundAt(this.x, this.z, this.y);
      this.mesh.position.set(this.x, this.y, this.z);
      this.mesh.rotation.y = this.yaw;
      this.speed += ((tx !== null ? speed : 0) - this.speed) * Math.min(1, dt * 5);
      this.phase += dt * (1 + this.speed * 1.6);
      const amp = Math.min(0.7, this.speed * 0.12);
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.phase + (i % 3 === 0 ? 0 : Math.PI)) * amp; });
    }
    remove() { G.scene.remove(this.mesh); }
  }

  // ---- Aparición ----
  const zoneState = new Map();
  function zs(t) { if (!zoneState.has(t)) zoneState.set(t, { cooldown: 0 }); return zoneState.get(t); }
  A.zoneDeath = function (zone) { if (zone) zs(zone).cooldown = G.state.time + 25; };
  function zoneTarget(t) { return t.kind === 'military' ? 16 : t.kind === 'farm' ? 3 : Math.round(5 + t.houses * 0.5); }

  let spawnT = 0;
  A.update = function (dt, P, day) {
    const now = G.state.time;
    A.noises = A.noises.filter((n) => now - n.t < 1);
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 1; spawnTick(P, now); }
    for (let i = A.zombies.length - 1; i >= 0; i--) {
      const z = A.zombies[i];
      const d = G.dist2(z.x, z.z, P.pos.x, P.pos.z);
      if (d > 340 || (z.dead && z.deadT > 120)) { z.remove(); A.zombies.splice(i, 1); continue; }
      // los lejanos se actualizan con menos frecuencia
      if (d > 150 && !z.dead) { z.farAcc = (z.farAcc || 0) + dt; if (z.farAcc < 0.25) continue; z.update(z.farAcc, P, day); z.farAcc = 0; }
      else z.update(dt, P, day);
    }
    for (let i = A.deer.length - 1; i >= 0; i--) {
      const d = A.deer[i];
      if (G.dist2(d.x, d.z, P.pos.x, P.pos.z) > 380 || (d.dead && now > d.removeAt)) { d.remove(); A.deer.splice(i, 1); continue; }
      d.update(dt, P);
    }
  };

  function spawnTick(P, now) {
    if (P.dead) return;
    const alive = A.zombies.filter((z) => !z.dead);
    if (alive.length < MAX_Z) {
      for (const t of W().towns) {
        const dt = G.dist2(t.x, t.z, P.pos.x, P.pos.z);
        if (dt > 260) continue;
        const st = zs(t);
        const count = alive.filter((z) => z.zone === t).length;
        if (count >= zoneTarget(t) || now < st.cooldown) continue;
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * t.r;
          const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
          const pd = G.dist2(x, z, P.pos.x, P.pos.z);
          if (pd < 35 || W().terrainHeight(x, z) < 0.5) continue;
          A.zombies.push(new Zombie(x, z, t, t.kind === 'military'));
          st.cooldown = now + (dt < 120 ? 4 : 0.3);
          break;
        }
      }
      // errantes por el campo
      const wild = alive.filter((z) => !z.zone).length;
      if (wild < 3 && Math.random() < 0.08) {
        const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 60;
        const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
        if (Math.abs(x) < W().BORDER && Math.abs(z) < W().BORDER && W().terrainHeight(x, z) > 0.5) A.zombies.push(new Zombie(x, z, null));
      }
    }
    // ciervos
    if (A.deer.filter((d) => !d.dead).length < MAX_DEER && Math.random() < 0.05) {
      const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 110;
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      if (Math.abs(x) < W().BORDER - 20 && Math.abs(z) < W().BORDER - 20 && W().terrainHeight(x, z) > 2 && !W().inTown(x, z, 40)) {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) A.deer.push(new Deer(x + G.randRange(-6, 6), z + G.randRange(-6, 6)));
      }
    }
  }

  A.spawnZombie = (x, z) => { const o = new Zombie(x, z, null); A.zombies.push(o); return o; };
  A.spawnDeer = (x, z) => { const o = new Deer(x, z); A.deer.push(o); return o; };

  A.clear = function () {
    for (const z of A.zombies) z.remove();
    for (const d of A.deer) d.remove();
    A.zombies.length = 0; A.deer.length = 0; A.noises.length = 0;
    zoneState.clear();
  };
})();
