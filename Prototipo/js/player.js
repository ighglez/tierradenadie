'use strict';
// Jugador: estado vital, movimiento, inventario, acciones e interacción.
(function () {
  const I = G.ITEMS;
  const P = G.player = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
    onGround: true, crouch: false, sprinting: false, swimming: false, aiming: false,
    eq: {}, inv: [], hand: 'none', flashOn: false, dead: false,
  };
  const EQ_SLOTS = ['shoulder', 'belt', 'melee', 'jacket', 'backpack', 'helmet'];
  P.EQ_SLOTS = EQ_SLOTS;
  P.SLOT_NAMES = { shoulder: 'Hombro', belt: 'Cintura', melee: 'Cuerpo a cuerpo', jacket: 'Chaqueta', backpack: 'Mochila', helmet: 'Cabeza' };

  P.reset = function () {
    const sp = findSpawn();
    P.pos.set(sp.x, G.world.groundAt(sp.x, sp.z), sp.z);
    P.vel.set(0, 0, 0);
    P.yaw = 0; P.pitch = 0; // mirando hacia el norte (tierra adentro)
    P.health = 100; P.blood = 5000; P.energy = 75; P.water = 75; P.temp = 36.8; P.stamina = 100;
    P.bleeds = 0; P.sick = 0; P.wet = 0; P.dead = false; P.crouch = false;
    P.eq = { shoulder: null, belt: null, melee: null, jacket: null, backpack: null, helmet: null };
    P.inv = [G.makeItem('rag', 2), G.makeItem('flashlight'), G.makeItem('apple')];
    P.hand = 'none'; P.flashOn = false; P.action = null;
    P.lastAttack = 0; P.hurtFlash = 0; P.noiseRadius = 0; P.stepAcc = 0; P.fallSpeed = 0;
    P.msgFlags = {};
    P.prone = false; P.walk = false; P.lean = 0; P.weight = 0; P.staminaDelay = 0; P.exhausted = false;
    P.shock = 0; P.unconscious = false; P.unconsciousT = 0; P.fracture = false; P.splinted = false; P.healT = 0;
    P.morphineT = 0; P.painkillerT = 0; P.flu = 0; P.dirtyWound = 0; P.infection = false; P.swayX = 0; P.swayY = 0;
    P.holdBreath = false; P.gait = 'quieto'; P.inside = false;
  };

  function findSpawn() {
    for (let k = 0; k < 200; k++) {
      const x = G.randRange(-650, 650);
      for (let z = 250; z < 700; z += 2) {
        const h = G.world.terrainHeight(x, z);
        if (h < 1.6) {
          if (h > 0.4 && !G.world.inTown(x, z, 10)) return { x, z: z - 4 };
          break;
        }
      }
    }
    return { x: 0, z: 480 };
  }

  // ---- Inventario ----
  P.capacity = function () {
    let c = 6;
    if (P.eq.jacket) c += I[P.eq.jacket.id].slots;
    if (P.eq.backpack) c += I[P.eq.backpack.id].slots;
    return c;
  };
  P.addItem = function (it) {
    const d = I[it.id];
    if (d.stack) {
      for (const o of P.inv) {
        if (o.id === it.id && o.qty < d.stack) {
          const n = Math.min(d.stack - o.qty, it.qty);
          o.qty += n; it.qty -= n;
          if (it.qty <= 0) return true;
        }
      }
    }
    if (P.inv.length >= P.capacity()) return false;
    P.inv.push(it);
    return true;
  };
  P.removeItem = function (it) {
    const i = P.inv.indexOf(it);
    if (i >= 0) P.inv.splice(i, 1);
  };
  P.useOne = function (it) {
    if (it.qty !== undefined && it.qty > 1) it.qty--; else P.removeItem(it);
  };
  P.find = (id) => P.inv.find((o) => o.id === id);
  P.count = function (id) {
    let n = 0;
    for (const o of P.inv) if (o.id === id) n += o.qty || 1;
    return n;
  };
  P.consume = function (id, n) {
    for (let i = P.inv.length - 1; i >= 0 && n > 0; i--) {
      const o = P.inv[i];
      if (o.id !== id) continue;
      const q = o.qty || 1, take = Math.min(q, n);
      n -= take;
      if (q - take <= 0) P.inv.splice(i, 1); else o.qty = q - take;
    }
  };
  P.hasTool = function (tag) {
    const check = (o) => o && I[o.id].tool && I[o.id].tool.includes(tag);
    return P.inv.some(check) || check(P.eq.melee);
  };
  P.hasItem = (id) => P.inv.some((o) => o.id === id) || EQ_SLOTS.some((s) => P.eq[s] && P.eq[s].id === id);
  P.handItem = () => (P.hand === 'none' ? null : P.eq[P.hand]);

  P.equip = function (it) {
    const slot = I[it.id].slot;
    if (!slot) return;
    const old = P.eq[slot];
    P.removeItem(it);
    P.eq[slot] = it;
    if (old) {
      give(old);
    }
    // si se quita la mochila/chaqueta y no cabe todo, lo que sobra cae al suelo
    overflow();
    if (I[it.id].cat === 'gun' || I[it.id].cat === 'melee') P.setHand(slot);
    G.ui.msg(`Equipas: ${I[it.id].name}`);
  };
  P.unequip = function (slot) {
    const it = P.eq[slot];
    if (!it) return;
    P.eq[slot] = null;
    if (P.hand === slot) P.setHand('none');
    if (!P.addItem(it)) { dropNear(it); G.ui.msg('No cabe en el inventario: lo dejas en el suelo.'); }
    overflow();
  };
  function overflow() {
    while (P.inv.length > P.capacity()) {
      const it = P.inv.pop();
      dropNear(it);
      G.ui.msg(`No te cabe: ${I[it.id].name} cae al suelo.`);
    }
  }
  function dropNear(it) {
    const a = Math.random() * Math.PI * 2;
    const x = P.pos.x + Math.cos(a) * 0.6, z = P.pos.z + Math.sin(a) * 0.6;
    G.loot.drop(it, x, G.world.groundAt(x, z, P.pos.y), z);
  }
  function give(it) {
    if (!P.addItem(it)) { dropNear(it); G.ui.msg(`No te cabe: ${I[it.id].name} queda en el suelo.`); }
  }
  P.drop = function (it) { P.removeItem(it); dropNear(it); };
  P.dropEquipped = function (slot) {
    const it = P.eq[slot];
    if (!it) return;
    P.eq[slot] = null;
    if (P.hand === slot) P.setHand('none');
    dropNear(it); overflow();
  };
  P.setHand = function (slot) {
    if (slot !== 'none' && !P.eq[slot]) return;
    if (P.action) return;
    P.hand = slot;
    G.combat.onHandChanged();
  };

  P.pickUp = function (g) {
    const it = g.item, d = I[it.id];
    if (d.slot && !P.eq[d.slot]) {
      G.loot.remove(g, true);
      P.eq[d.slot] = it;
      if ((d.cat === 'gun' || d.cat === 'melee') && P.hand === 'none') P.setHand(d.slot);
      G.ui.msg(`Te equipas: ${G.itemLabel(it)}`);
      G.audio.pickup();
      return true;
    }
    if (P.addItem(it)) {
      G.loot.remove(g, true);
      G.ui.msg(`Recoges: ${d.name}`);
      G.audio.pickup();
      return true;
    }
    if (d.stack && it.qty > 0) G.ui.msg('Inventario lleno (has cogido una parte).');
    else G.ui.msg('Inventario lleno.');
    return false;
  };

  // ---- Acciones con tiempo ----
  P.startAction = function (label, dur, fn) {
    if (P.action || P.dead) return;
    P.action = { label, dur, t: 0, fn };
  };

  // ---- Uso de objetos ----
  P.useActions = function (it) {
    const d = I[it.id], acts = [];
    if (d.slot) acts.push(['Equipar', () => P.equip(it)]);
    if (d.cat === 'food') {
      acts.push(['Comer', () => P.startAction(`Comiendo ${d.name.toLowerCase()}`, 3, () => eat(it))]);
      if (d.cookable && nearFire()) acts.push(['Cocinar', () => P.startAction('Cocinando carne', 5, () => { P.useOne(it); give(G.makeItem('cookedmeat', 1)); G.ui.msg('La carne está asada.'); })]);
    }
    if (d.cat === 'drink') {
      if (it.id === 'bottle') {
        if (it.charges > 0) acts.push(['Beber', () => P.startAction('Bebiendo', 2.5, () => drinkBottle(it))]);
        if (it.charges > 0 && it.dirty && P.find('purif')) acts.push(['Potabilizar', () => P.startAction('Potabilizando agua', 3, () => { P.consume('purif', 1); it.dirty = false; G.ui.msg('El agua ya es segura.'); })]);
        if (it.charges > 0) acts.push(['Vaciar', () => { it.charges = 0; it.dirty = false; }]);
      } else acts.push(['Beber', () => P.startAction('Bebiendo', 2, () => { P.useOne(it); P.water = Math.min(100, P.water + d.water); P.energy = Math.min(100, P.energy + (d.energy || 0)); G.audio.drink(); })]);
    }
    if (it.id === 'rag') acts.push(['Vendar', () => {
      if (P.bleeds <= 0) return G.ui.msg('No estoy sangrando.');
      P.startAction('Vendándote', 4, () => { P.useOne(it); P.bleeds = Math.max(0, P.bleeds - 1); G.ui.msg(P.bleeds ? 'Una herida menos... aún sangro.' : 'He dejado de sangrar.'); });
    }]);
    if (it.id === 'bandage') acts.push(['Vendar', () => {
      if (P.bleeds <= 0 && P.health > 95) return G.ui.msg('No lo necesito ahora.');
      P.startAction('Vendándote', 4, () => { P.useOne(it); P.bleeds = 0; P.health = Math.min(100, P.health + 8); G.ui.msg('Heridas vendadas.'); });
    }]);
    if (it.id === 'saline') acts.push(['Inyectar', () => P.startAction('Poniendo suero', 6, () => { P.useOne(it); P.blood = Math.min(5000, P.blood + 1800); G.ui.msg('Me siento con más fuerzas.'); })]);
    if (it.id === 'charcoal') acts.push(['Tomar', () => P.startAction('Tomando pastillas', 2, () => { P.useOne(it); if (P.sick > 0) { P.sick = 0; G.ui.msg('El estómago se calma.'); } else G.ui.msg('No noto nada.'); })]);
    if (it.id === 'painkillers') acts.push(['Tomar', () => P.startAction('Tomando analgésicos', 2, () => { P.useOne(it); P.painkillerT = 300; P.shock = Math.max(0, P.shock - 30); })]);
    if (it.id === 'purif') {
      const b = P.inv.find((o) => o.id === 'bottle' && o.charges > 0 && o.dirty);
      if (b) acts.push(['Potabilizar botella', () => P.startAction('Potabilizando agua', 3, () => { P.useOne(it); b.dirty = false; G.ui.msg('El agua ya es segura.'); })]);
    }
    if (it.id === 'morphine') acts.push(['Inyectar', () => P.startAction('Inyectando morfina', 3, () => { P.useOne(it); P.morphineT = 600; P.shock = 0; if (P.fracture) G.ui.msg('Ya no siento la pierna rota... puedo moverme un tiempo.'); })]);
    if (it.id === 'splint') acts.push(['Entablillar pierna', () => {
      if (!P.fracture) return G.ui.msg('No tengo nada roto.');
      if (P.splinted) return G.ui.msg('Ya está entablillada.');
      P.startAction('Entablillando la pierna', 8, () => { P.useOne(it); P.splinted = true; P.healT = 480; G.ui.msg('Pierna entablillada: tardará en sanar.'); });
    }]);
    if (it.id === 'vitamins') acts.push(['Tomar', () => P.startAction('Tomando vitaminas', 2, () => { P.useOne(it); if (P.flu > 0) { P.flu = Math.min(P.flu, 60); G.ui.msg('Empiezo a encontrarme mejor.'); } })]);
    if (it.id === 'tetracycline') acts.push(['Tomar', () => P.startAction('Tomando antibióticos', 2, () => { P.useOne(it); if (P.infection || P.dirtyWound > 0) { P.infection = false; P.dirtyWound = 0; G.ui.msg('La fiebre empieza a bajar.'); } })]);
    if (it.id === 'disinfectant') acts.push(['Desinfectar heridas', () => P.startAction('Desinfectando heridas', 3, () => { it.charges--; if (it.charges <= 0) P.removeItem(it); if (P.dirtyWound > 0) { P.dirtyWound = 0; G.ui.msg('Heridas limpias.'); } else G.ui.msg('No tengo heridas abiertas.'); })]);
    if (it.id === 'sewing') {
      const cl = P.EQ_SLOTS.map((k) => P.eq[k]).concat(P.inv).find((o) => o && I[o.id].cat === 'cloth' && o.cond < 0.7 && o.cond > 0);
      if (cl) acts.push([`Coser ${I[cl.id].name.toLowerCase()}`, () => P.startAction('Cosiendo', 6, () => { cl.cond = Math.min(0.72, cl.cond + 0.4); it.charges--; if (it.charges <= 0) P.removeItem(it); })]);
    }
    if (it.id === 'cleaning') {
      const gn = P.EQ_SLOTS.map((k) => P.eq[k]).concat(P.inv).find((o) => o && I[o.id].cat === 'gun' && o.cond < 0.7 && o.cond > 0);
      if (gn) acts.push([`Limpiar ${I[gn.id].name.toLowerCase()}`, () => P.startAction('Limpiando el arma', 8, () => { gn.cond = Math.min(0.72, gn.cond + 0.4); gn.jammed = false; it.charges--; if (it.charges <= 0) P.removeItem(it); })]);
    }
    if (it.id === 'map') acts.push(['Ver mapa', () => G.ui.toggleMap(true)]);
    if (it.id === 'flashlight') acts.push([P.flashOn ? 'Apagar' : 'Encender', () => P.toggleFlash()]);
    if (d.cat === 'gun' && it.loaded > 0) acts.push(['Descargar', () => { const n = it.loaded; it.loaded = 0; const a = G.makeItem(d.ammo, n); give(a); }]);
    acts.push(['Tirar', () => P.drop(it)]);
    return acts;
  };

  function eat(it) {
    const d = I[it.id];
    let energy = d.energy, water = d.water || 0;
    if (d.can && !P.hasTool('open')) {
      energy *= 0.5; water *= 0.5;
      G.ui.msg('Sin abrelatas ni cuchillo: abres la lata a golpes y derramas la mitad.');
    }
    P.useOne(it);
    P.energy = G.clamp(P.energy + energy, 0, 100);
    P.water = G.clamp(P.water + water, 0, 100);
    G.audio.eat();
    if (d.sick && Math.random() < d.sick) { P.sick = 240; G.ui.msg('Esa carne cruda no me ha sentado bien...'); }
  }
  function drinkBottle(it) {
    it.charges--;
    P.water = Math.min(100, P.water + I.bottle.perSip);
    G.audio.drink();
    if (it.dirty && Math.random() < 0.5) { P.sick = 240; G.ui.msg('El agua sabía rara... me encuentro mal.'); }
    if (it.charges <= 0) it.dirty = false;
  }

  P.toggleFlash = function () {
    if (!P.hasItem('flashlight')) return G.ui.msg('No tengo linterna.');
    P.flashOn = !P.flashOn;
  };

  // ---- Recetas ----
  P.recipes = function () {
    const out = [];
    const fuel = P.count('sticks') >= 2 || P.count('firewood') >= 1;
    const m = P.find('matches');
    out.push({
      name: 'Encender hoguera', need: '2 palos o 1 leña + cerillas', ok: fuel && !!m,
      fn: () => P.startAction('Encendiendo hoguera', 5, () => {
        if (P.count('firewood') >= 1) P.consume('firewood', 1); else P.consume('sticks', 2);
        const mm = P.find('matches');
        if (mm) { mm.charges--; if (mm.charges <= 0) P.removeItem(mm); }
        const fx = P.pos.x - Math.sin(P.yaw) * 1.6, fz = P.pos.z - Math.cos(P.yaw) * 1.6;
        G.fx.addFire(fx, G.world.groundAt(fx, fz, P.pos.y), fz);
        G.ui.msg('La hoguera prende.');
      }),
    });
    out.push({
      name: 'Hacer un entablillado', need: '2 palos + 1 trapo', ok: P.count('sticks') >= 2 && P.count('rag') >= 1,
      fn: () => P.startAction('Haciendo un entablillado', 5, () => { P.consume('sticks', 2); P.consume('rag', 1); give(G.makeItem('splint')); }),
    });
    out.push({
      name: 'Hacer trapos con una chaqueta', need: 'chaqueta en el inventario + cuchillo', ok: !!P.inv.find((o) => I[o.id].slot === 'jacket') && P.hasTool('cut'),
      fn: () => P.startAction('Cortando tela', 5, () => {
        const j = P.inv.find((o) => I[o.id].slot === 'jacket');
        if (!j) return;
        P.removeItem(j); P.addItem(G.makeItem('rag', 4));
      }),
    });
    return out;
  };

  function nearFire() {
    return G.fx.fires.some((f) => f.fuel > 0 && G.dist2(f.x, f.z, P.pos.x, P.pos.z) < 3);
  }
  P.nearFire = nearFire;

  // ---- Daño ----
  // opts: { shock, fracture (probabilidad), dirty (la herida puede infectarse) }
  P.damage = function (amount, bleedChance, cause, opts) {
    if (P.dead) return;
    opts = opts || {};
    P.health -= amount;
    P.blood -= amount * 8;
    P.shock = Math.min(100, P.shock + (opts.shock !== undefined ? opts.shock : amount * 1.2));
    P.hurtFlash = 1;
    G.audio.hurt();
    if (Math.random() < (bleedChance || 0)) {
      P.bleeds++;
      G.ui.msg('¡Estoy sangrando!', 'bad');
      if (opts.dirty) P.dirtyWound = 90;
    }
    if (opts.fracture && !P.fracture && Math.random() < opts.fracture) {
      P.fracture = true; P.splinted = false; P.prone = false;
      G.ui.msg('¡Me he roto la pierna!', 'bad');
    }
    // la ropa recibe parte del daño
    for (const k of ['jacket', 'helmet', 'backpack']) {
      const it = P.eq[k];
      if (it && Math.random() < 0.35) it.cond = Math.max(0, it.cond - amount * 0.004);
    }
    if (P.action) { P.action = null; }
    P.lastCause = cause || 'heridas';
  };

  // ---- Interacción (F / G) ----
  P.findTarget = function () {
    const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
    const ex = P.pos.x, ey = P.pos.y + P.eyeHeight(), ez = P.pos.z;
    let best = null, bestDot = 0.88;
    for (const g of G.loot.ground) {
      const dx = g.mesh.position.x - ex, dy = g.mesh.position.y - ey, dz = g.mesh.position.z - ez;
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.7) continue;
      const dot = (dx * fx + dy * fy + dz * fz) / d;
      const score = dot + (d < 1.2 ? 0.08 : 0);
      if (score > bestDot) { bestDot = score; best = g; }
    }
    if (best) return { label: `Coger: ${G.itemLabel(best.item)}`, f: () => P.pickUp(best) };

    for (const deer of G.ai.deer) {
      if (!deer.dead || deer.gutted) continue;
      if (G.dist2(deer.x, deer.z, ex, ez) < 2.6) {
        return {
          label: 'Despiezar animal' + (P.hasTool('cut') ? '' : ' (necesitas un cuchillo o hacha)'),
          f: () => {
            if (!P.hasTool('cut')) return G.ui.msg('Necesito algo con filo.');
            P.startAction('Despiezando', 6, () => {
              deer.gutted = true; deer.removeAt = G.state.time + 1;
              for (let k = 0; k < 4; k++) { const m = G.makeItem('rawmeat', 1); give(m); }
              G.ui.msg('Obtienes 4 trozos de carne cruda.');
            });
          },
        };
      }
    }
    for (const f of G.fx.fires) {
      if (f.fuel > 0 && G.dist2(f.x, f.z, ex, ez) < 2.6) {
        const raw = P.find('rawmeat');
        if (raw) return { label: 'Cocinar carne en la hoguera', f: () => P.startAction('Cocinando carne', 5, () => { P.consume('rawmeat', 1); const c = G.makeItem('cookedmeat', 1); give(c); G.ui.msg('Carne asada lista.'); }) };
        const fuel = P.count('firewood') ? 'firewood' : P.count('sticks') ? 'sticks' : null;
        return { label: fuel ? 'Avivar hoguera' : 'Hoguera (necesitas palos o leña para avivarla)', f: () => { if (!fuel) return; P.consume(fuel, 1); f.fuel = Math.min(900, f.fuel + (fuel === 'firewood' ? 300 : 120)); } };
      }
    }
    for (const w of G.world.wells) {
      if (G.dist2(w.x, w.z, ex, ez) < 2.3) return waterTarget(false, 'del pozo');
    }
    // agua delante del jugador
    const ax = ex + fx * 1.6, az = ez + fz * 1.6;
    if (P.swimming || G.world.terrainHeight(ax, az) < -0.15 || G.world.terrainHeight(ex, ez) < -0.1) {
      if (G.world.isSea(ax, az)) return { label: 'Agua salada: no se puede beber', f: () => G.ui.msg('Beber agua de mar solo me daría más sed.') };
      return waterTarget(true, 'del lago');
    }
    // árboles
    for (const t of G.world.treesNear(ex, ez)) {
      const dx = t.x - ex, dz = t.z - ez, d = Math.hypot(dx, dz);
      if (d > 1.9) continue;
      if ((dx * fx + dz * fz) / d < 0.5) continue;
      const hand = P.handItem();
      if (hand && hand.id === 'axe') return { label: 'Cortar leña', f: () => P.startAction('Cortando leña', 5, () => { const w = G.makeItem('firewood', 2); give(w); G.audio.hit(t); }) };
      return {
        label: t.sticks >= 3 ? 'No quedan ramas a mano' : 'Romper ramas', f: () => {
          if (t.sticks >= 3) return;
          P.startAction('Rompiendo ramas', 3, () => { t.sticks++; const s = G.makeItem('sticks', 2); give(s); });
        },
      };
    }
    return null;
  };
  function waterTarget(dirty, where) {
    const b = P.inv.find((o) => o.id === 'bottle' && o.charges < I.bottle.charges);
    return {
      label: `Beber ${where}` + (b ? '   ·   [G] Llenar botella' : ''),
      f: () => P.startAction('Bebiendo', 2.5, () => {
        P.water = Math.min(100, P.water + 25); G.audio.drink();
        if (dirty && Math.random() < 0.25) { P.sick = 240; G.ui.msg('Esa agua no estaba muy limpia...'); }
      }),
      g: b ? () => P.startAction('Llenando botella', 3, () => { b.charges = I.bottle.charges; b.dirty = dirty; G.ui.msg(dirty ? 'Botella llena (agua sin tratar).' : 'Botella llena de agua de pozo.'); }) : null,
    };
  }

  P.eyeHeight = () => (P.swimming ? 1.5 : P.prone ? 0.32 : P.crouch ? 1.0 : 1.62);

  // ---- Peso y resistencia ----
  P.totalWeight = function () {
    let w = 0;
    for (const it of P.inv) w += G.itemWeight(it);
    for (const k of EQ_SLOTS) if (P.eq[k]) w += G.itemWeight(P.eq[k]);
    return w;
  };
  // La carga reduce la resistencia máxima, como en el género.
  P.maxStamina = function () {
    let m = 100 - Math.max(0, P.weight - 12) * 2.4;
    if (P.flu > 0) m -= 20;
    if (P.energy < 15) m -= 20;
    return G.clamp(m, 15, 100);
  };
  P.setStance = function (st) {
    if (P.swimming || P.unconscious) return;
    if (st === 'prone' && P.prone) st = 'stand';
    if (st === 'crouch' && P.crouch) st = 'stand';
    P.prone = st === 'prone'; P.crouch = st === 'crouch';
  };

  // ---- Movimiento ----
  P.updateMovement = function (dt, keys) {
    const W = G.world;
    P.weight = P.totalWeight();
    let mx = 0, mz = 0;
    if (!P.unconscious) {
      if (keys.KeyW) mz -= 1;
      if (keys.KeyS) mz += 1;
      if (keys.KeyA) mx -= 1;
      if (keys.KeyD) mx += 1;
    }
    const moving = mx !== 0 || mz !== 0;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    const legOk = !P.fracture || P.morphineT > 0;
    const canSprint = legOk && !P.splinted && P.weight < 32 && !P.exhausted;
    const wantSprint = keys.ShiftLeft && mz < 0 && !P.crouch && !P.prone && !P.aiming && !P.action && P.stamina > 1 && canSprint;
    P.sprinting = moving && wantSprint && !P.swimming;
    // paso: caminar (Ctrl alterna), trotar (por defecto) o esprintar (Mayús)
    let speed;
    if (P.swimming) speed = 1.6;
    else if (P.prone) speed = 0.75;
    else if (P.crouch) speed = P.walk ? 1.2 : 2.2;
    else if (P.sprinting) speed = 6.2;
    else speed = P.walk ? 1.6 : 3.7;
    if (!legOk) speed = Math.min(speed, P.splinted ? 2.0 : 1.0);
    else if (P.splinted) speed = Math.min(speed, 3.0);
    if (P.weight > 40) speed *= 0.8;
    if (P.aiming) speed = Math.min(speed, P.prone ? 0.4 : 1.6);
    if (P.action) speed = Math.min(speed, 1.2);
    if (P.health < 25) speed *= 0.75;
    P.gait = !moving ? 'quieto' : P.sprinting ? 'esprint' : speed <= 1.7 ? 'paso' : 'trote';
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    const wx = mx * cos + mz * sin, wz = -mx * sin + mz * cos;
    const accel = P.onGround || P.swimming ? 10 : 2;
    P.vel.x += (wx * speed - P.vel.x) * Math.min(1, accel * dt);
    P.vel.z += (wz * speed - P.vel.z) * Math.min(1, accel * dt);

    let nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
    const height = P.prone ? 0.5 : P.crouch ? 1.1 : 1.75;
    const c = W.collide(nx, nz, 0.35, P.pos.y + 0.05, P.pos.y + height);
    P.pos.x = c.x; P.pos.z = c.z;

    const ground = W.groundAt(P.pos.x, P.pos.z, P.pos.y);
    const inside = !!W.insideBuilding(P.pos.x, P.pos.z);
    P.inside = inside;
    P.swimming = !inside && ground < -1.3;
    if (P.swimming) {
      P.pos.y = G.lerp(P.pos.y, -1.35, Math.min(1, dt * 4));
      P.vel.y = 0; P.onGround = false;
      P.wet = Math.min(1, P.wet + dt * 0.5);
      P.crouch = P.prone = false;
      P.stamina = Math.max(0, P.stamina - (moving ? 2 : 0) * dt);
    } else {
      if (keys.Space && P.onGround && !P.action && !P.prone && !P.unconscious && legOk) {
        if (P.stamina > 15) { P.vel.y = 5.0; P.onGround = false; P.stamina -= 15; P.staminaDelay = 1.5; }
        if (P.crouch) P.crouch = false;
        keys.Space = false;
      }
      P.vel.y -= 20 * dt;
      P.pos.y += P.vel.y * dt;
      if (P.pos.y <= ground) {
        if (!P.onGround && P.vel.y < -10) {
          const dmg = (-P.vel.y - 10) * 9;
          P.damage(dmg, dmg > 25 ? 0.4 : 0, 'una caída', { shock: dmg * 1.5, fracture: dmg > 14 ? 0.8 : dmg > 6 ? 0.3 : 0 });
        }
        P.pos.y = ground; P.vel.y = 0; P.onGround = true;
      } else if (P.pos.y - ground > 0.3) P.onGround = false;
      if (ground < -0.4 && !inside) P.wet = Math.min(1, P.wet + dt * 0.15);
    }

    // ruido que hacemos (los infectados oyen los pasos)
    const sp = Math.hypot(P.vel.x, P.vel.z);
    const loud = { quieto: 0, paso: 5, trote: 13, esprint: 26 }[sp < 0.3 ? 'quieto' : P.gait] || 0;
    P.noiseRadius = loud * (P.crouch ? 0.4 : P.prone ? 0.25 : 1) * (inside ? 1.3 : 1);
    if (P.onGround && sp > 0.4) {
      P.stepAcc += sp * dt;
      const stride = P.sprinting ? 1.9 : P.prone ? 0.9 : 1.35;
      if (P.stepAcc > stride) { P.stepAcc = 0; G.audio.step(P.sprinting ? 1.5 : P.crouch || P.prone ? 0.3 : P.walk ? 0.4 : 0.8); }
    }
    P.speed = sp;
    // inclinarse (Q/E)
    const leanT = P.prone || P.sprinting ? 0 : (keys.KeyQ ? -1 : 0) + (keys.KeyE ? 1 : 0);
    P.lean += (leanT - P.lean) * Math.min(1, dt * 8);
    // balanceo del arma al apuntar: más con poca resistencia, menos tumbado o conteniendo la respiración
    P.holdBreath = P.aiming && keys.ShiftLeft && P.stamina > 5;
    const t = performance.now() / 1000;
    let sway = 0.004 + (1 - P.stamina / 100) * 0.018 + (P.exhausted ? 0.012 : 0) + (P.temp < 35.5 ? 0.01 : 0) + (P.fracture ? 0.004 : 0);
    if (P.crouch) sway *= 0.7;
    if (P.prone) sway *= 0.35;
    if (P.painkillerT > 0) sway *= 0.7;
    if (P.holdBreath) sway *= 0.15;
    if (!P.aiming) sway *= 0.3;
    P.swayX = (Math.sin(t * 0.9) + Math.sin(t * 2.3) * 0.4) * sway;
    P.swayY = (Math.sin(t * 1.3 + 1) + Math.sin(t * 2.9) * 0.35) * sway * 0.8;
  };

  // ---- Estado vital ----
  P.updateVitals = function (dt, daylight) {
    if (P.dead) return;
    const s = P.sprinting ? 1 : 0, jog = P.gait === 'trote' ? 1 : 0;
    P.energy -= (0.04 + 0.015 * jog + 0.06 * s + (P.sick > 0 ? 0.04 : 0) + (P.temp < 36 ? 0.02 : 0)) * dt;
    P.water -= (0.065 + 0.015 * jog + 0.07 * s + (P.sick > 0 ? 0.12 : 0) + (P.infection ? 0.04 : 0)) * dt;
    P.energy = Math.max(0, P.energy); P.water = Math.max(0, P.water);
    // resistencia: se gasta esprintando, aguantando la respiración y nadando; se recupera tras una pausa
    const maxS = P.maxStamina();
    const draining = P.sprinting || P.holdBreath;
    if (P.sprinting) P.stamina -= 9 * (1 + Math.max(0, P.weight - 20) / 25) * dt;
    if (P.holdBreath) P.stamina -= 14 * dt;
    if (draining) P.staminaDelay = 1.2;
    else {
      P.staminaDelay = Math.max(0, P.staminaDelay - dt);
      if (P.staminaDelay <= 0) P.stamina += (P.energy > 20 ? 8 : 3.5) * (P.gait === 'trote' ? 0.6 : 1) * (P.prone || P.crouch ? 1.2 : 1) * dt;
    }
    P.stamina = G.clamp(P.stamina, 0, maxS);
    if (P.stamina < 2 && !P.exhausted) { P.exhausted = true; G.ui.msg('Estoy agotado.', 'bad'); }
    if (P.exhausted && P.stamina > maxS * 0.35) P.exhausted = false;
    if (P.exhausted && Math.random() < dt * 0.8) G.audio.breath();
    // sangrado
    if (P.bleeds > 0) P.blood -= P.bleeds * 11 * dt;
    // shock: se recupera solo; al llegar al límite te desmayas
    if (P.unconscious) {
      P.unconsciousT -= dt;
      if (P.unconsciousT <= 0) { P.unconscious = false; P.shock = 40; G.ui.msg('Recuperas el conocimiento...'); }
    } else {
      if (P.shock >= 100) knockOut(8 + Math.random() * 12);
      P.shock = Math.max(0, P.shock - (P.health > 50 ? 4 : 1.5) * dt);
      if (P.blood < 2800) P.shock = Math.min(100, P.shock + (2800 - P.blood) / 400 * dt * 3);
    }
    // recuperación
    if (P.energy > 45 && P.water > 45 && P.bleeds === 0 && P.sick <= 0 && !P.infection) {
      P.blood = Math.min(5000, P.blood + 7 * dt);
      if (P.blood > 4000 && P.temp > 35.5) P.health = Math.min(100, P.health + 0.12 * dt);
    }
    if (P.energy <= 0) P.health -= 0.35 * dt;
    if (P.water <= 0) P.health -= 0.55 * dt;
    if (P.blood < 2500) P.health -= 0.5 * dt;
    // fracturas
    if (P.morphineT > 0) P.morphineT -= dt;
    if (P.painkillerT > 0) P.painkillerT -= dt;
    if (P.fracture && P.splinted) {
      P.healT -= dt;
      if (P.healT <= 0) { P.fracture = false; P.splinted = false; G.ui.msg('La pierna ya ha soldado.'); }
    }
    // temperatura: clima, ropa (mojada abriga menos), refugio, fuego y actividad
    const wx = G.world.weather || { rain: 0 };
    if (wx.rain > 0.15 && !P.inside && !P.swimming) {
      const wp = P.eq.jacket ? (I[P.eq.jacket.id].waterproof || 0) : 0;
      P.wet = Math.min(1, P.wet + wx.rain * 0.006 * (1 - wp) * dt);
    }
    const env = G.lerp(3, 17, daylight) - P.wet * 10 - wx.rain * 3 - (G.world.weather ? G.world.weather.cover * 2 : 0);
    const jk = P.eq.jacket;
    let warmth = env + 4 + (jk ? I[jk.id].warmth * (0.4 + 0.6 * Math.max(0, jk.cond)) : 0);
    if (P.eq.helmet) warmth += 1;
    if (P.nearFire()) warmth += 22;
    if (P.inside) warmth += 5;
    if (P.sprinting) warmth += 5; else if (P.gait === 'trote') warmth += 2;
    if (P.infection) warmth += 8; // fiebre
    const target = warmth >= 19 ? (P.infection ? 38.4 : 36.8) : G.clamp(36.8 - (19 - warmth) * 0.3, 33.5, 36.8);
    const rate = target > P.temp ? 0.02 : 0.006;
    P.temp += G.clamp(target - P.temp, -rate * dt, rate * dt);
    if (P.temp < 35) P.health -= 0.3 * dt;
    if (P.temp > 38) P.water -= 0.05 * dt;
    if (!P.swimming && (P.inside || wx.rain < 0.15)) P.wet = Math.max(0, P.wet - dt * (P.nearFire() ? 0.05 : 0.005));
    // envenenamiento
    if (P.sick > 0) {
      P.sick -= dt;
      if (Math.random() < dt / 40) { P.energy = Math.max(0, P.energy - 10); P.water = Math.max(0, P.water - 12); G.ui.msg('Vomitas.', 'bad'); G.audio.vomit(); }
    }
    // resfriado: el frío prolongado lo provoca; la tos hace ruido
    if (P.temp < 35.9 && !P.flu && Math.random() < dt / 240) { P.flu = 900; G.ui.msg('Creo que me he resfriado.', 'bad'); }
    if (P.flu > 0) {
      P.flu -= dt * (P.temp > 36.4 ? 1.5 : 1);
      if (P.flu <= 0) { P.flu = 0; G.ui.msg('El resfriado se me ha pasado.'); }
      if (Math.random() < dt / 25) { G.audio.cough(); G.ai.noise(P.pos.x, P.pos.z, 22); }
    }
    // heridas sucias: si no se desinfectan acaban infectándose
    if (P.dirtyWound > 0) {
      P.dirtyWound -= dt;
      if (P.dirtyWound <= 0 && !P.infection) {
        if (Math.random() < 0.6) { P.infection = true; G.ui.msg('La herida tiene mal aspecto... tengo fiebre.', 'bad'); }
      }
    }
    if (P.infection) P.health -= 0.08 * dt;
    // mensajes de estado (solo al cruzar umbrales)
    flag('hungry', P.energy < 25, 'Tengo hambre.');
    flag('starving', P.energy <= 0, 'Me muero de hambre...');
    flag('thirsty', P.water < 25, 'Tengo sed.');
    flag('parched', P.water <= 0, 'Estoy deshidratado...');
    flag('cold', P.temp < 36, 'Tengo frío.');
    flag('freezing', P.temp < 35, 'Estoy congelándome...');
    flag('wet', P.wet > 0.5, 'Tengo la ropa empapada.');
    flag('dizzy', P.blood < 3200, 'Me siento mareado.');
    flag('weak', P.health < 30, 'Me siento muy débil.');
    flag('heavy', P.weight > 32, 'Llevo demasiado peso para correr.');
    if (P.health <= 0 || P.blood <= 0) {
      const cause = P.blood <= 0 ? 'desangrado' : P.energy <= 0 ? 'inanición' : P.water <= 0 ? 'deshidratación' : P.temp < 35 ? 'hipotermia' : P.infection ? 'una infección' : P.lastCause || 'heridas';
      G.main.die(cause);
    }
  };
  function flag(k, cond, text) {
    if (cond && !P.msgFlags[k]) { P.msgFlags[k] = true; G.ui.msg(text, 'bad'); }
    else if (!cond) P.msgFlags[k] = false;
  }
  function knockOut(secs) {
    P.unconscious = true; P.unconsciousT = secs;
    P.action = null; P.aiming = false; P.prone = true; P.crouch = false;
    G.ui.msg('Pierdes el conocimiento...', 'bad');
  }

  P.updateAction = function (dt) {
    if (!P.action) return;
    if (P.sprinting || P.unconscious) { P.action = null; return; }
    P.action.t += dt;
    if (P.action.t >= P.action.dur) {
      const a = P.action; P.action = null;
      a.fn();
    }
  };

  // ---- Guardado ----
  P.serialize = function () {
    return {
      pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, pitch: P.pitch,
      health: P.health, blood: P.blood, energy: P.energy, water: P.water, temp: P.temp, stamina: P.stamina,
      bleeds: P.bleeds, sick: P.sick, wet: P.wet, eq: P.eq, shock: P.shock, fracture: P.fracture, splinted: P.splinted, healT: P.healT,
      flu: P.flu, dirtyWound: P.dirtyWound, infection: P.infection, prone: P.prone, crouch: P.crouch, walk: P.walk, inv: P.inv, hand: P.hand, flashOn: P.flashOn,
    };
  };
  P.load = function (d) {
    P.reset();
    P.pos.set(d.pos[0], d.pos[1] + 0.2, d.pos[2]);
    P.yaw = d.yaw; P.pitch = d.pitch;
    for (const k of ['health', 'blood', 'energy', 'water', 'temp', 'stamina', 'bleeds', 'sick', 'wet', 'hand', 'flashOn', 'shock', 'fracture', 'splinted', 'healT', 'flu', 'dirtyWound', 'infection', 'prone', 'crouch', 'walk']) if (d[k] !== undefined) P[k] = d[k];
    P.eq = Object.assign({ shoulder: null, belt: null, melee: null, jacket: null, backpack: null, helmet: null }, d.eq);
    P.inv = d.inv.filter((o) => I[o.id]);
  };
})();
