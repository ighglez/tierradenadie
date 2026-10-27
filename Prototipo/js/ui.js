'use strict';
// Interfaz: HUD, inventario, mapa, mensajes.
(function () {
  const I = G.ITEMS;
  const U = G.ui = { invOpen: false, mapOpen: false };
  const $ = (id) => document.getElementById(id);

  U.init = function () {
    U.el = {
      prompt: $('prompt'), action: $('action'), actionLabel: $('action-label'), actionBar: $('action-bar'),
      msgs: $('msgs'), weapon: $('weapon'), compass: $('compass'), clock: $('clock'), hurt: $('hurt'),
      stamina: $('stamina-bar'), hit: $('hitmarker'), inv: $('inventory'), map: $('map'), indicators: $('indicators'),
    };
    U.stats = {};
    for (const k of ['health', 'blood', 'energy', 'water', 'temp']) U.stats[k] = $('st-' + k);
    U.el.inv.addEventListener('click', onInvClick);
    buildMapCanvas();
  };

  // ---- Mensajes ----
  U.msg = function (text, kind) {
    const d = document.createElement('div');
    d.className = 'msg' + (kind ? ' ' + kind : '');
    d.textContent = text;
    U.el.msgs.appendChild(d);
    while (U.el.msgs.children.length > 6) U.el.msgs.removeChild(U.el.msgs.firstChild);
    setTimeout(() => d.classList.add('fade'), 5000);
    setTimeout(() => d.remove(), 6500);
  };

  let hitT = 0;
  U.hitmarker = function (head) {
    U.el.hit.style.opacity = 1;
    U.el.hit.style.color = head ? '#ff4040' : '#ffffff';
    hitT = 0.15;
  };

  function level(v, good, mid) { return v >= good ? 'ok' : v >= mid ? 'warn' : 'bad'; }
  // HUD mínimo: cada icono solo aparece cuando hay algo que vigilar (H muestra todos)
  function setStat(el, frac, cls) {
    el.firstElementChild.nextElementSibling.firstElementChild.style.width = G.clamp(frac, 0, 1) * 100 + '%';
    el.className = 'st ' + cls + (cls === 'ok' && !U.hudAll ? ' gone' : '');
  }
  let peekT = 0, peekKind = null;
  U.peek = function (kind) {
    const P = G.player;
    if (!P.hasItem(kind)) return U.msg(kind === 'compass' ? 'No tengo brújula.' : 'No tengo reloj.');
    peekKind = kind; peekT = 4;
  };

  U.update = function (dt) {
    const P = G.player;
    setStat(U.stats.health, P.health / 100, level(P.health, 70, 35));
    setStat(U.stats.blood, P.blood / 5000, level(P.blood, 4000, 2800));
    setStat(U.stats.energy, P.energy / 100, level(P.energy, 50, 20));
    setStat(U.stats.water, P.water / 100, level(P.water, 50, 20));
    setStat(U.stats.temp, (P.temp - 33) / 4, P.temp >= 36.2 ? 'ok' : P.temp >= 35.2 ? 'warn' : 'bad');
    U.el.stamina.style.width = P.stamina + '%';
    U.el.stamina.parentElement.style.opacity = P.stamina < 99 ? 1 : 0;
    // indicadores
    let ind = '';
    if (P.bleeds > 0) ind += `<span class="bad">🩸 Sangrando ×${P.bleeds}</span>`;
    if (P.sick > 0) ind += '<span class="warn">🤢 Enfermo</span>';
    if (P.wet > 0.2) ind += '<span class="warn">💦 Mojado</span>';
    if (P.nearFire()) ind += '<span class="ok">🔥 Calor</span>';
    if (P.fracture) ind += `<span class="bad">🦴 Pierna rota${P.splinted ? ' (entablillada)' : ''}</span>`;
    if (P.infection) ind += '<span class="bad">🌡 Fiebre</span>';
    if (P.flu > 0) ind += '<span class="warn">🤧 Resfriado</span>';
    if (P.shock > 50) ind += '<span class="warn">💫 Aturdido</span>';
    if (P.exhausted) ind += '<span class="warn">Agotado</span>';
    if (P.weight > 32) ind += '<span class="warn">Sobrecargado</span>';
    if (P.prone) ind += '<span>Tumbado</span>'; else if (P.crouch) ind += '<span>Agachado</span>';
    if (P.walk) ind += '<span>Caminando</span>';
    U.el.indicators.innerHTML = ind;
    // arma
    const it = P.handItem();
    if (it) {
      const d = I[it.id];
      U.el.weapon.innerHTML = d.cat === 'gun' ? `${d.name}<br><b>${it.loaded}</b> / ${P.count(d.ammo)}` : d.name;
    } else U.el.weapon.textContent = 'Manos vacías';
    // interacción
    const tg = G.main.target;
    U.el.prompt.textContent = tg && !P.action && !U.invOpen ? `[F] ${tg.label}` : '';
    // acción en curso
    if (P.action) {
      U.el.action.style.display = 'block';
      U.el.actionLabel.textContent = P.action.label + '...';
      U.el.actionBar.style.width = (P.action.t / P.action.dur * 100) + '%';
    } else U.el.action.style.display = 'none';
    // brújula y reloj
    peekT -= dt;
    if (peekT > 0 && peekKind === 'compass' && P.hasItem('compass')) {
      let deg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
      U.el.compass.textContent = `${dirs[Math.round(deg / 45) % 8]}  ${Math.round(deg)}°`;
      U.el.compass.style.display = 'block';
    } else U.el.compass.style.display = 'none';
    if (peekT > 0 && peekKind === 'watch' && P.hasItem('watch')) {
      const h = Math.floor(G.state.hour), m = Math.floor((G.state.hour - h) * 60);
      U.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      U.el.clock.style.display = 'block';
    } else U.el.clock.style.display = 'none';
    // daño y pérdida de sangre (desaturación)
    P.hurtFlash = Math.max(0, P.hurtFlash - dt * 2);
    const lowHealth = P.health < 30 ? 0.35 + Math.sin(performance.now() / 300) * 0.1 : 0;
    U.el.hurt.style.opacity = Math.max(P.hurtFlash * 0.7, lowHealth);
    // shock e inconsciencia: la visión se oscurece
    const ko = document.getElementById('ko');
    ko.style.opacity = P.unconscious ? 1 : G.clamp((P.shock - 40) / 90, 0, 0.6);
    ko.textContent = P.unconscious ? '...' : '';
    const sat = G.clamp((P.blood - 2000) / 2500, 0, 1);
    const bright = P.dead ? 0.4 : 1 - (P.blood < 3000 ? (3000 - P.blood) / 6000 : 0);
    G.renderer.domElement.style.filter = `saturate(${(sat * 0.85).toFixed(2)}) contrast(1.06) brightness(${bright.toFixed(2)})` + (P.temp < 35 ? ' hue-rotate(10deg)' : '');
    if (hitT > 0) { hitT -= dt; if (hitT <= 0) U.el.hit.style.opacity = 0; }
    if (U.invOpen) { invTimer -= dt; if (invTimer <= 0) { invTimer = 0.4; U.renderInv(false); } }
    if (U.mapOpen) drawMap();
  };

  // ---- Inventario ----
  let invTimer = 0, invSig = '', handlers = [];
  U.toggleInv = function (force) {
    U.invOpen = force !== undefined ? force : !U.invOpen;
    if (U.invOpen) U.toggleMap(false);
    U.el.inv.classList.toggle('hidden', !U.invOpen);
    if (U.invOpen) { document.exitPointerLock(); U.renderInv(true); } else G.main.lock();
  };
  function vitalsText(P) {
    const h = P.health > 80 ? 'Sano' : P.health > 50 ? 'Herido' : P.health > 25 ? 'Malherido' : 'Moribundo';
    const b = P.blood > 4200 ? 'Normal' : P.blood > 3200 ? 'Baja' : P.blood > 2500 ? 'Muy baja' : 'Crítica';
    const e = P.energy > 70 ? 'Saciado' : P.energy > 35 ? 'Bien' : P.energy > 0 ? 'Hambriento' : 'Famélico';
    const w = P.water > 70 ? 'Hidratado' : P.water > 35 ? 'Bien' : P.water > 0 ? 'Sediento' : 'Deshidratado';
    const extra = [P.fracture ? 'pierna rota' : '', P.infection ? 'fiebre' : '', P.flu > 0 ? 'resfriado' : '', P.dirtyWound > 0 ? 'herida sin desinfectar' : '', P.sick > 0 ? 'intoxicado' : ''].filter(Boolean);
    return (extra.length ? `<span style="color:#ff9a8a">${extra.join(' · ')}</span><br>` : '') + `Salud: <b>${h}</b> · Sangre: <b>${b}</b> · Comida: <b>${e}</b> · Agua: <b>${w}</b> · Temperatura: <b>${P.temp.toFixed(1)} °C</b>`;
  }
  function btn(label, fn, disabled) {
    handlers.push(fn);
    return `<button data-h="${handlers.length - 1}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }
  U.renderInv = function (force) {
    const P = G.player;
    const near = G.loot.ground.filter((g) => G.dist2(g.x, g.z, P.pos.x, P.pos.z) < 2.6 && Math.abs(g.y - P.pos.y) < 2);
    const sig = JSON.stringify([P.fracture, P.infection, P.flu > 0, P.dirtyWound > 0, P.inv, P.eq, near.map((g) => g.item), P.bleeds > 0, P.sick > 0, P.nearFire(), P.hand, P.flashOn, Math.round(P.health / 10), Math.round(P.blood / 500), Math.round(P.energy / 10), Math.round(P.water / 10)]);
    if (!force && sig === invSig) return;
    invSig = sig;
    handlers = [];
    let html = `<div class="inv-head"><h2>Inventario</h2><div class="vitals">${vitalsText(P)}</div><div class="weight">Carga: <b>${P.weight.toFixed(1)} kg</b>${P.weight > 32 ? ' (no puedes esprintar)' : ''}</div><div class="close">[Tab] cerrar</div></div><div class="inv-cols">`;
    // equipo
    html += '<div class="col"><h3>Equipo</h3>';
    for (const s of P.EQ_SLOTS) {
      const it = P.eq[s];
      html += `<div class="row"><span class="slot">${P.SLOT_NAMES[s]}</span><span class="name">${it ? G.itemLabel(it) : '<i>vacío</i>'}</span>`;
      if (it) {
        const d = I[it.id];
        if ((d.cat === 'gun' || d.cat === 'melee') && P.hand !== s) html += btn('A la mano', () => P.setHand(s));
        if (d.cat === 'gun' && it.loaded > 0) html += btn('Descargar', () => { const n = it.loaded; it.loaded = 0; P.addItem(G.makeItem(d.ammo, n)); });
        html += btn('Quitar', () => P.unequip(s)) + btn('Tirar', () => P.dropEquipped(s));
      }
      html += '</div>';
    }
    html += '</div>';
    // inventario
    html += `<div class="col"><h3>Mochila y bolsillos (${P.inv.length}/${P.capacity()})</h3>`;
    if (!P.inv.length) html += '<div class="row"><i>No llevas nada.</i></div>';
    for (const it of P.inv) {
      const d = I[it.id];
      html += `<div class="row"><span class="dot" style="background:#${d.color.toString(16).padStart(6, '0')}"></span><span class="name" title="${d.desc || ''}">${G.itemLabel(it)}</span>`;
      for (const [label, fn] of P.useActions(it)) html += btn(label, fn);
      html += '</div>';
    }
    html += '</div>';
    // suelo
    html += '<div class="col"><h3>En el suelo, cerca</h3>';
    if (!near.length) html += '<div class="row"><i>Nada a tu alcance.</i></div>';
    for (const g of near) html += `<div class="row"><span class="name">${G.itemLabel(g.item)}</span>${btn('Coger', () => P.pickUp(g))}</div>`;
    html += '<h3>Fabricar</h3>';
    for (const r of P.recipes()) html += `<div class="row"><span class="name">${r.name}<small>${r.need}</small></span>${btn('Hacer', () => { r.fn(); }, !r.ok)}</div>`;
    html += '</div></div>';
    U.el.inv.innerHTML = html;
  };
  function onInvClick(e) {
    const b = e.target.closest('button[data-h]');
    if (!b) return;
    const fn = handlers[+b.dataset.h];
    if (fn) fn();
    setTimeout(() => U.renderInv(true), 0);
  }

  // ---- Mapa ----
  let mapCanvas;
  function buildMapCanvas() {
    const W = G.world, S = 800;
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = mapCanvas.height = S;
    const ctx = mapCanvas.getContext('2d');
    const img = ctx.createImageData(S, S);
    const scale = W.SIZE / S;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = -W.HALF + px * scale, z = -W.HALF + py * scale;
      const h = W.terrainHeight(x, z);
      let r, g, b;
      if (h < 0) { const d = G.clamp(-h / 14, 0, 1); r = 150 - d * 60; g = 190 - d * 60; b = 210 - d * 40; }
      else if (h < 2) { r = 222; g = 210; b = 170; }
      else {
        const f = W.forestDensity(x, z) > 0.08;
        const shade = G.clamp(1 - h / 220, 0.55, 1);
        r = (f ? 150 : 205) * shade; g = (f ? 185 : 215) * shade; b = (f ? 130 : 160) * shade;
        const c = Math.floor(h / 10) !== Math.floor(W.terrainHeight(x + scale, z) / 10) || Math.floor(h / 10) !== Math.floor(W.terrainHeight(x, z + scale) / 10);
        if (c) { r *= 0.8; g *= 0.75; b *= 0.7; }
      }
      const k = (py * S + px) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const toPx = (v) => (v + W.HALF) / scale;
    ctx.strokeStyle = '#8a6a50'; ctx.lineWidth = 2.5;
    for (const r of W.roads) { ctx.beginPath(); ctx.moveTo(toPx(r[0]), toPx(r[1])); ctx.lineTo(toPx(r[2]), toPx(r[3])); ctx.stroke(); }
    ctx.fillStyle = '#5a3a2a';
    for (const b of W.buildings) ctx.fillRect(toPx(b.minX), toPx(b.minZ), Math.max(2, b.w / scale), Math.max(2, b.d / scale));
    ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
    for (const t of W.towns) {
      ctx.fillStyle = 'rgba(255,255,240,0.75)';
      const tw = ctx.measureText(t.name).width;
      ctx.fillRect(toPx(t.x) - tw / 2 - 3, toPx(t.z) - t.r / scale - 18, tw + 6, 16);
      ctx.fillStyle = t.kind === 'military' ? '#802020' : '#222';
      ctx.fillText(t.name, toPx(t.x), toPx(t.z) - t.r / scale - 6);
    }
    ctx.fillStyle = '#204060'; ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText('Mar del Sur', S / 2, S - 30);
    // rosa de los vientos
    ctx.fillStyle = '#222'; ctx.font = 'bold 18px Georgia'; ctx.fillText('N', S - 40, 40);
    ctx.beginPath(); ctx.moveTo(S - 40, 46); ctx.lineTo(S - 46, 70); ctx.lineTo(S - 34, 70); ctx.fill();
  }
  U.toggleMap = function (force) {
    const want = force !== undefined ? force : !U.mapOpen;
    if (want && !G.player.hasItem('map')) { U.msg('No tengo ningún mapa.'); return; }
    U.mapOpen = want;
    U.el.map.classList.toggle('hidden', !want);
    if (want) { if (U.invOpen) { U.invOpen = false; U.el.inv.classList.add('hidden'); } document.exitPointerLock(); drawMap(); }
    else if (!U.invOpen) G.main.lock();
  };
  function drawMap() {
    const cv = $('map-canvas'), ctx = cv.getContext('2d');
    ctx.drawImage(mapCanvas, 0, 0, cv.width, cv.height);
    const P = G.player, W = G.world, s = cv.width / W.SIZE;
    if (!P.hasItem('gps')) return; // sin GPS, el mapa no dice dónde estás
    const x = (P.pos.x + W.HALF) * s, y = (P.pos.z + W.HALF) * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-P.yaw);
    ctx.fillStyle = '#d02020'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  U.anyOpen = () => U.invOpen || U.mapOpen;
})();
