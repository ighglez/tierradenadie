'use strict';
// Efectos: hogueras, partículas (sangre, impactos).
(function () {
  const F = G.fx = { fires: [], parts: [] };
  let firePool = [];
  const partGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const partMats = {
    blood: new THREE.MeshBasicMaterial({ color: 0x7a0a0a }),
    dust: new THREE.MeshBasicMaterial({ color: 0x8a8070 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
  };
  const logGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
  const flameGeo = new THREE.ConeGeometry(0.3, 0.8, 7);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 });
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.9 });

  F.init = function (scene) {
    // luces fijas (cambiar el número de luces obliga a recompilar shaders)
    for (let k = 0; k < 3; k++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 22, 1.6);
      scene.add(l);
      firePool.push(l);
    }
  };

  F.addFire = function (x, y, z) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const l = new THREE.Mesh(logGeo, logMat);
      l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = k * Math.PI / 2;
      l.position.set(Math.cos(k * Math.PI / 2) * 0.2, 0.15, -Math.sin(k * Math.PI / 2) * 0.2);
      g.add(l);
    }
    const f1 = new THREE.Mesh(flameGeo, flameMat); f1.position.y = 0.45; g.add(f1);
    const f2 = new THREE.Mesh(flameGeo, flameMat2); f2.position.y = 0.38; f2.scale.set(0.55, 0.6, 0.55); g.add(f2);
    g.position.set(x, y, z);
    G.scene.add(g);
    const fire = { x, y, z, fuel: 360, mesh: g, f1, f2, dead: 0 };
    F.fires.push(fire);
    return fire;
  };

  F.particles = function (kind, x, y, z, n, spd) {
    for (let k = 0; k < n; k++) {
      let p = F.parts.find((q) => q.life <= 0);
      if (!p) {
        if (F.parts.length > 160) return;
        p = { mesh: new THREE.Mesh(partGeo, partMats[kind]), v: new THREE.Vector3(), life: 0 };
        F.parts.push(p); G.scene.add(p.mesh);
      }
      p.mesh.material = partMats[kind];
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.v.set((Math.random() - 0.5) * spd, Math.random() * spd, (Math.random() - 0.5) * spd);
      p.life = 0.5 + Math.random() * 0.5;
    }
  };

  F.update = function (dt, px, pz) {
    for (const p of F.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.life <= 0) p.mesh.visible = false;
    }
    const t = performance.now() / 1000;
    for (let i = F.fires.length - 1; i >= 0; i--) {
      const f = F.fires[i];
      if (f.fuel > 0) {
        f.fuel -= dt;
        const fl = 0.85 + Math.sin(t * 13 + i) * 0.1 + Math.random() * 0.08;
        f.f1.scale.set(fl, fl * (0.9 + Math.random() * 0.25), fl);
        f.f1.visible = f.f2.visible = true;
        if (Math.random() < dt * 4) F.particles('spark', f.x, f.y + 0.5, f.z, 1, 1.2);
        G.audio.fire(f);
      } else {
        f.f1.visible = f.f2.visible = false;
        f.dead += dt;
        if (f.dead > 180) { G.scene.remove(f.mesh); F.fires.splice(i, 1); }
      }
    }
    // asignar luces a las hogueras encendidas más cercanas
    const lit = F.fires.filter((f) => f.fuel > 0).sort((a, b) => G.dist2(a.x, a.z, px, pz) - G.dist2(b.x, b.z, px, pz));
    firePool.forEach((l, k) => {
      const f = lit[k];
      if (f) { l.position.set(f.x, f.y + 0.8, f.z); l.intensity = 1.6 + Math.sin(t * 17 + k) * 0.25 + Math.random() * 0.2; }
      else l.intensity = 0;
    });
  };

  F.clear = function () {
    for (const f of F.fires) G.scene.remove(f.mesh);
    F.fires.length = 0;
  };
})();
