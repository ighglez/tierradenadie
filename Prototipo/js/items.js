'use strict';
// Definición de objetos, tablas de loot y objetos en el suelo.
(function () {
  const I = G.ITEMS = {
    // comida
    beans: { name: 'Lata de judías', cat: 'food', energy: 40, water: -3, can: true, shape: 'can', color: 0x9a6a3a },
    peaches: { name: 'Melocotones en almíbar', cat: 'food', energy: 22, water: 18, can: true, shape: 'can', color: 0xd9a24a },
    sardines: { name: 'Lata de sardinas', cat: 'food', energy: 30, water: -6, can: true, shape: 'can', color: 0x8090a0 },
    rice: { name: 'Paquete de arroz', cat: 'food', energy: 35, water: -12, shape: 'box', color: 0xe8e2cc },
    chips: { name: 'Bolsa de patatas fritas', cat: 'food', energy: 18, water: -6, shape: 'box', color: 0xd8c040 },
    apple: { name: 'Manzana', cat: 'food', energy: 12, water: 8, shape: 'ball', color: 0xb02a20 },
    rawmeat: { name: 'Carne cruda', cat: 'food', energy: 12, water: 0, sick: 0.6, cookable: true, shape: 'box', color: 0xa83a3a, stack: 6 },
    cookedmeat: { name: 'Carne asada', cat: 'food', energy: 50, water: 0, shape: 'box', color: 0x6b3a1e, stack: 6 },
    // bebida
    bottle: { name: 'Botella de agua', cat: 'drink', shape: 'bottle', color: 0x6fa8d8, charges: 3, perSip: 30 },
    soda: { name: 'Lata de refresco', cat: 'drink', water: 30, energy: 6, shape: 'can', color: 0x2a6ab0 },
    // médico
    rag: { name: 'Trapos', cat: 'med', stack: 6, shape: 'cloth', color: 0xbdb4a0, desc: 'Detiene un sangrado.' },
    bandage: { name: 'Vendaje', cat: 'med', stack: 4, shape: 'box', color: 0xf0f0f0, desc: 'Detiene todos los sangrados.' },
    saline: { name: 'Bolsa de suero salino', cat: 'med', shape: 'box', color: 0xc8e0f0, desc: 'Recupera sangre.' },
    charcoal: { name: 'Pastillas de carbón', cat: 'med', shape: 'box', color: 0x303030, desc: 'Cura intoxicaciones.' },
    purif: { name: 'Pastillas potabilizadoras', cat: 'med', shape: 'box', color: 0x40a080, desc: 'Potabiliza una botella.' },
    painkillers: { name: 'Analgésicos', cat: 'med', shape: 'box', color: 0xe0e040, desc: 'Calman el dolor y el temblor durante un rato.' },
    morphine: { name: 'Autoinyector de morfina', cat: 'med', shape: 'bottle', color: 0xd8d8d8, desc: 'Permite andar con una fractura.' },
    splint: { name: 'Entablillado', cat: 'med', shape: 'stick', color: 0x8a7050, desc: 'Inmoviliza una fractura para que sane.' },
    vitamins: { name: 'Vitaminas', cat: 'med', shape: 'box', color: 0xe08a20, desc: 'Ayudan a superar un resfriado.' },
    tetracycline: { name: 'Antibióticos (tetraciclina)', cat: 'med', shape: 'box', color: 0x4080c0, desc: 'Curan una infección.' },
    disinfectant: { name: 'Spray desinfectante', cat: 'med', shape: 'bottle', color: 0x30a0a0, charges: 4, desc: 'Desinfecta heridas.' },
    sewing: { name: 'Kit de costura', cat: 'tool', shape: 'box', color: 0x806040, charges: 3, desc: 'Repara ropa.' },
    cleaning: { name: 'Kit de limpieza de armas', cat: 'tool', shape: 'box', color: 0x404a30, charges: 3, desc: 'Repara armas de fuego.' },
    gps: { name: 'GPS', cat: 'tool', shape: 'box', color: 0x202020, desc: 'Muestra tu posición en el mapa.' },
    // cuerpo a cuerpo
    knife: { name: 'Cuchillo de cocina', cat: 'melee', slot: 'melee', dmg: 30, range: 2.0, rate: 0.45, stam: 6, shape: 'melee', color: 0xb0b0b8, tool: ['cut', 'open'] },
    bat: { name: 'Bate de béisbol', cat: 'melee', slot: 'melee', dmg: 45, range: 2.4, rate: 0.8, stam: 12, shape: 'melee', color: 0x8a6a40 },
    axe: { name: 'Hacha', cat: 'melee', slot: 'melee', dmg: 75, range: 2.4, rate: 1.0, stam: 16, shape: 'melee', color: 0xa02020, tool: ['chop', 'open', 'cut'] },
    // armas de fuego
    pistol: { name: 'Pistola .45', cat: 'gun', slot: 'belt', ammo: 'a45', mag: 8, dmg: 42, spread: 0.012, range: 150, rate: 0.18, noise: 110, reload: 1.6, shape: 'pistol', color: 0x222222 },
    shotgun: { name: 'Escopeta de dos cañones', cat: 'gun', slot: 'shoulder', ammo: 'a12', mag: 2, dmg: 16, pellets: 9, spread: 0.055, range: 45, rate: 0.35, noise: 160, reload: 2.4, shape: 'long', color: 0x4a3420 },
    rifle: { name: 'Rifle de cerrojo', cat: 'gun', slot: 'shoulder', ammo: 'a762', mag: 5, dmg: 120, spread: 0.002, range: 500, rate: 1.2, noise: 230, reload: 3.0, zoom: 3.2, shape: 'long', color: 0x5a3a1a },
    ar: { name: 'Fusil de asalto', cat: 'gun', slot: 'shoulder', ammo: 'a556', mag: 30, dmg: 48, spread: 0.009, range: 300, rate: 0.1, auto: true, noise: 180, reload: 2.4, zoom: 1.8, shape: 'long', color: 0x2a2a2a },
    // munición
    a45: { name: 'Munición .45', cat: 'ammo', stack: 50, shape: 'ammo', color: 0xc9a227, spawnQty: [6, 16] },
    a12: { name: 'Cartuchos del 12', cat: 'ammo', stack: 30, shape: 'ammo', color: 0xb03020, spawnQty: [4, 10] },
    a762: { name: 'Munición 7,62 mm', cat: 'ammo', stack: 40, shape: 'ammo', color: 0x9a8a30, spawnQty: [5, 12] },
    a556: { name: 'Munición 5,56 mm', cat: 'ammo', stack: 90, shape: 'ammo', color: 0x7a8a30, spawnQty: [15, 30] },
    // herramientas
    matches: { name: 'Cerillas', cat: 'tool', shape: 'box', color: 0xd04020, charges: 5 },
    canopener: { name: 'Abrelatas', cat: 'tool', shape: 'box', color: 0x909090, tool: ['open'] },
    flashlight: { name: 'Linterna', cat: 'tool', shape: 'bottle', color: 0x303840 },
    map: { name: 'Mapa de la región', cat: 'tool', shape: 'cloth', color: 0xe0d0a0 },
    compass: { name: 'Brújula', cat: 'tool', shape: 'ball', color: 0x506070 },
    watch: { name: 'Reloj de pulsera', cat: 'tool', shape: 'ball', color: 0xa0a0a0 },
    sticks: { name: 'Palos', cat: 'misc', stack: 10, shape: 'stick', color: 0x6a4a2a, spawnQty: [2, 4] },
    firewood: { name: 'Leña', cat: 'misc', stack: 8, shape: 'stick', color: 0x7a5530, spawnQty: [1, 3] },
    // ropa
    raincoat: { name: 'Chubasquero', cat: 'cloth', slot: 'jacket', slots: 4, warmth: 4, waterproof: 0.9, shape: 'cloth', color: 0xb0a020 },
    jacket: { name: 'Chaqueta acolchada', cat: 'cloth', slot: 'jacket', slots: 6, warmth: 7, shape: 'cloth', color: 0x3a4a6a },
    hunter_jacket: { name: 'Chaqueta de caza', cat: 'cloth', slot: 'jacket', slots: 8, warmth: 9, shape: 'cloth', color: 0x4a5a2a },
    mil_jacket: { name: 'Chaqueta militar', cat: 'cloth', slot: 'jacket', slots: 10, warmth: 9, shape: 'cloth', color: 0x505a38 },
    backpack_s: { name: 'Mochila de excursión', cat: 'cloth', slot: 'backpack', slots: 10, shape: 'bag', color: 0x8a4a2a },
    backpack_m: { name: 'Mochila militar', cat: 'cloth', slot: 'backpack', slots: 18, shape: 'bag', color: 0x45502e },
    helmet: { name: 'Casco militar', cat: 'cloth', slot: 'helmet', armor: 0.35, shape: 'ball', color: 0x3d4630 },
  };
  // pesos en kg
  const WEIGHTS = {
    beans: 0.42, peaches: 0.42, sardines: 0.15, rice: 0.5, chips: 0.15, apple: 0.15, rawmeat: 0.3, cookedmeat: 0.25,
    bottle: 0.2, soda: 0.35, rag: 0.05, bandage: 0.1, saline: 0.6, charcoal: 0.05, purif: 0.05, painkillers: 0.05,
    morphine: 0.1, splint: 0.5, vitamins: 0.05, tetracycline: 0.05, disinfectant: 0.3, sewing: 0.2, cleaning: 0.5, gps: 0.25,
    knife: 0.3, bat: 1.0, axe: 2.2, pistol: 1.1, shotgun: 3.2, rifle: 4.0, ar: 3.6,
    a45: 0.021, a12: 0.045, a762: 0.025, a556: 0.012,
    matches: 0.02, canopener: 0.1, flashlight: 0.25, map: 0.1, compass: 0.1, watch: 0.05, sticks: 0.2, firewood: 1.0,
    raincoat: 0.6, jacket: 1.6, hunter_jacket: 1.9, mil_jacket: 1.8, backpack_s: 0.8, backpack_m: 1.6, helmet: 1.4,
  };
  for (const id in I) { I[id].id = id; I[id].weight = WEIGHTS[id] || 0.2; }
  // armas, herramientas y ropa se desgastan
  G.hasCondition = (id) => ['gun', 'melee', 'cloth'].includes(I[id].cat);
  G.condName = function (c) {
    return c > 0.7 ? 'Impecable' : c > 0.5 ? 'Desgastado' : c > 0.3 ? 'Dañado' : c > 0 ? 'Muy dañado' : 'Destruido';
  };
  G.itemWeight = function (it) {
    const d = I[it.id];
    let w = d.weight * (it.qty || 1);
    if (it.id === 'bottle') w += 0.33 * (it.charges || 0);
    if (d.cat === 'gun') w += I[d.ammo].weight * (it.loaded || 0);
    return w;
  };

  G.isStack = (id) => !!I[id].stack;

  G.makeItem = function (id, qty) {
    const d = I[id];
    const it = { id };
    if (d.stack) it.qty = qty || (d.spawnQty ? Math.floor(G.randRange(d.spawnQty[0], d.spawnQty[1] + 1)) : 1);
    if (d.cat === 'gun') it.loaded = Math.random() < 0.4 ? Math.floor(Math.random() * (d.mag + 1)) : 0;
    if (d.charges) it.charges = id === 'bottle' ? (Math.random() < 0.5 ? d.charges : 0) : d.charges;
    if (id === 'bottle') it.dirty = false;
    if (G.hasCondition(id)) it.cond = Math.random() < 0.3 ? 0.75 + Math.random() * 0.25 : 0.32 + Math.random() * 0.45;
    return it;
  };

  G.itemLabel = function (it) {
    const d = I[it.id];
    let s = d.name;
    if (it.qty !== undefined && it.qty > 1) s += ` ×${it.qty}`;
    if (d.cat === 'gun') s += ` [${it.loaded}/${d.mag}]`;
    if (it.id === 'bottle') s += it.charges > 0 ? ` (${Math.round(it.charges / d.charges * 100)}%${it.dirty ? ', sin tratar' : ''})` : ' (vacía)';
    if (it.id === 'matches' || it.id === 'disinfectant' || it.id === 'sewing' || it.id === 'cleaning') s += ` (${it.charges} usos)`;
    if (it.cond !== undefined) s += ` · ${G.condName(it.cond)}`;
    return s;
  };

  const TABLES = {
    house: [['vitamins', 2], ['sewing', 1], ['raincoat', 2], ['disinfectant', 1], ['beans', 8], ['peaches', 6], ['sardines', 6], ['rice', 4], ['chips', 5], ['apple', 4], ['soda', 7], ['bottle', 6], ['knife', 3], ['canopener', 3], ['matches', 4], ['flashlight', 3], ['bat', 2], ['map', 2], ['compass', 2], ['watch', 2], ['jacket', 3], ['backpack_s', 2], ['rag', 6], ['charcoal', 2], ['purif', 2], ['painkillers', 2], ['pistol', 1], ['a45', 3]],
    barn: [['cleaning', 1], ['raincoat', 1], ['axe', 5], ['sticks', 5], ['firewood', 3], ['matches', 3], ['rifle', 2], ['shotgun', 3], ['a762', 4], ['a12', 5], ['hunter_jacket', 3], ['backpack_s', 2], ['knife', 3], ['rag', 2], ['bottle', 2], ['apple', 3]],
    medical: [['bandage', 8], ['saline', 4], ['charcoal', 5], ['purif', 5], ['rag', 4], ['painkillers', 4], ['morphine', 3], ['tetracycline', 4], ['disinfectant', 4], ['vitamins', 4]],
    barracks: [['gps', 1], ['cleaning', 2], ['morphine', 2], ['ar', 3], ['a556', 8], ['pistol', 3], ['a45', 5], ['helmet', 4], ['mil_jacket', 4], ['backpack_m', 3], ['rifle', 2], ['a762', 4], ['bandage', 4], ['beans', 3], ['bottle', 2], ['map', 2], ['compass', 2]],
    tent: [['a556', 4], ['a45', 4], ['bandage', 3], ['beans', 4], ['bottle', 3], ['helmet', 2], ['mil_jacket', 2], ['backpack_m', 1], ['knife', 3], ['ar', 1], ['matches', 2]],
    car: [['bottle', 3], ['soda', 3], ['chips', 3], ['matches', 2], ['flashlight', 2], ['a45', 2], ['rag', 2], ['map', 1], ['canopener', 1]],
    zombie: [['rag', 4], ['beans', 2], ['soda', 2], ['a45', 1], ['matches', 1], ['knife', 1], ['apple', 2], ['chips', 2]],
  };
  G.rollLoot = function (table) {
    const t = TABLES[table];
    let total = 0;
    for (const [, w] of t) total += w;
    let r = Math.random() * total;
    for (const [id, w] of t) { if ((r -= w) <= 0) return G.makeItem(id); }
    return G.makeItem(t[0][0]);
  };

  // ---- mallas de objetos ----
  const geos = {
    can: new THREE.CylinderGeometry(0.06, 0.06, 0.13, 10),
    bottle: new THREE.CylinderGeometry(0.05, 0.05, 0.26, 8),
    box: new THREE.BoxGeometry(0.22, 0.08, 0.16),
    ball: new THREE.SphereGeometry(0.07, 8, 6),
    cloth: new THREE.BoxGeometry(0.5, 0.06, 0.4),
    bag: new THREE.BoxGeometry(0.4, 0.5, 0.25),
    long: new THREE.BoxGeometry(1.1, 0.08, 0.14),
    pistol: new THREE.BoxGeometry(0.22, 0.12, 0.04),
    melee: new THREE.BoxGeometry(0.75, 0.05, 0.08),
    ammo: new THREE.BoxGeometry(0.12, 0.07, 0.08),
    stick: new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5),
  };
  const matCache = {};
  G.itemMesh = function (it) {
    const d = I[it.id];
    if (!matCache[d.color]) matCache[d.color] = new THREE.MeshLambertMaterial({ color: d.color });
    const m = new THREE.Mesh(geos[d.shape], matCache[d.color]);
    const half = { can: 0.065, bottle: 0.13, box: 0.04, ball: 0.07, cloth: 0.03, bag: 0.25, long: 0.04, pistol: 0.02, melee: 0.025, ammo: 0.035, stick: 0.03 }[d.shape];
    if (d.shape === 'stick') m.rotation.z = Math.PI / 2;
    if (d.shape === 'pistol') m.rotation.x = Math.PI / 2;
    m.userData.half = half;
    m.castShadow = true;
    return m;
  };

  const L = G.loot = { ground: [] };

  L.drop = function (it, x, y, z, spot) {
    const mesh = G.itemMesh(it);
    mesh.position.set(x, y + mesh.userData.half + 0.01, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    G.scene.add(mesh);
    const g = { item: it, mesh, x, y, z, spot: spot || null };
    L.ground.push(g);
    return g;
  };

  L.remove = function (g, picked) {
    G.scene.remove(g.mesh);
    const i = L.ground.indexOf(g);
    if (i >= 0) L.ground.splice(i, 1);
    if (g.spot) { g.spot.item = null; g.spot.respawnAt = G.state.time + (picked ? 900 : 60); }
  };

  // Aparece/desaparece loot según la distancia al jugador.
  L.update = function (px, pz) {
    const now = G.state.time;
    for (const s of G.world.lootSpots) {
      const d = Math.abs(s.x - px) + Math.abs(s.z - pz);
      if (d < 160) {
        if (!s.item && now >= s.respawnAt) {
          if (Math.random() < 0.75) s.item = L.drop(G.rollLoot(s.table), s.x, s.y, s.z, s);
          else s.respawnAt = now + 600;
        }
      } else if (d > 320 && s.item) {
        // fuera de rango: se libera para ahorrar memoria (vuelve a aparecer luego)
        const g = s.item; s.item = null;
        G.scene.remove(g.mesh);
        L.ground.splice(L.ground.indexOf(g), 1);
        s.respawnAt = 0;
      }
    }
    // objetos sueltos (tirados, de infectados) muy lejos se eliminan
    for (let i = L.ground.length - 1; i >= 0; i--) {
      const g = L.ground[i];
      if (!g.spot && Math.abs(g.x - px) + Math.abs(g.z - pz) > 900) { G.scene.remove(g.mesh); L.ground.splice(i, 1); }
    }
  };

  L.clearAll = function () {
    for (const g of L.ground) G.scene.remove(g.mesh);
    L.ground.length = 0;
    for (const s of G.world.lootSpots) { s.item = null; s.respawnAt = 0; }
  };
})();
