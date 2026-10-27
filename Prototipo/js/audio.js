'use strict';
// Sonido sintetizado con WebAudio (sin archivos externos).
(function () {
  const A = G.audio = { ctx: null };
  let master, noiseBuf;

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain(); master.gain.value = 0.6; master.connect(A.ctx.destination);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // viento de fondo
    const wind = A.ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    A.windGain = A.ctx.createGain(); A.windGain.gain.value = 0.05;
    wind.connect(lp); lp.connect(A.windGain); A.windGain.connect(master); wind.start();
    A.windFilter = lp;
  };

  // Volumen y paneo según la posición relativa al oyente.
  function spatial(pos) {
    if (!pos || !G.player) return { vol: 1, pan: 0 };
    const p = G.player.pos;
    const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz);
    const yaw = G.player.yaw;
    const rx = Math.cos(yaw) * dx - Math.sin(yaw) * dz; // derecha del jugador
    return { vol: 1 / (1 + d * d / 400), pan: G.clamp(rx / (d + 1), -1, 1), d };
  }
  function out(vol, pan) {
    const g = A.ctx.createGain(); g.gain.value = vol;
    if (A.ctx.createStereoPanner) {
      const p = A.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master);
    } else g.connect(master);
    return g;
  }

  function noiseBurst(vol, pan, freq, dur, type = 'lowpass', q = 0.7) {
    const t = A.ctx.currentTime;
    const s = A.ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = A.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out(1, pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(vol, pan, f0, f1, dur, type = 'sine') {
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out(1, pan)); o.start(t); o.stop(t + dur + 0.05);
  }

  A.shot = function (weaponId, pos) {
    if (!A.ctx) return;
    const s = pos ? spatial(pos) : { vol: 1, pan: 0 };
    const p = { pistol: [1.0, 1800, 0.35], shotgun: [1.4, 900, 0.6], rifle: [1.6, 1200, 0.9], ar: [1.1, 1500, 0.4] }[weaponId] || [1, 1500, 0.4];
    noiseBurst(p[0] * Math.max(s.vol, 0.15), s.pan, p[1], p[2]);
    tone(0.5 * s.vol, s.pan, 140, 40, 0.25, 'triangle');
  };
  A.dryFire = () => A.ctx && tone(0.2, 0, 1800, 1200, 0.05, 'square');
  A.reload = () => { if (!A.ctx) return; tone(0.15, 0, 900, 600, 0.06, 'square'); setTimeout(() => tone(0.15, 0, 700, 1000, 0.06, 'square'), 350); };
  A.swing = () => A.ctx && noiseBurst(0.25, 0, 2500, 0.15, 'bandpass', 2);
  A.hit = (pos) => { if (!A.ctx) return; const s = spatial(pos); noiseBurst(0.6 * s.vol, s.pan, 400, 0.15); tone(0.4 * s.vol, s.pan, 120, 60, 0.12); };
  A.hurt = () => { if (!A.ctx) return; tone(0.4, 0, 300, 150, 0.3, 'sawtooth'); noiseBurst(0.4, 0, 600, 0.2); };
  A.pickup = () => A.ctx && tone(0.15, 0, 600, 900, 0.08, 'triangle');
  A.step = (vol) => A.ctx && noiseBurst(0.06 * vol, (Math.random() - 0.5) * 0.3, 700, 0.08);
  A.eat = () => { if (!A.ctx) return; for (let i = 0; i < 3; i++) setTimeout(() => noiseBurst(0.15, 0, 1200, 0.07, 'bandpass', 3), i * 220); };
  A.drink = () => { if (!A.ctx) return; for (let i = 0; i < 3; i++) setTimeout(() => tone(0.12, 0, 300, 500, 0.12), i * 300); };
  A.groan = function (pos, aggressive) {
    if (!A.ctx) return;
    const s = spatial(pos);
    if (s.vol < 0.01) return;
    const f = aggressive ? 160 + Math.random() * 80 : 90 + Math.random() * 50;
    tone(0.35 * s.vol, s.pan, f, f * (aggressive ? 0.6 : 0.8), aggressive ? 0.6 : 1.1, 'sawtooth');
    noiseBurst(0.12 * s.vol, s.pan, f * 3, 0.5, 'bandpass', 4);
  };
  A.fire = (pos) => { if (!A.ctx) return; const s = spatial(pos); if (Math.random() < 0.3) noiseBurst(0.08 * s.vol, s.pan, 3000, 0.04, 'highpass'); };
  A.setWind = (night, wx) => {
    if (!A.windGain) return;
    A.windGain.gain.value = (night ? 0.06 : 0.04) + (wx ? wx.wind * 0.04 : 0);
    if (!A.rainGain) {
      const r = A.ctx.createBufferSource(); r.buffer = noiseBuf; r.loop = true;
      const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.4;
      A.rainGain = A.ctx.createGain(); A.rainGain.gain.value = 0;
      r.connect(f); f.connect(A.rainGain); A.rainGain.connect(master); r.start();
    }
    const inside = G.player && G.player.inside;
    A.rainGain.gain.value = (wx ? wx.rain : 0) * (inside ? 0.05 : 0.14);
  };
  A.breath = () => { if (!A.ctx) return; noiseBurst(0.12, 0, 900, 0.5, 'bandpass', 1.5); };
  A.cough = () => { if (!A.ctx) return; for (let i = 0; i < 2; i++) setTimeout(() => { noiseBurst(0.45, 0, 500, 0.18, 'bandpass', 1.2); tone(0.2, 0, 220, 140, 0.15, 'sawtooth'); }, i * 260); };
  A.vomit = () => { if (!A.ctx) return; noiseBurst(0.4, 0, 300, 0.8, 'lowpass'); tone(0.25, 0, 160, 90, 0.7, 'sawtooth'); };
})();
