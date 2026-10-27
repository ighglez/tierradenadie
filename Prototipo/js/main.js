'use strict';
// Arranque, bucle principal, entrada, guardado, muerte y reaparición.
(function () {
  const M = G.main = { target: null };
  const SAVE_KEY = 'tierra_de_nadie_save_v1';
  const HOUR_SECONDS = 120; // 1 hora de juego = 2 minutos reales
  const keys = {};
  let renderer, scene, camera, locked = false, last = performance.now();
  let saveT = 0, targetT = 0, lootT = 0, eye = 1.62;

  G.state = { time: 0, hour: 8, kills: 0, aliveTime: 0, playing: false, paused: false };

  // Calidad: index.html?calidad=baja para equipos modestos
  const LOW = /calidad=baja/.test(location.search);
  G.LOW = LOW;

  function init() {
    renderer = G.renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
    renderer.setPixelRatio(LOW ? 0.75 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !LOW;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.insertBefore(renderer.domElement, document.body.firstChild);
    scene = G.scene = new THREE.Scene();
    camera = G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1200);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    G.world.build(scene);
    G.fx.init(scene);
    G.combat.init(camera);
    G.ui.init();
    G.player.reset();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    setupInput();
    setupMenus();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('menu-buttons').classList.remove('hidden');
    if (localStorage.getItem(SAVE_KEY)) document.getElementById('btn-continue').classList.remove('hidden');
    // vista de fondo del menú
    const P = G.player;
    camera.position.set(P.pos.x, P.pos.y + 1.7, P.pos.z);
    camera.rotation.set(0, P.yaw, 0);
    requestAnimationFrame(loop);
  }

  M.lock = function () {
    if (!G.state.playing || G.player.dead || G.ui.anyOpen()) return;
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  };

  function setupInput() {
    const cv = renderer.domElement;
    cv.addEventListener('click', () => { G.audio.init(); M.lock(); });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === cv;
      if (!locked && G.state.playing && !G.player.dead && !G.ui.anyOpen()) setPaused(true);
      if (!locked) { G.combat.mouseDown = false; G.player.aiming = false; }
    });
    document.addEventListener('mousemove', (e) => {
      if (!locked || G.player.dead || G.player.unconscious) return;
      const P = G.player;
      const sens = 0.0022 * (camera.fov / 75);
      P.yaw -= e.movementX * sens;
      P.pitch = G.clamp(P.pitch - e.movementY * sens, -1.5, 1.5);
    });
    document.addEventListener('mousedown', (e) => { if (locked) G.combat.onMouseDown(e.button); });
    document.addEventListener('mouseup', (e) => G.combat.onMouseUp(e.button));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!G.state.playing || G.state.paused) return;
      if (e.repeat) { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'].includes(e.code)) keys[e.code] = true; return; }
      keys[e.code] = true;
      const P = G.player;
      if (P.dead || P.unconscious) return;
      switch (e.code) {
        case 'Tab': G.ui.toggleInv(); break;
        case 'KeyM': G.ui.toggleMap(); break;
        case 'KeyI': G.ui.toggleInv(); break;
        case 'KeyF': if (M.target && !P.action) M.target.f(); break;
        case 'KeyG': if (M.target && M.target.g && !P.action) M.target.g(); break;
        case 'KeyR': G.combat.reload(); break;
        case 'KeyC': P.setStance('crouch'); break;
        case 'KeyZ': P.setStance('prone'); break;
        case 'CapsLock': P.walk = !P.walk; G.ui.msg(P.walk ? 'Caminando.' : 'Trotando.'); break;
        case 'KeyK': G.ui.peek('compass'); break;
        case 'KeyJ': G.ui.peek('watch'); break;
        case 'KeyH': G.ui.hudAll = !G.ui.hudAll; break;
        case 'KeyL': P.toggleFlash(); break;
        case 'Digit1': P.setHand('shoulder'); break;
        case 'Digit2': P.setHand('belt'); break;
        case 'Digit3': P.setHand('melee'); break;
        case 'KeyX': P.setHand('none'); break;
        case 'Escape': if (G.ui.invOpen) G.ui.toggleInv(false); else if (G.ui.mapOpen) G.ui.toggleMap(false); break;
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    window.addEventListener('beforeunload', () => { if (G.state.playing && !G.player.dead) save(); });
  }

  function setupMenus() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').onclick = () => { G.audio.init(); newGame(); };
    $('btn-continue').onclick = () => { G.audio.init(); if (!loadGame()) newGame(); };
    $('btn-resume').onclick = () => { setPaused(false); M.lock(); };
    $('btn-save-quit').onclick = () => {
      save(); G.state.playing = false; setPaused(false);
      $('menu').classList.remove('hidden');
      $('btn-continue').classList.remove('hidden');
    };
    $('btn-respawn').onclick = () => respawn();
  }

  function setPaused(p) {
    G.state.paused = p;
    document.getElementById('pause').classList.toggle('hidden', !p);
  }

  function startPlaying() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('death').classList.add('hidden');
    G.state.playing = true; setPaused(false);
    G.combat.onHandChanged();
    M.lock();
  }

  function newGame() {
    resetWorldState();
    G.state.time = 0; G.state.hour = 8; G.state.kills = 0; G.state.aliveTime = 0;
    G.player.reset();
    startPlaying();
    G.ui.msg('Te despiertas en la playa. Hace frío y no tienes casi nada.');
    G.ui.msg('Busca un pueblo: allí habrá comida, agua y quizá armas.');
  }

  function resetWorldState() {
    G.ai.clear(); G.loot.clearAll(); G.fx.clear();
  }

  function save() {
    try {
      const data = { player: G.player.serialize(), hour: G.state.hour, kills: G.state.kills, aliveTime: G.state.aliveTime };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* almacenamiento no disponible */ }
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      resetWorldState();
      G.state.time = 0; G.state.hour = d.hour; G.state.kills = d.kills; G.state.aliveTime = d.aliveTime;
      G.player.load(d.player);
      startPlaying();
      G.ui.msg('Partida cargada.');
      return true;
    } catch (e) { console.error(e); return false; }
  }

  M.die = function (cause) {
    const P = G.player;
    if (P.dead) return;
    P.dead = true; P.action = null; P.aiming = false;
    // tu cuerpo deja caer todo lo que llevabas
    const items = [...P.inv, ...P.EQ_SLOTS.map((s) => P.eq[s]).filter(Boolean)];
    items.forEach((it, i) => {
      const a = i / items.length * Math.PI * 2, x = P.pos.x + Math.cos(a) * 0.8, z = P.pos.z + Math.sin(a) * 0.8;
      G.loot.drop(it, x, G.world.groundAt(x, z, P.pos.y), z);
    });
    P.inv = []; for (const s of P.EQ_SLOTS) P.eq[s] = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ }
    document.getElementById('btn-continue').classList.add('hidden');
    G.ui.toggleInv(false); G.ui.toggleMap(false);
    document.exitPointerLock();
    setTimeout(() => {
      document.getElementById('death-info').innerHTML =
        `Causa: <b>${cause}</b><br>Has sobrevivido <b>${G.fmtTime(G.state.aliveTime)}</b> y abatido a <b>${G.state.kills}</b> infectados.<br><br>Tus pertenencias se han quedado donde caíste.`;
      document.getElementById('death').classList.remove('hidden');
    }, 2200);
  };

  function respawn() {
    G.state.kills = 0; G.state.aliveTime = 0;
    G.player.reset();
    startPlaying();
    G.ui.msg('Vuelves a despertar en la costa...');
  }

  // ---- Bucle ----
  function loop(now) {
    requestAnimationFrame(loop);
    if (M.noLoop) return; // pruebas automáticas
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state.playing && !G.state.paused) update(dt);
    else if (!G.state.playing) {
      // cámara lenta en el menú
      camera.rotation.y += dt * 0.03;
      G.world.updateEnv(G.state.hour, camera.position.x, camera.position.z, dt, camera);
    }
    renderer.render(scene, camera);
  }

  function update(dt) {
    const P = G.player, S = G.state;
    S.time += dt;
    S.hour = (S.hour + dt / HOUR_SECONDS) % 24;
    const day = G.world.updateEnv(S.hour, P.pos.x, P.pos.z, dt, camera);
    G.audio.setWind(day < 0.3, G.gfx.weather);
    if (!P.dead) {
      S.aliveTime += dt;
      P.updateMovement(dt, keys);
      P.updateAction(dt);
      P.updateVitals(dt, day);
    }
    G.combat.update(dt);
    G.ai.update(dt, P, day);
    G.fx.update(dt, P.pos.x, P.pos.z);
    lootT -= dt;
    if (lootT <= 0) { lootT = 1; G.loot.update(P.pos.x, P.pos.z); }
    targetT -= dt;
    if (targetT <= 0) { targetT = 0.1; M.target = P.dead ? null : P.findTarget(); }
    // cámara
    eye += (P.eyeHeight() - eye) * Math.min(1, dt * 10);
    if (P.dead) {
      eye = Math.max(0.25, eye - dt * 2);
      camera.rotation.z = Math.min(1.2, camera.rotation.z + dt * 1.5);
    } else camera.rotation.z = -P.lean * 0.18;
    // inclinarse desplaza la cámara a un lado; cojear con una pierna rota
    const limp = P.fracture && !P.morphineT && P.speed > 0.3 ? Math.abs(Math.sin(S.time * 4)) * 0.12 : 0;
    camera.position.set(P.pos.x + Math.cos(P.yaw) * P.lean * 0.45, P.pos.y + eye - Math.abs(P.lean) * 0.08 - limp, P.pos.z - Math.sin(P.yaw) * P.lean * 0.45);
    camera.rotation.x = P.pitch + P.swayY; camera.rotation.y = P.yaw + P.swayX;
    G.ui.update(dt);
    saveT += dt;
    if (saveT > 30 && !P.dead) { saveT = 0; save(); }
  }

  M.keys = keys;
  M.step = function (secs) { for (let t = 0; t < secs; t += 1 / 30) update(1 / 30); }; // útil para pruebas automáticas
  window.addEventListener('load', () => setTimeout(init, 30));
})();
