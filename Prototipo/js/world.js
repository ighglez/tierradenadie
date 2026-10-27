'use strict';
// Generación del mundo: terreno, agua, bosques, pueblos, edificios, loot y entorno.
(function () {
  const W = G.world = {};
  const SIZE = W.SIZE = 1600, HALF = W.HALF = SIZE / 2, SEG = 320, CELL = SIZE / SEG;
  W.BORDER = HALF - 25;

  W.towns = [
    { name: 'Zalivsk', x: -300, z: 330, r: 70, houses: 13, kind: 'town' },
    { name: 'Rybachye', x: 360, z: 370, r: 55, houses: 9, kind: 'town' },
    { name: 'Lesnaya', x: 60, z: 60, r: 85, houses: 15, kind: 'town', clinic: true },
    { name: 'Vetrovo', x: -450, z: -140, r: 55, houses: 8, kind: 'town' },
    { name: 'Gornyak', x: 310, z: -400, r: 60, houses: 9, kind: 'town' },
    { name: 'Base Volk', x: -80, z: -540, r: 65, kind: 'military' },
    { name: 'Granja Ivanov', x: 540, z: -40, r: 30, kind: 'farm' },
    { name: 'Granja Sokol', x: -620, z: 170, r: 30, kind: 'farm' },
    { name: 'Granja Belaya', x: 150, z: 270, r: 30, kind: 'farm' },
  ];
  const lakes = [
    { x: -170, z: -250, r: 60, d: 22 },
    { x: 460, z: 160, r: 45, d: 18 },
    { x: -560, z: -470, r: 50, d: 20 },
  ];
  const roadPairs = [
    ['Zalivsk', 'Lesnaya'], ['Rybachye', 'Lesnaya'], ['Zalivsk', 'Rybachye'],
    ['Lesnaya', 'Vetrovo'], ['Lesnaya', 'Gornyak'], ['Vetrovo', 'Base Volk'],
    ['Gornyak', 'Base Volk'], ['Lesnaya', 'Granja Ivanov'], ['Vetrovo', 'Granja Sokol'],
    ['Lesnaya', 'Granja Belaya'], ['Zalivsk', 'Granja Sokol'],
  ];
  const townByName = (n) => W.towns.find((t) => t.name === n);
  W.roads = roadPairs.map(([a, b]) => { const A = townByName(a), B = townByName(b); return [A.x, A.z, B.x, B.z]; });

  W.coastZ = (x) => 520 + G.fbm(x * 0.004, 3.7, 3) * 70;
  W.isSea = (x, z) => z > W.coastZ(x) - 60;

  function rawHeight(x, z) {
    let h = 14 + G.fbm(x * 0.0025, z * 0.0025, 5) * 36;
    h += G.fbm(x * 0.013 + 50, z * 0.013, 3) * 3.5;
    const north = G.smoothstep(-80, -760, z);
    h += north * (20 + G.ridge(x * 0.004, z * 0.004) * 70);
    // bordes este/oeste algo más altos para cerrar el mapa
    h += G.smoothstep(HALF - 160, HALF, Math.abs(x)) * 45;
    for (const l of lakes) {
      const d = G.dist2(x, z, l.x, l.z);
      h -= l.d * Math.exp(-(d * d) / (l.r * l.r)) * (1 + Math.max(0, h - 14) / 30);
    }
    const t = G.smoothstep(W.coastZ(x) - 170, W.coastZ(x) + 30, z);
    h = G.lerp(h, -14, t);
    return h;
  }
  for (const t of W.towns) t.base = Math.max(3.5, rawHeight(t.x, t.z));

  function shapedHeight(x, z) {
    let h = rawHeight(x, z);
    for (const t of W.towns) {
      const d = G.dist2(x, z, t.x, t.z);
      h = G.lerp(h, t.base, G.smoothstep(t.r + 45, t.r, d));
    }
    return h;
  }

  function distToSeg(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = G.clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
  }
  W.distToRoad = function (x, z) {
    let m = 1e9;
    for (const r of W.roads) m = Math.min(m, distToSeg(x, z, r[0], r[1], r[2], r[3]));
    return m;
  };

  // ---- Malla de alturas ----
  const N = SEG + 1;
  const H = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    H[i * N + j] = shapedHeight(-HALF + j * CELL, -HALF + i * CELL);
  }
  W.heights = H; W.N = N; W.CELL = CELL;

  // Altura exacta del terreno siguiendo la triangulación de PlaneGeometry.
  W.terrainHeight = function (x, z) {
    const fxg = G.clamp((x + HALF) / CELL, 0, SEG - 0.0001);
    const fzg = G.clamp((z + HALF) / CELL, 0, SEG - 0.0001);
    const j = Math.floor(fxg), i = Math.floor(fzg);
    const fx = fxg - j, fz = fzg - i;
    const Ha = H[i * N + j], Hd = H[i * N + j + 1], Hb = H[(i + 1) * N + j], Hc = H[(i + 1) * N + j + 1];
    if (fx + fz <= 1) return Ha + (Hd - Ha) * fx + (Hb - Ha) * fz;
    return Hc + (Hb - Hc) * (1 - fx) + (Hd - Hc) * (1 - fz);
  };
  W.slope = function (x, z) {
    const e = 2;
    const dx = W.terrainHeight(x + e, z) - W.terrainHeight(x - e, z);
    const dz = W.terrainHeight(x, z + e) - W.terrainHeight(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  W.forestDensity = (x, z) => G.fbm(x * 0.006 + 100, z * 0.006 - 40, 4);
  W.inTown = function (x, z, pad) {
    for (const t of W.towns) if (G.dist2(x, z, t.x, t.z) < t.r + (pad || 0)) return t;
    return null;
  };

  W.build = function (scene) {
    W.scene = scene;
    // el mundo debe ser igual en cada partida: usamos el aleatorio con semilla
    const realRandom = Math.random;
    Math.random = G.mulberry32(G.SEED + 1);
    G.gfx.init(scene);
    buildTerrain(scene);
    buildWater(scene);
    W.buildings = []; W.colliders = []; W.floors = []; W.lootSpots = []; W.wells = [];
    W.trees = []; W.treeGrid = new Map();
    for (const t of W.towns) buildSettlement(scene, t);
    buildWrecks(scene);
    buildTrees(scene);
    buildRocks(scene);
    buildEnvironment(scene);
    Math.random = realRandom;
  };

  function buildTerrain(scene) {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const i = Math.round((z + HALF) / CELL), j = Math.round((x + HALF) / CELL);
      const h = H[i * N + j];
      pos.setY(k, h);
      const n = G.noise2(x * 0.08, z * 0.08) * 0.04;
      const slope = W.slope(x, z);
      const forest = W.forestDensity(x, z);
      if (h < 0.3) c.setRGB(0.55 + n, 0.5 + n, 0.36);
      else if (h < 2.2) c.setRGB(0.72 + n, 0.66 + n, 0.47);
      else if (slope > 0.75 || h > 95) c.setRGB(0.42 + n, 0.41 + n, 0.39 + n);
      else if (forest > 0.08) c.setRGB(0.24 + n, 0.27 + n, 0.15);
      else {
        // prados: mezcla de verde y zonas secas amarillentas
        const dry = G.clamp(G.noise2(x * 0.02 + 40, z * 0.02) * 0.6 + 0.45, 0, 1);
        c.setRGB(0.34 + dry * 0.14 + n, 0.43 + dry * 0.05 + n, 0.2 + dry * 0.02);
      }
      const rd = W.distToRoad(x, z);
      if (rd < 4.5) c.lerp(new THREE.Color(0.4, 0.36, 0.3), G.smoothstep(4.5, 2.5, rd));
      for (const t of W.towns) {
        const d = G.dist2(x, z, t.x, t.z);
        if (d < t.r) c.lerp(new THREE.Color(0.38, 0.4, 0.25), 0.35 * G.smoothstep(t.r, t.r * 0.5, d));
      }
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const gt = G.gfx.tex.ground; gt.repeat.set(SIZE / 4, SIZE / 4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: gt }));
    mesh.receiveShadow = true;
    scene.add(mesh);
    W.terrainMesh = mesh;
  }

  function buildWater(scene) {
    const geo = new THREE.PlaneGeometry(6000, 6000);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({ color: 0x1d4f66, transparent: true, opacity: 0.82, shininess: 90, specular: 0x88aacc });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = 0;
    scene.add(water);
    W.water = water;
  }

  // ---- Edificios ----
  const mats = {};
  function mat(color, tex) {
    const key = color + (tex || '');
    if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial({ color, map: tex ? G.gfx.tex[tex] : null });
    return mats[key];
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let inBuilding = false;
  function addBox(scene, x, y, z, sx, sy, sz, color, collide, shadow = true, tex) {
    const m = new THREE.Mesh(boxGeo, mat(color, tex));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = shadow; m.receiveShadow = true;
    scene.add(m);
    if (collide) {
      const b = { minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2 };
      W.colliders.push(b);
      if (!inBuilding) W.looseColliders.push(b);
      return b;
    }
    return m;
  }

  const wallColors = [0xb8ad96, 0xa38f74, 0x9aa39c, 0xc4b59a, 0x8c7a66, 0xb5a28a, 0x9c8f86];
  const roofColors = [0x6b3b2c, 0x4f4a45, 0x5c2e26, 0x3f4a4f, 0x7a4b33];

  function overlaps(x, z, w, d) {
    for (const b of W.buildings) {
      if (x - w / 2 - 4 < b.maxX && x + w / 2 + 4 > b.minX && z - d / 2 - 4 < b.maxZ && z + d / 2 + 4 > b.minZ) return true;
    }
    return false;
  }

  function addBuilding(scene, cx, cz, w, d, doorSide, type) {
    const pad = 0.5;
    inBuilding = true;
    let base = -1e9;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      base = Math.max(base, W.terrainHeight(cx + ox * (w / 2 + pad), cz + oz * (d / 2 + pad)));
    }
    base += 0.25;
    const tall = { tent: 2.4, barn: 5, barracks: 3.2 }[type] || 3;
    const b = { cx, cz, w, d, base, H: tall, type, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, collStart: W.colliders.length };
    const wallC = type === 'tent' ? 0x4b5534 : type === 'medical' ? 0xd8d8d0 : type === 'barracks' ? 0x6d6e58 : type === 'barn' ? 0x7a3a2a : G.pick(wallColors);
    const roofC = type === 'tent' ? 0x434c2e : type === 'barracks' ? 0x3d4035 : G.pick(roofColors);
    const wallT = type === 'barn' ? 'planks' : type === 'tent' ? 'cloth' : 'plaster';
    const roofT = type === 'tent' ? 'cloth' : 'roof';
    // suelo (se hunde en el terreno para cubrir pendientes)
    addBox(scene, cx, base - 2, cz, w, 4, d, type === 'tent' ? 0x5a5040 : 0x8a7560, false, true, 'planks');
    W.floors.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, y: base });
    const t = 0.22, top = base + tall;
    const doorW = type === 'barn' ? 3.2 : type === 'tent' ? 2 : 1.4, doorH = type === 'barn' ? 3.6 : type === 'tent' ? 2.1 : 2.2;
    const doors = [doorSide];
    if (type === 'barracks' || type === 'barn') doors.push({ N: 'S', S: 'N', E: 'W', W: 'E' }[doorSide]);
    for (const side of ['N', 'S', 'W', 'E']) {
      const horiz = side === 'N' || side === 'S';
      const along = horiz ? w : d;
      const segs = [];
      if (doors.includes(side)) {
        const off = type === 'house' ? G.randRange(-along / 4, along / 4) : 0;
        segs.push([-along / 2, off - doorW / 2, base, top]);
        segs.push([off + doorW / 2, along / 2, base, top]);
        segs.push([off - doorW / 2, off + doorW / 2, base + doorH, top]);
      } else segs.push([-along / 2, along / 2, base, top]);
      for (const [a0, a1, y0, y1] of segs) {
        if (a1 - a0 < 0.05) continue;
        const mid = (a0 + a1) / 2, len = a1 - a0;
        if (horiz) {
          const z = side === 'N' ? b.minZ + t / 2 : b.maxZ - t / 2;
          addBox(scene, cx + mid, (y0 + y1) / 2, z, len, y1 - y0, t, wallC, true, true, wallT);
        } else {
          const x = side === 'W' ? b.minX + t / 2 : b.maxX - t / 2;
          addBox(scene, x, (y0 + y1) / 2, cz + mid, t, y1 - y0, len, wallC, true, true, wallT);
        }
      }
      // ventanas decorativas
      if (!doors.includes(side) && type !== 'tent' && along > 5) {
        const nw = Math.floor(along / 4);
        for (let k = 0; k < nw; k++) {
          const a = -along / 2 + (k + 0.5) * (along / nw);
          if (horiz) addBox(scene, cx + a, base + 1.6, side === 'N' ? b.minZ - 0.02 : b.maxZ + 0.02, 1.0, 1.0, 0.06, 0x1a2228, false, false);
          else addBox(scene, side === 'W' ? b.minX - 0.02 : b.maxX + 0.02, base + 1.6, cz + a, 0.06, 1.0, 1.0, 0x1a2228, false, false);
        }
      }
    }
    // tejado
    if (type === 'tent' || type === 'barracks') {
      addBox(scene, cx, top + 0.1, cz, w + 0.4, 0.2, d + 0.4, roofC, false, true, roofT);
    } else {
      const rise = type === 'barn' ? 2.4 : 1.5;
      const alongX = w >= d;
      const span = (alongX ? d : w) / 2 + 0.35, len = (alongX ? w : d) + 0.5;
      const ang = Math.atan2(rise, span), hyp = Math.hypot(span, rise);
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(boxGeo, mat(roofC, 'roof'));
        m.castShadow = true; m.receiveShadow = true;
        if (alongX) {
          m.scale.set(len, 0.15, hyp);
          m.position.set(cx, top + rise / 2, cz + s * span / 2);
          m.rotation.x = s * ang;
        } else {
          m.scale.set(hyp, 0.15, len);
          m.position.set(cx + s * span / 2, top + rise / 2, cz);
          m.rotation.z = -s * ang;
        }
        scene.add(m);
      }
      // hastiales triangulares
      const shape = new THREE.Shape();
      const hs = (alongX ? d : w) / 2;
      shape.moveTo(-hs, 0); shape.lineTo(hs, 0); shape.lineTo(0, rise); shape.lineTo(-hs, 0);
      const gGeo = new THREE.ShapeGeometry(shape);
      for (const s of [-1, 1]) {
        const g = new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ color: wallC, side: THREE.DoubleSide, map: G.gfx.tex[wallT] }));
        if (alongX) { g.position.set(cx + s * (w / 2 - 0.01), top, cz); g.rotation.y = Math.PI / 2; }
        else g.position.set(cx, top, cz + s * (d / 2 - 0.01));
        scene.add(g);
      }
    }
    // techo interior (para que no se vea el cielo desde dentro)
    if (type !== 'tent' && type !== 'barracks') addBox(scene, cx, top - 0.05, cz, w - 0.1, 0.1, d - 0.1, 0x5d5348, false, false);
    // mobiliario
    if (type === 'house' || type === 'medical') {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        const fx = cx + G.randRange(-w / 2 + 1.2, w / 2 - 1.2), fz = cz + G.randRange(-d / 2 + 1.2, d / 2 - 1.2);
        if (Math.abs(fx - cx) < 1.5 && Math.abs(fz - cz) < 1.5) continue;
        addBox(scene, fx, base + 0.45, fz, 1.2, 0.9, 0.7, 0x5a4330, true);
      }
    }
    b.collEnd = W.colliders.length;
    inBuilding = false;
    // puntos de loot
    const nSpots = { house: 3, barn: 3, medical: 4, barracks: 5, tent: 2 }[type] || 2;
    for (let k = 0; k < nSpots; k++) {
      W.lootSpots.push({
        x: cx + G.randRange(-w / 2 + 0.8, w / 2 - 0.8), y: base, z: cz + G.randRange(-d / 2 + 0.8, d / 2 - 0.8),
        table: type, item: null, respawnAt: 0,
      });
    }
    W.buildings.push(b);
    return b;
  }

  function doorToward(x, z, tx, tz) {
    const dx = tx - x, dz = tz - z;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'E' : 'W';
    return dz > 0 ? 'S' : 'N';
  }

  function buildSettlement(scene, t) {
    if (t.kind === 'town') {
      let placed = 0, tries = 0;
      if (t.clinic) {
        addBuilding(scene, t.x + 14, t.z - 12, 12, 8, 'S', 'medical'); placed++;
      }
      while (placed < t.houses && tries++ < 400) {
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * (t.r - 18);
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
        const big = Math.random() < 0.3;
        let w = big ? G.randRange(9, 12) : G.randRange(6, 8.5), d = big ? G.randRange(6.5, 8) : G.randRange(5, 6.5);
        if (Math.random() < 0.5) [w, d] = [d, w];
        if (overlaps(x, z, w, d) || W.distToRoad(x, z) < 6) continue;
        addBuilding(scene, x, z, w, d, doorToward(x, z, t.x, t.z), 'house');
        placed++;
      }
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * 6.28, x = t.x + Math.cos(a) * (t.r - 6), z = t.z + Math.sin(a) * (t.r - 6);
        if (!overlaps(x, z, 12, 8) && W.distToRoad(x, z) > 7) addBuilding(scene, x, z, 12, 8, doorToward(x, z, t.x, t.z), 'barn');
      }
      addWell(scene, t.x + 3, t.z + 3);
    } else if (t.kind === 'military') {
      for (let k = 0; k < 3; k++) {
        const x = t.x - 22 + k * 22, z = t.z - 14;
        addBuilding(scene, x, z, 16, 7, 'S', 'barracks');
      }
      for (let k = 0; k < 6; k++) {
        const x = t.x - 30 + k * 12, z = t.z + 14 + (k % 2) * 4;
        addBuilding(scene, x, z, 5, 4, 'N', 'tent');
      }
      // torres de vigilancia (decorativas) y vallas
      for (const [ox, oz] of [[-45, -35], [45, -35], [-45, 35], [45, 35]]) {
        const x = t.x + ox, z = t.z + oz, y = W.terrainHeight(x, z);
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addBox(scene, x + lx, y + 3, z + lz, 0.25, 6, 0.25, 0x4a3b2c, true);
        addBox(scene, x, y + 6.1, z, 3, 0.2, 3, 0x4a3b2c, false);
        addBox(scene, x, y + 7.6, z, 3.2, 0.15, 3.2, 0x3d4035, false);
      }
      for (let k = -9; k <= 9; k++) {
        for (const oz of [-38, 38]) {
          const x = t.x + k * 5, z = t.z + oz;
          if (Math.abs(k) <= 1) continue; // entradas
          addBox(scene, x, W.terrainHeight(x, z) + 1, z, 5, 2, 0.1, 0x55594f, true, false);
        }
      }
      for (let k = 0; k < 8; k++) {
        const x = t.x + G.randRange(-35, 35), z = t.z + G.randRange(-5, 5);
        addBox(scene, x, W.terrainHeight(x, z) + 0.5, z, 1, 1, 1, 0x4d5530, true);
      }
    } else if (t.kind === 'farm') {
      addBuilding(scene, t.x, t.z, 7.5, 6, 'S', 'house');
      addBuilding(scene, t.x + 16, t.z - 4, 13, 9, 'W', 'barn');
      addWell(scene, t.x - 6, t.z + 8);
    }
  }

  function addWell(scene, x, z) {
    const y = W.terrainHeight(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1, 10), mat(0x777570));
    m.position.set(x, y + 0.5, z); m.castShadow = true; scene.add(m);
    addBox(scene, x, y + 1.6, z, 0.12, 2.2, 0.12, 0x4a3b2c, false);
    addBox(scene, x, y + 2.6, z, 1.6, 0.1, 0.12, 0x4a3b2c, false);
    W.looseColliders.push({ minX: x - 0.8, maxX: x + 0.8, minY: y, maxY: y + 1, minZ: z - 0.8, maxZ: z + 0.8 });
    W.wells.push({ x, y, z });
  }

  function buildWrecks(scene) {
    const rnd = G.wrand;
    for (let k = 0; k < 16; k++) {
      const r = W.roads[Math.floor(rnd() * W.roads.length)];
      const t = 0.15 + rnd() * 0.7;
      const x = G.lerp(r[0], r[2], t) + (rnd() - 0.5) * 3, z = G.lerp(r[1], r[3], t) + (rnd() - 0.5) * 3;
      if (W.inTown(x, z, -5)) continue;
      const y = W.terrainHeight(x, z);
      const alongX = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]);
      const [sx, sz] = alongX ? [4.2, 1.8] : [1.8, 4.2];
      const col = G.pick([0x5a2f25, 0x3a4a52, 0x6b6b5a, 0x45503a]);
      addBox(scene, x, y + 0.7, z, sx, 0.9, sz, col, true);
      addBox(scene, x, y + 1.45, z, alongX ? 2.2 : 1.6, 0.6, alongX ? 1.6 : 2.2, 0x2a2e30, false);
      W.lootSpots.push({ x: x + (alongX ? 0 : 1.6), y: y, z: z + (alongX ? 1.6 : 0), table: 'car', item: null, respawnAt: 0 });
    }
  }

  // ---- Árboles ----
  function buildTrees(scene) {
    const rnd = G.wrand;
    const pines = [], leafy = [];
    const step = 6.5;
    for (let x = -W.BORDER; x < W.BORDER; x += step) for (let z = -W.BORDER; z < W.BORDER; z += step) {
      const px = x + (rnd() - 0.5) * step, pz = z + (rnd() - 0.5) * step;
      const dens = W.forestDensity(px, pz);
      const p = dens > 0.08 ? 0.75 : dens > 0.0 ? 0.08 : 0.012;
      if (rnd() > p) continue;
      const h = W.terrainHeight(px, pz);
      if (h < 2.5 || W.slope(px, pz) > 0.9) continue;
      if (W.inTown(px, pz, 6) || W.distToRoad(px, pz) < 5) continue;
      const s = 0.75 + rnd() * 0.6;
      const tr = { x: px, z: pz, y: h, s, r: 0.32 * s, sticks: 0 };
      (rnd() < 0.68 ? pines : leafy).push(tr);
      W.trees.push(tr);
      const key = Math.floor(px / 10) + ',' + Math.floor(pz / 10);
      if (!W.treeGrid.has(key)) W.treeGrid.set(key, []);
      W.treeGrid.get(key).push(tr);
    }
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    function inst(geo, material, list, fn, colorFn) {
      const m = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((t, i) => { dummy.rotation.set(0, 0, 0); fn(t); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (colorFn) { colorFn(t, col); m.setColorAt(i, col); } });
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      scene.add(m);
    }
    // une varias geometrías en una (sin índices)
    function merge(geos) {
      const out = { position: [], normal: [], uv: [] };
      for (let g of geos) {
        g = g.index ? g.toNonIndexed() : g;
        for (const k in out) out[k].push(...g.attributes[k].array);
      }
      const r = new THREE.BufferGeometry();
      r.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
      r.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
      r.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
      return r;
    }
    const T = G.gfx.tex;
    // tarjetas cruzadas con textura recortada: mucho más creíble que geometría sólida
    function cards(n) {
      const pos = [], uv = [], nor = [], idx = [];
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI / n, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
        pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        const nx = -Math.sin(a) * 0.45, nz = Math.cos(a) * 0.45;
        for (let q = 0; q < 4; q++) nor.push(nx, 0.9, nz);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return g;
    }
    const card3 = cards(3);
    const pineMat = new THREE.MeshLambertMaterial({ map: T.pine, alphaTest: 0.5 });
    const leafMat = new THREE.MeshLambertMaterial({ map: T.leafy, alphaTest: 0.5 });
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c, map: T.bark });
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.26, 1, 6); trunkGeo.translate(0, 0.5, 0);
    inst(trunkGeo, barkMat, pines, (t) => { dummy.position.set(t.x, t.y - 0.3, t.z); dummy.scale.set(t.s, 6 * t.s, t.s); });
    inst(card3, pineMat, pines, (t) => { dummy.position.set(t.x, t.y - 0.4, t.z); dummy.rotation.set(0, t.x * 3.1, 0); dummy.scale.set(7 * t.s, 18 * t.s, 7 * t.s); },
      (t, c) => { const v = 1.1 + G.noise2(t.x * 0.7, t.z * 0.7) * 0.2; c.setRGB(v, v, v); });
    inst(card3, leafMat, leafy, (t) => { dummy.position.set(t.x, t.y - 0.3, t.z); dummy.rotation.set(0, t.x * 1.7, 0); dummy.scale.set(10 * t.s, 12 * t.s, 10 * t.s); },
      (t, c) => {
        const a = G.noise2(t.x * 0.01 + 7, t.z * 0.01) * 0.5 + 0.5 + (G.noise2(t.x * 0.5, t.z * 0.5) * 0.3);
        if (a > 0.86) c.setRGB(0.72, 0.45, 0.2); // otoño
        else if (a > 0.76) c.setRGB(0.66, 0.6, 0.27);
        else c.setRGB(0.4 + a * 0.08, 0.52 + a * 0.06, 0.27);
      });
    // arbustos
    const bushes = [];
    for (let k = 0; k < 3000; k++) {
      const x = (rnd() - 0.5) * 2 * W.BORDER, z = (rnd() - 0.5) * 2 * W.BORDER;
      const f = W.forestDensity(x, z);
      if (f < -0.05 || rnd() > 0.6) continue;
      const h = W.terrainHeight(x, z);
      if (h < 2 || W.inTown(x, z, 4) || W.distToRoad(x, z) < 4) continue;
      bushes.push({ x, z, y: h, s: 0.25 + rnd() * 0.3 });
    }
    inst(card3, leafMat, bushes, (t) => { dummy.position.set(t.x, t.y - 2.6 * t.s, t.z); dummy.rotation.set(0, t.x, 0); dummy.scale.set(9 * t.s, 7 * t.s, 9 * t.s); },
      (t, c) => { const v = 0.8 + G.noise2(t.x, t.z) * 0.2; c.setRGB(0.55 * v, 0.7 * v, 0.38 * v); });
  }

  W.treesNear = function (x, z) {
    const out = [];
    const cx = Math.floor(x / 10), cz = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = W.treeGrid.get((cx + a) + ',' + (cz + b));
      if (l) out.push(...l);
    }
    return out;
  };

  function buildRocks(scene) {
    const rnd = G.wrand, list = [];
    for (let k = 0; k < 500; k++) {
      const x = (rnd() - 0.5) * 2 * W.BORDER, z = (rnd() - 0.5) * 2 * W.BORDER;
      const h = W.terrainHeight(x, z);
      if (h < 1 || W.inTown(x, z, 5) || W.distToRoad(x, z) < 5) continue;
      list.push({ x, z, y: h, s: 0.4 + rnd() * 1.6 });
    }
    const m = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x6e6b66), list.length);
    const d = new THREE.Object3D();
    list.forEach((r, i) => { d.position.set(r.x, r.y, r.z); d.scale.set(r.s, r.s * 0.6, r.s * 0.9); d.rotation.set(r.x, r.z, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m);
  }

  // ---- Consultas de colisión ----
  W.groundAt = function (x, z, feetY) {
    let g = W.terrainHeight(x, z);
    for (const f of W.floors) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && (feetY === undefined || f.y <= feetY + 0.6)) g = Math.max(g, f.y);
    }
    return g;
  };

  // Empuja un círculo (x,z,r) fuera de muros y troncos. Devuelve {x,z}.
  W.collide = function (x, z, r, y0, y1) {
    for (const b of W.buildingsNear(x, z)) {
      for (let k = b.collStart; k < b.collEnd; k++) ({ x, z } = pushOut(W.colliders[k], x, z, r, y0, y1));
    }
    for (const c of W.looseColliders) ({ x, z } = pushOut(c, x, z, r, y0, y1));
    for (const t of W.treesNear(x, z)) {
      const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz), m = r + t.r;
      if (d < m && d > 1e-4) { x = t.x + dx / d * m; z = t.z + dz / d * m; }
    }
    x = G.clamp(x, -W.BORDER, W.BORDER); z = G.clamp(z, -W.BORDER, W.BORDER);
    return { x, z };
  };
  function pushOut(c, x, z, r, y0, y1) {
    if (y1 < c.minY || y0 > c.maxY - 0.35) return { x, z }; // se puede pisar lo bajo
    const qx = G.clamp(x, c.minX, c.maxX), qz = G.clamp(z, c.minZ, c.maxZ);
    const dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return { x, z };
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      return { x: qx + dx / d * r, z: qz + dz / d * r };
    }
    // centro dentro de la caja: salir por el lado más cercano
    const l = x - c.minX, rr = c.maxX - x, n = z - c.minZ, s = c.maxZ - z, m = Math.min(l, rr, n, s);
    if (m === l) return { x: c.minX - r, z };
    if (m === rr) return { x: c.maxX + r, z };
    if (m === n) return { x, z: c.minZ - r };
    return { x, z: c.maxZ + r };
  }
  W.buildingsNear = function (x, z) {
    const out = [];
    for (const b of W.buildings) if (x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3) out.push(b);
    return out;
  };
  W.insideBuilding = function (x, z) {
    for (const b of W.buildings) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return b;
    return null;
  };

  // ¿Bloquea algo sólido el segmento? (para línea de visión y balas)
  W.segmentBlocked = function (ox, oy, oz, tx, ty, tz) {
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return false;
    return W.raycastSolid(ox, oy, oz, dx / len, dy / len, dz / len, len) < len - 0.05;
  };
  W.raycastSolid = function (ox, oy, oz, dx, dy, dz, maxD) {
    let best = maxD;
    const minX = Math.min(ox, ox + dx * maxD) - 1, maxX = Math.max(ox, ox + dx * maxD) + 1;
    const minZ = Math.min(oz, oz + dz * maxD) - 1, maxZ = Math.max(oz, oz + dz * maxD) + 1;
    for (const b of W.buildings) {
      if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
      for (let k = b.collStart; k < b.collEnd; k++) {
        const t = G.rayAABB(ox, oy, oz, dx, dy, dz, W.colliders[k], best);
        if (t >= 0 && t < best) best = t;
      }
    }
    for (const c of W.looseColliders) {
      if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
      const t = G.rayAABB(ox, oy, oz, dx, dy, dz, c, best);
      if (t >= 0 && t < best) best = t;
    }
    // terreno
    for (let s = 1; s < best; s += 1.5) {
      if (oy + dy * s < W.terrainHeight(ox + dx * s, oz + dz * s)) { best = Math.min(best, s); break; }
    }
    return best;
  };
  W.looseColliders = [];

  // ---- Entorno: sol, cielo, estrellas, niebla ----
  function buildEnvironment(scene) {
    const env = W.env = {};
    env.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4030, 0.5);
    scene.add(env.hemi);
    env.sun = new THREE.DirectionalLight(0xfff1d6, 1.0);
    env.sun.castShadow = true;
    env.sun.shadow.mapSize.set(2048, 2048);
    const sc = env.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    env.sun.shadow.bias = -0.0008;
    scene.add(env.sun); scene.add(env.sun.target);
    env.moon = new THREE.DirectionalLight(0x8aa0d0, 0.0);
    scene.add(env.moon); scene.add(env.moon.target);
    scene.fog = new THREE.Fog(0x9fb6c8, 40, 520);
    // estrellas
    const sg = new THREE.BufferGeometry(), sp = [];
    const r = G.mulberry32(7);
    for (let k = 0; k < 900; k++) {
      const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.95);
      sp.push(Math.sin(ph) * Math.cos(th) * 900, Math.cos(ph) * 900, Math.sin(ph) * Math.sin(th) * 900);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    env.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, fog: false }));
    scene.add(env.stars);
    env.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xdde4ff, fog: false }));
    scene.add(env.moonDisc);
  }

  // hour: 0..24. Devuelve el factor de luz diurna (0 noche, 1 día).
  const sunDirV = new THREE.Vector3();
  W.updateEnv = function (hour, px, pz, dt, cam) {
    const env = W.env;
    const ang = (hour - 6) / 24 * Math.PI * 2; // 6h amanecer, 12h cénit, 18h ocaso
    const sx = Math.cos(ang), sy = Math.sin(ang);
    const day = G.smoothstep(-0.12, 0.25, sy);
    const dusk = Math.max(0, 1 - Math.abs(sy) / 0.3) * (sy > -0.2 ? 1 : 0);
    sunDirV.set(sx, sy, 0.3).normalize();
    const wx = G.gfx.update(dt || 0, cam, sunDirV, day, dusk);
    const clear = 1 - G.clamp((wx.cover - 0.45) * 1.5, 0, 0.8) - wx.rain * 0.15;
    env.sun.position.set(px + sunDirV.x * 200, Math.max(sunDirV.y, 0.05) * 200 + 10, pz + sunDirV.z * 200);
    env.sun.target.position.set(px, 0, pz);
    env.sun.intensity = 1.25 * day * clear;
    env.sun.color.setRGB(1, 0.8 + 0.15 * day, 0.6 + 0.3 * day);
    env.moon.position.set(px - sx * 200, Math.max(-sy, 0.1) * 200, pz - 60);
    env.moon.target.position.set(px, 0, pz);
    env.moon.intensity = 0.1 * (1 - day) * (1 - wx.cover * 0.8);
    env.hemi.intensity = 0.03 + (0.5 + (1 - clear) * 0.35) * day;
    env.hemi.color.setRGB(0.75, 0.82, 0.9);
    env.hemi.groundColor.setRGB(0.32, 0.3, 0.24);
    env.stars.position.set(cam.position.x, cam.position.y, cam.position.z);
    env.stars.material.opacity = G.clamp(1 - day * 1.5, 0, 1) * (1 - wx.cover);
    env.moonDisc.position.set(cam.position.x - sx * 700, cam.position.y - sy * 700, cam.position.z - 200);
    env.moonDisc.visible = sy < 0.1 && wx.cover < 0.7;
    W.weather = wx;
    return day;
  };
})();
