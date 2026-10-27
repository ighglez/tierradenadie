'use strict';
// Combate: modelo en primera persona, disparo, cuerpo a cuerpo, recarga y linterna.
(function () {
  const I = G.ITEMS;
  const C = G.combat = { mouseDown: false, swingT: 0, recoil: 0, lastShot: -9, flashT: 0 };
  const FISTS = { name: 'Puños', dmg: 12, range: 1.7, rate: 0.55, stam: 5 };
  let vm, vmModel, muzzle, muzzleLight, flashlight, camera;

  const m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const skin = m(0xc49a7a), dark = m(0x1c1c1c), wood = m(0x5a3a1a), metal = m(0x9a9aa4), red = m(0x9a1a1a);
  function box(parent, w, h, d, x, y, z, mat) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z); parent.add(b); return b;
  }

  C.init = function (cam) {
    camera = cam;
    vm = new THREE.Group();
    camera.add(vm);
    muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd080 }));
    muzzle.visible = false;
    muzzleLight = new THREE.PointLight(0xffc070, 0, 15, 2);
    camera.add(muzzleLight);
    muzzleLight.position.set(0.2, -0.1, -1);
    flashlight = new THREE.SpotLight(0xfff4dd, 0, 45, 0.42, 0.45, 1.2);
    flashlight.position.set(0.15, -0.15, 0);
    camera.add(flashlight);
    const tgt = new THREE.Object3D(); tgt.position.set(0.1, -0.1, -10); camera.add(tgt);
    flashlight.target = tgt;
    C.onHandChanged();
  };

  function buildModel(id) {
    const g = new THREE.Group();
    let muzzlePos = null;
    if (!id) {
      box(g, 0.09, 0.09, 0.3, 0.12, -0.02, 0, skin);
      box(g, 0.09, 0.09, 0.3, -0.24, -0.04, 0.02, skin);
    } else if (id === 'knife') {
      box(g, 0.035, 0.035, 0.12, 0, 0, 0, dark);
      box(g, 0.01, 0.03, 0.2, 0, 0.005, -0.16, metal);
      box(g, 0.09, 0.09, 0.22, 0, -0.03, 0.14, skin);
    } else if (id === 'bat') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.85, 8), wood);
      b.rotation.x = -1.1; b.position.set(0, 0.2, -0.2); g.add(b);
      box(g, 0.09, 0.09, 0.22, 0, -0.06, 0.08, skin);
    } else if (id === 'axe') {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), wood);
      h.rotation.x = -1.1; h.position.set(0, 0.17, -0.2); g.add(h);
      box(g, 0.03, 0.14, 0.2, 0, 0.36, -0.42, red);
      box(g, 0.09, 0.09, 0.22, 0, -0.06, 0.08, skin);
    } else if (id === 'pistol') {
      box(g, 0.04, 0.05, 0.2, 0, 0.03, -0.05, dark);
      box(g, 0.035, 0.11, 0.05, 0, -0.04, 0.02, dark);
      box(g, 0.08, 0.08, 0.2, 0, -0.08, 0.14, skin);
      muzzlePos = [0, 0.03, -0.17];
    } else {
      const long = id === 'rifle' ? 0.95 : id === 'shotgun' ? 0.85 : 0.75;
      const bodyMat = id === 'ar' ? dark : wood;
      box(g, 0.06, 0.08, long * 0.55, 0, 0, -long * 0.15, bodyMat);
      box(g, 0.05, 0.1, 0.25, 0, -0.03, long * 0.2, bodyMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, long * 0.5, 6), dark);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.025, -long * 0.6); g.add(barrel);
      if (id === 'shotgun') { const b2 = barrel.clone(); b2.position.x = 0.03; g.add(b2); }
      if (id === 'ar') { box(g, 0.04, 0.14, 0.06, 0, -0.1, -0.1, dark); box(g, 0.03, 0.04, 0.12, 0, 0.07, -0.05, dark); }
      if (id === 'rifle') { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), dark); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.08, -0.1); g.add(sc); }
      box(g, 0.08, 0.08, 0.2, 0, -0.08, 0.0, skin);
      box(g, 0.08, 0.08, 0.2, -0.02, -0.06, -long * 0.35, skin);
      muzzlePos = [0, 0.025, -long * 0.85];
    }
    if (muzzlePos) { muzzle.position.set(...muzzlePos); g.add(muzzle); }
    return g;
  }

  C.onHandChanged = function () {
    if (!vm) return;
    if (vmModel) vm.remove(vmModel);
    const it = G.player.handItem();
    vmModel = buildModel(it ? it.id : null);
    vm.add(vmModel);
  };

  function weaponDef() {
    const it = G.player.handItem();
    return it ? I[it.id] : FISTS;
  }

  C.onMouseDown = function (btn) {
    if (btn === 0) { C.mouseDown = true; C.tryAttack(true); }
    if (btn === 2) G.player.aiming = true;
  };
  C.onMouseUp = function (btn) {
    if (btn === 0) C.mouseDown = false;
    if (btn === 2) G.player.aiming = false;
  };

  C.tryAttack = function (fresh) {
    const P = G.player;
    if (P.dead || P.action || P.unconscious) return;
    const it = P.handItem(), d = weaponDef();
    const now = G.state.time;
    if (now - C.lastShot < d.rate) return;
    if (it && it.cond !== undefined && it.cond <= 0) { if (fresh) G.ui.msg('Esta arma está destrozada, no sirve.'); return; }
    if (d.cat === 'gun') {
      if (!fresh && !d.auto) return;
      if (it.jammed) { if (fresh) { G.audio.dryFire(); G.ui.msg('¡Encasquillada! Pulsa R para desencasquillar.'); } C.lastShot = now; return; }
      if (it.loaded <= 0) { if (fresh) { G.audio.dryFire(); G.ui.msg('Sin munición. Pulsa R para recargar.'); } C.lastShot = now; return; }
      // un arma en mal estado se encasquilla más
      if (Math.random() < (1 - it.cond) * 0.07) { it.jammed = true; G.audio.dryFire(); G.ui.msg('¡Encasquillada!', 'bad'); C.lastShot = now; return; }
      fire(it, d);
      it.cond = Math.max(0, it.cond - 0.003);
    } else {
      if (!fresh) return;
      melee(d);
    }
    C.lastShot = now;
  };

  function forward() {
    const P = G.player;
    const yaw = P.yaw + P.swayX, pitch = P.pitch + P.swayY;
    return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  function fire(it, d) {
    const P = G.player;
    it.loaded--;
    G.audio.shot(it.id);
    G.ai.noise(P.pos.x, P.pos.z, d.noise);
    muzzle.visible = true; C.flashT = 0.05;
    muzzleLight.intensity = 3;
    const moving = P.speed > 0.5;
    const spread = d.spread * (P.aiming ? 0.45 : 1.6) * (moving ? 2 : 1) * (P.crouch ? 0.75 : P.prone ? 0.5 : 1) * (1.6 - it.cond * 0.6);
    const f = forward();
    const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z; // incluye inclinarse
    const right = new THREE.Vector3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const up = new THREE.Vector3().crossVectors(right, f);
    for (let k = 0; k < (d.pellets || 1); k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = f.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      hitscan(ox, oy, oz, dir, d.range, d.dmg);
    }
    const kick = { pistol: 0.03, shotgun: 0.07, rifle: 0.06, ar: 0.018 }[it.id] || 0.03;
    P.pitch = G.clamp(P.pitch + kick * (P.aiming ? 0.6 : 1), -1.5, 1.5);
    P.yaw += (Math.random() - 0.5) * kick * 0.4;
    C.recoil = 1;
  }

  function hitscan(ox, oy, oz, dir, range, dmg) {
    const wallT = G.world.raycastSolid(ox, oy, oz, dir.x, dir.y, dir.z, range);
    let best = null, bestT = wallT;
    const test = (ent, cy, r, part, cx, cz) => {
      const t = G.raySphere(ox, oy, oz, dir.x, dir.y, dir.z, cx !== undefined ? cx : ent.x, cy, cz !== undefined ? cz : ent.z, r);
      if (t >= 0 && t < bestT) { bestT = t; best = { ent, part }; }
    };
    for (const z of G.ai.zombies) {
      if (z.dead) continue;
      if (Math.abs(z.x - ox) > range || Math.abs(z.z - oz) > range) continue;
      test(z, z.y + 1.62, 0.17, 'head');
      test(z, z.y + 1.15, 0.33, 'body');
      test(z, z.y + 0.5, 0.27, 'legs');
    }
    for (const d of G.ai.deer) {
      if (d.dead) continue;
      test(d, d.y + 1.0, 0.6, 'body');
      test(d, d.y + 1.45, 0.25, 'head', d.x + Math.sin(d.yaw) * 0.85, d.z + Math.cos(d.yaw) * 0.85);
    }
    const hx = ox + dir.x * bestT, hy = oy + dir.y * bestT, hz = oz + dir.z * bestT;
    if (best) {
      const falloff = G.clamp(1.2 - bestT / range, 0.5, 1);
      best.ent.takeDamage(dmg * falloff, best.part);
      G.fx.particles('blood', hx, hy, hz, 6, 2.5);
      G.ui.hitmarker(best.part === 'head');
    } else if (wallT < range) {
      G.fx.particles('dust', hx - dir.x * 0.05, hy - dir.y * 0.05, hz - dir.z * 0.05, 4, 1.5);
    }
  }

  function melee(d) {
    const P = G.player;
    if (P.stamina < d.stam) { G.ui.msg('Estoy demasiado cansado para golpear.'); return; }
    P.stamina -= d.stam;
    C.swingT = 1;
    G.audio.swing();
    G.ai.noise(P.pos.x, P.pos.z, 6);
    setTimeout(() => {
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      let best = null, bestD = d.range + 0.45;
      for (const e of [...G.ai.zombies, ...G.ai.deer]) {
        if (e.dead) continue;
        const dx = e.x - P.pos.x, dz = e.z - P.pos.z, dist = Math.hypot(dx, dz);
        if (dist > bestD || dist < 0.01) continue;
        if ((dx * fx + dz * fz) / dist < 0.55) continue;
        bestD = dist; best = e;
      }
      if (best) {
        const crit = Math.random() < 0.15 || P.pitch > 0.12;
        const hi = P.handItem();
        const wear = hi && hi.cond !== undefined ? 0.5 + hi.cond * 0.5 : 1;
        if (hi && hi.cond !== undefined) hi.cond = Math.max(0, hi.cond - 0.012);
        best.takeDamage(d.dmg * wear * (crit ? 1.8 : 1), crit ? 'head' : 'body', true);
        G.audio.hit(best);
        G.fx.particles('blood', best.x, best.y + 1.3, best.z, 5, 2);
        G.ui.hitmarker(crit);
      }
    }, 160);
  }

  C.reload = function () {
    const P = G.player, it = P.handItem();
    if (!it || I[it.id].cat !== 'gun' || P.action) return;
    const d = I[it.id];
    if (it.jammed) {
      G.audio.reload();
      return P.startAction('Desencasquillando', 1.6, () => { it.jammed = false; if (it.loaded > 0) it.loaded--; });
    }
    if (it.loaded >= d.mag) return;
    const have = P.count(d.ammo);
    if (have <= 0) return G.ui.msg(`No me quedan balas (${I[d.ammo].name}).`);
    G.audio.reload();
    P.startAction('Recargando', d.reload, () => {
      const n = Math.min(d.mag - it.loaded, P.count(d.ammo));
      P.consume(d.ammo, n);
      it.loaded += n;
    });
  };

  C.update = function (dt) {
    const P = G.player;
    if (C.mouseDown) C.tryAttack(false);
    const d = weaponDef();
    // apuntar: zoom
    const targetFov = P.aiming ? (d.cat === 'gun' ? 70 / (d.zoom || 1.35) : 60) : 75;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    // posición del arma
    const aim = P.aiming && d.cat === 'gun';
    const bob = P.onGround ? Math.sin(performance.now() / (P.sprinting ? 90 : 140)) * Math.min(P.speed, 6) * 0.006 : 0;
    const tx = aim ? 0 : 0.22, ty = aim ? -0.1 : -0.24 + bob, tz = aim ? -0.32 : -0.45;
    vm.position.x += (tx - vm.position.x) * Math.min(1, dt * 14);
    vm.position.y += (ty - vm.position.y) * Math.min(1, dt * 14);
    vm.position.z += (tz + C.recoil * 0.06 - vm.position.z) * Math.min(1, dt * 20);
    C.recoil = Math.max(0, C.recoil - dt * 8);
    if (C.swingT > 0) {
      C.swingT = Math.max(0, C.swingT - dt * 3.5);
      const s = Math.sin(C.swingT * Math.PI);
      vm.rotation.set(-s * 0.9, s * 0.6, s * 0.5);
    } else vm.rotation.set(P.sprinting ? -0.3 : 0, P.sprinting ? 0.5 : 0, 0);
    vm.visible = !P.dead && !P.swimming;
    if (!P.handItem()) vmModel.visible = C.swingT > 0; // los puños solo se ven al golpear
    else vmModel.visible = true;
    if (C.flashT > 0) { C.flashT -= dt; if (C.flashT <= 0) { muzzle.visible = false; muzzleLight.intensity = 0; } }
    flashlight.intensity = P.flashOn && P.hasItem('flashlight') ? 2.2 : 0;
  };
})();
