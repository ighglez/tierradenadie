'use strict';
// Gráficos realistas: texturas procedurales, cielo con nubes, hierba, lluvia y clima.
(function () {
  const X = G.gfx = {};

  // ---- Ruido periódico (texturas que repiten sin costuras) ----
  function phash(ix, iy, P, seed) {
    ix = ((ix % P) + P) % P; iy = ((iy % P) + P) % P;
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed * 977;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function tnoise(x, y, P, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = phash(ix, iy, P, seed), b = phash(ix + 1, iy, P, seed), c = phash(ix, iy + 1, P, seed), d = phash(ix + 1, iy + 1, P, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function tfbm(x, y, P, oct, seed) {
    let s = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) { s += tnoise(x, y, P, seed + i) * a; n += a; x *= 2; y *= 2; P *= 2; a *= 0.5; }
    return s / n;
  }
  function makeTex(size, fn, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    fn(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (repeat) t.repeat.set(repeat, repeat);
    return t;
  }
  function makeTexWH(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  // Los píxeles transparentes toman un color medio (evita bordes negros con mipmaps)
  function bleed(ctx, w, h, rgb) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 128) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 0; } else d[i + 3] = 255;
    ctx.putImageData(img, 0, 0);
  }
  // Rellena con ruido en gris: fn(u,v) -> 0..1
  function noiseFill(ctx, size, fn) {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = G.clamp(fn(x / size, y / size), 0, 1) * 255, k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const rnd = G.mulberry32(99);

  X.makeTextures = function () {
    const T = X.tex = {};
    // detalle del suelo: hierba corta, tierra y piedrecitas (tonos claros, se multiplica por el color del terreno)
    T.ground = makeTex(512, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => 0.78 + (tfbm(u * 8, v * 8, 8, 5, 1) - 0.5) * 0.5);
      for (let k = 0; k < 9000; k++) {
        const x = rnd() * s, y = rnd() * s, l = 3 + rnd() * 9, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
        const g = 150 + rnd() * 105;
        ctx.strokeStyle = `rgba(${g},${g},${g},${0.25 + rnd() * 0.35})`;
        ctx.lineWidth = 0.6 + rnd();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      for (let k = 0; k < 500; k++) {
        const g = 90 + rnd() * 80;
        ctx.fillStyle = `rgba(${g},${g * 0.95},${g * 0.9},0.5)`;
        ctx.beginPath(); ctx.arc(rnd() * s, rnd() * s, 0.5 + rnd() * 1.5, 0, 7); ctx.fill();
      }
    });
    // hojas de hierba (con transparencia)
    T.grass = makeTex(256, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.globalAlpha = 1;
      for (let k = 0; k < 70; k++) {
        const x = 8 + rnd() * (s - 16), h = s * (0.45 + rnd() * 0.55), w = 2 + rnd() * 3.5, bend = (rnd() - 0.5) * 40;
        const dry = rnd() < 0.25;
        const g = 140 + rnd() * 100;
        ctx.fillStyle = dry ? `rgb(${g},${g * 0.92},${g * 0.6})` : `rgb(${g * 0.75},${g},${g * 0.55})`;
        ctx.beginPath();
        ctx.moveTo(x - w, s);
        ctx.quadraticCurveTo(x + bend * 0.3, s - h * 0.6, x + bend, s - h);
        ctx.quadraticCurveTo(x + bend * 0.3 + w * 0.3, s - h * 0.6, x + w, s);
        ctx.fill();
      }
      // espigas
      for (let k = 0; k < 8; k++) {
        const x = 20 + rnd() * (s - 40), y = s * (0.05 + rnd() * 0.3);
        ctx.fillStyle = 'rgb(200,190,140)';
        ctx.beginPath(); ctx.ellipse(x, y, 3, 10, (rnd() - 0.5) * 0.6, 0, 7); ctx.fill();
        ctx.fillRect(x - 0.7, y, 1.4, s * 0.35);
      }
      bleed(ctx, s, s, [120, 150, 80]);
    });
    T.grass.wrapS = T.grass.wrapT = THREE.ClampToEdgeWrapping;
    // abeto en tarjeta: ramas caídas con agujas (con transparencia)
    T.pine = makeTexWH(256, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const top = h * 0.03, cx = w / 2;
      ctx.strokeStyle = 'rgb(70,52,38)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(cx, top + 20); ctx.stroke();
      for (let y = top + 6; y < h * 0.86; y += 3 + rnd() * 3) {
        const t = (y - top) / (h * 0.86 - top);
        const half = (0.06 + t * 0.4) * w * (0.75 + rnd() * 0.4);
        for (const side of [-1, 1]) {
          if (rnd() < 0.12) continue;
          const ex = cx + side * half, ey = y + half * (0.25 + rnd() * 0.2);
          ctx.strokeStyle = 'rgb(45,40,30)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + side * half * 0.5, y - 3, ex, ey); ctx.stroke();
          const n = Math.floor(half / 2.2);
          for (let k = 0; k < n; k++) {
            const f = k / n, bx = cx + side * half * f, by = y + (ey - y) * f * f - 2 + rnd() * 4;
            const L = 4 + rnd() * 6 * (1 - f * 0.4), g = 0.65 + rnd() * 0.5 + (side < 0 ? 0.1 : -0.05) - t * 0.15;
            ctx.strokeStyle = `rgb(${Math.floor(34 * g)},${Math.floor(62 * g)},${Math.floor(38 * g)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + side * L * 0.5 + (rnd() - 0.5) * 3, by + L * (0.5 + rnd() * 0.6)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + side * L * 0.4, by - L * 0.4); ctx.stroke();
          }
        }
      }
      bleed(ctx, w, h, [30, 50, 32]);
    });
    // frondoso en tarjeta: copa de hojas en grises (se tiñe por instancia)
    T.leafy = makeTexWH(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      ctx.strokeStyle = 'rgb(90,85,78)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(cx + 4, h * 0.45); ctx.stroke();
      ctx.lineWidth = 4;
      for (let k = 0; k < 6; k++) { const y = h * (0.5 + rnd() * 0.25); ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + (rnd() - 0.5) * 220, y - 60 - rnd() * 80); ctx.stroke(); }
      const clusters = [];
      for (let k = 0; k < 30; k++) {
        const a = rnd() * 6.28, r = Math.sqrt(rnd());
        clusters.push([cx + Math.cos(a) * r * w * 0.36, h * 0.38 + Math.sin(a) * r * h * 0.28, 25 + rnd() * 35]);
      }
      for (let k = 0; k < 14000; k++) {
        const c = clusters[Math.floor(rnd() * clusters.length)];
        const a = rnd() * 6.28, r = Math.sqrt(rnd()) * c[2];
        const x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r;
        const light = 0.55 + (1 - (y - c[1] + c[2]) / (2 * c[2])) * 0.35 + (rnd() - 0.5) * 0.3 - (y / h) * 0.2;
        const v = Math.floor(G.clamp(light, 0.2, 1) * 235);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.beginPath(); ctx.ellipse(x, y, 2 + rnd() * 2.5, 1.2 + rnd() * 1.5, rnd() * 3, 0, 7); ctx.fill();
      }
      bleed(ctx, w, h, [150, 150, 150]);
    });
    // corteza
    T.bark = makeTex(256, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => 0.6 + (tfbm(u * 24, v * 3, 3, 4, 7) - 0.5) * 0.9);
      for (let k = 0; k < 140; k++) {
        const x = rnd() * s, g = 40 + rnd() * 60;
        ctx.fillStyle = `rgba(${g},${g},${g},0.5)`; ctx.fillRect(x, rnd() * s, 1 + rnd() * 2, 10 + rnd() * 50);
      }
    });
    // copa de árboles: manchas de hojas o agujas
    T.leaves = makeTex(256, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => {
        const n = tfbm(u * 16, v * 16, 16, 4, 11);
        return 0.35 + n * 0.9 - (tnoise(u * 64, v * 64, 64, 13) > 0.72 ? 0.3 : 0);
      });
    });
    // revoque de paredes con manchas de humedad
    T.plaster = makeTex(512, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => {
        let c = 0.86 + (tfbm(u * 6, v * 6, 6, 5, 21) - 0.5) * 0.35;
        c -= Math.max(0, tfbm(u * 3, v * 20, 3, 3, 23) - 0.55) * 0.9 * (0.3 + v); // chorretones
        c -= G.smoothstep(0.7, 1, v) * 0.25 * tfbm(u * 12, v * 4, 12, 3, 29); // suciedad abajo
        return c;
      });
      for (let k = 0; k < 40; k++) { // desconchones
        const g = 120 + rnd() * 50;
        ctx.fillStyle = `rgba(${g},${g * 0.9},${g * 0.8},0.6)`;
        ctx.beginPath(); ctx.ellipse(rnd() * s, rnd() * s, 3 + rnd() * 14, 2 + rnd() * 8, rnd() * 3, 0, 7); ctx.fill();
      }
    });
    // tablones de madera
    T.planks = makeTex(256, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => 0.7 + (tfbm(u * 2, v * 30, 2, 4, 31) - 0.5) * 0.6);
      ctx.fillStyle = 'rgba(20,15,10,0.6)';
      for (let k = 0; k < 8; k++) ctx.fillRect(k * s / 8, 0, 2, s);
    });
    // chapa ondulada con óxido
    T.roof = makeTex(256, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => 0.62 + Math.sin(u * Math.PI * 2 * 24) * 0.12 + (tfbm(u * 5, v * 5, 5, 4, 41) - 0.5) * 0.45);
      for (let k = 0; k < 30; k++) {
        ctx.fillStyle = `rgba(${110 + rnd() * 40},${60 + rnd() * 20},30,0.35)`;
        ctx.beginPath(); ctx.ellipse(rnd() * s, rnd() * s, 4 + rnd() * 20, 3 + rnd() * 12, 0, 0, 7); ctx.fill();
      }
    });
    // asfalto / tierra batida
    T.dirt = makeTex(256, (ctx, s) => noiseFill(ctx, s, (u, v) => 0.7 + (tfbm(u * 10, v * 10, 10, 5, 51) - 0.5) * 0.5));
    // tela sucia (ropa de infectados)
    T.cloth = makeTex(128, (ctx, s) => {
      noiseFill(ctx, s, (u, v) => 0.75 + (tfbm(u * 8, v * 8, 8, 4, 61) - 0.5) * 0.6);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(60,10,10,${0.3 + rnd() * 0.4})`;
        ctx.beginPath(); ctx.ellipse(rnd() * s, rnd() * s, 3 + rnd() * 10, 3 + rnd() * 8, 0, 0, 7); ctx.fill();
      }
    });
    T.skin = makeTex(128, (ctx, s) => noiseFill(ctx, s, (u, v) => 0.8 + (tfbm(u * 10, v * 10, 10, 4, 71) - 0.5) * 0.4));
    return T;
  };

  // ---- Cielo con nubes (shader) ----
  X.makeSky = function (scene) {
    const uni = {
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() }, cover: { value: 0.5 }, time: { value: 0 },
      cloudLit: { value: new THREE.Color() }, cloudDark: { value: new THREE.Color() }, sunVis: { value: 1 }, fogAmt: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 sunDir, zenith, horizon, sunColor, cloudLit, cloudDark; uniform float cover, time, sunVis, fogAmt;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a*noise(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.45));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 900.0) * 6.0 * sunVis + pow(sd, 10.0) * 0.18 + pow(sd, 3.0) * 0.06);
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.3) * 2.2 + vec2(time * 0.006, time * 0.003);
            float n = fbm(uv);
            float c = smoothstep(1.02 - cover * 0.75 - 0.18, 1.02 - cover * 0.75 + 0.22, n);
            float shade = fbm(uv + sunDir.xz * 0.12);
            float dark = clamp((shade - n) * 4.0 + 0.35 + cover * 0.45, 0.0, 1.0);
            vec3 cc = mix(cloudLit, cloudDark, dark);
            cc += sunColor * pow(sd, 5.0) * 0.35 * (1.0 - dark);
            col = mix(col, cc, c * smoothstep(0.03, 0.3, d.y));
          } else col = horizon;
          col = mix(col, horizon, (0.35 + fogAmt * 0.65) * (1.0 - smoothstep(0.0, 0.08 + fogAmt * 0.4, d.y)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    dome.renderOrder = -10; dome.frustumCulled = false;
    scene.add(dome);
    X.sky = { dome, uni };
  };

  // ---- Hierba alrededor del jugador ----
  const GRASS_R = 42, GRASS_CELL = 0.85;
  X.makeGrass = function (scene) {
    // tres planos cruzados por mata
    const pos = [], uv = [], nor = [], idx = [];
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
      pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let q = 0; q < 4; q++) nor.push(0, 1, 0); // normales hacia arriba: iluminación uniforme
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2); // cara trasera con la misma normal (sin lados oscuros)
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshLambertMaterial({ map: X.tex.grass, alphaTest: 0.45 });
    const uTime = { value: 0 }, uWind = { value: 0.4 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.2) * 0.6 + sin(uTime * 3.1 + ip.z * 0.7) * 0.25;
        transformed.x += sway * uWind * 0.18 * uv.y * uv.y;
        transformed.z += sway * uWind * 0.08 * uv.y * uv.y;`);
    };
    const max = Math.ceil(Math.PI * GRASS_R * GRASS_R / (GRASS_CELL * GRASS_CELL) * 1.05);
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    X.grass = { mesh, uTime, uWind, cx: 1e9, cz: 1e9, max };
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  };
  function cellHash(i, j, s) {
    let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(s, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rebuildGrass(px, pz) {
    const W = G.world, g = X.grass, m = g.mesh, d = new THREE.Object3D(), col = new THREE.Color();
    const i0 = Math.floor((px - GRASS_R) / GRASS_CELL), i1 = Math.ceil((px + GRASS_R) / GRASS_CELL);
    const j0 = Math.floor((pz - GRASS_R) / GRASS_CELL), j1 = Math.ceil((pz + GRASS_R) / GRASS_CELL);
    let n = 0;
    const nearRoads = W.roads.filter((r) => Math.min(r[0], r[2]) - 60 < px && Math.max(r[0], r[2]) + 60 > px && Math.min(r[1], r[3]) - 60 < pz && Math.max(r[1], r[3]) + 60 > pz);
    const nearB = W.buildings.filter((b) => Math.abs(b.cx - px) < GRASS_R + 15 && Math.abs(b.cz - pz) < GRASS_R + 15);
    for (let i = i0; i <= i1 && n < g.max; i++) for (let j = j0; j <= j1 && n < g.max; j++) {
      const x = (i + cellHash(i, j, 1)) * GRASS_CELL, z = (j + cellHash(i, j, 2)) * GRASS_CELL;
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz > GRASS_R * GRASS_R) continue;
      const h = W.terrainHeight(x, z);
      if (h < 1.2) continue;
      const forest = W.forestDensity(x, z);
      const keep = forest > 0.08 ? 0.3 : 0.92;
      if (cellHash(i, j, 3) > keep) continue;
      let blocked = false;
      for (const b of nearB) if (x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6) { blocked = true; break; }
      if (blocked) continue;
      for (const r of nearRoads) {
        const vx = r[2] - r[0], vz = r[3] - r[1], t = G.clamp(((x - r[0]) * vx + (z - r[1]) * vz) / (vx * vx + vz * vz), 0, 1);
        if (Math.hypot(x - r[0] - vx * t, z - r[1] - vz * t) < 3.2) { blocked = true; break; }
      }
      if (blocked) continue;
      const town = W.inTown(x, z, 0);
      const tall = (G.noise2(x * 0.03, z * 0.03) * 0.5 + 0.6) * (town ? 0.55 : 1) * (forest > 0.08 ? 0.7 : 1);
      const s = 0.6 + cellHash(i, j, 4) * 0.5;
      d.position.set(x, h - 0.05, z);
      d.rotation.set(0, cellHash(i, j, 5) * 6.28, 0);
      d.scale.set(s * 1.1, s * G.clamp(tall, 0.35, 1.25), s * 1.1);
      d.updateMatrix();
      m.setMatrixAt(n, d.matrix);
      const dry = G.noise2(x * 0.02 + 40, z * 0.02) * 0.5 + 0.5;
      col.setRGB(0.42 + dry * 0.26 + cellHash(i, j, 6) * 0.08, 0.56 + dry * 0.08, 0.32 + dry * 0.04);
      m.setColorAt(n, col);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    g.cx = px; g.cz = pz;
  }

  // ---- Lluvia ----
  const RAIN_N = 4000, RAIN_BOX = 30;
  X.makeRain = function (scene) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(RAIN_N * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xaab4bc, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    scene.add(lines);
    const drops = [];
    for (let k = 0; k < RAIN_N; k++) drops.push({ x: 0, y: -999, z: 0, v: 14 + Math.random() * 6 });
    X.rain = { lines, drops, p };
  };
  function updateRain(dt, cam, intensity) {
    const R = X.rain, W = G.world;
    R.lines.visible = intensity > 0.02;
    if (!R.lines.visible) return;
    R.lines.material.opacity = 0.35 * intensity;
    const active = Math.floor(RAIN_N * intensity);
    const windX = 1.5, len = 0.45;
    for (let k = 0; k < RAIN_N; k++) {
      const d = R.drops[k], o = k * 6;
      if (k >= active) { R.p[o + 1] = R.p[o + 4] = -9999; continue; }
      d.y -= d.v * dt; d.x += windX * dt;
      if (d.y < cam.position.y - 12 || Math.abs(d.x - cam.position.x) > RAIN_BOX || Math.abs(d.z - cam.position.z) > RAIN_BOX) {
        d.x = cam.position.x + (Math.random() - 0.5) * 2 * RAIN_BOX;
        d.z = cam.position.z + (Math.random() - 0.5) * 2 * RAIN_BOX;
        d.y = cam.position.y + 4 + Math.random() * 16;
        if (W.insideBuilding(d.x, d.z)) d.y = -9999; // no llueve bajo techo
      }
      R.p[o] = d.x; R.p[o + 1] = d.y; R.p[o + 2] = d.z;
      R.p[o + 3] = d.x - windX * 0.03; R.p[o + 4] = d.y + len; R.p[o + 5] = d.z;
    }
    R.lines.geometry.attributes.position.needsUpdate = true;
  }

  // ---- Clima ----
  // Cada tipo: nubosidad, lluvia, niebla (0..1), viento
  const WEATHERS = {
    despejado: { cover: 0.25, rain: 0, fog: 0.05, wind: 0.3 },
    nuboso: { cover: 0.6, rain: 0, fog: 0.15, wind: 0.5 },
    cubierto: { cover: 0.88, rain: 0, fog: 0.3, wind: 0.6 },
    lluvia: { cover: 0.97, rain: 0.7, fog: 0.45, wind: 0.9 },
    tormenta: { cover: 1.0, rain: 1.0, fog: 0.55, wind: 1.3 },
    niebla: { cover: 0.75, rain: 0, fog: 0.95, wind: 0.15 },
  };
  X.weather = { name: 'nuboso', cover: 0.6, rain: 0, fog: 0.15, wind: 0.5, nextChange: 0 };
  function pickWeather() {
    const r = Math.random();
    return r < 0.22 ? 'despejado' : r < 0.47 ? 'nuboso' : r < 0.65 ? 'cubierto' : r < 0.82 ? 'lluvia' : r < 0.9 ? 'tormenta' : 'niebla';
  }
  X.setWeather = function (name, instant) {
    X.weather.name = name;
    if (instant) Object.assign(X.weather, WEATHERS[name]);
  };
  function updateWeather(dt) {
    const w = X.weather, t = WEATHERS[w.name], now = G.state.time;
    if (now > w.nextChange) { w.nextChange = now + 300 + Math.random() * 600; X.setWeather(pickWeather()); }
    const k = Math.min(1, dt * 0.02);
    for (const p of ['cover', 'rain', 'fog', 'wind']) w[p] += (t[p] - w[p]) * k;
  }

  X.init = function (scene) {
    X.makeTextures();
    X.makeSky(scene);
    X.makeGrass(scene);
    X.makeRain(scene);
  };

  // Colores del cielo según hora y clima
  const C = (h) => new THREE.Color(h);
  const SKY = {
    dayZen: C(0x5d84b4), dayHor: C(0xb9c6cf), duskZen: C(0x3a4a6a), duskHor: C(0xd29a6a),
    nightZen: C(0x03050a), nightHor: C(0x0b1018), overZen: C(0x8a949c), overHor: C(0xa9b1b6),
  };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  X.update = function (dt, cam, sunDirVec, day, dusk) {
    updateWeather(dt);
    const w = X.weather, u = X.sky.uni;
    X.sky.dome.position.copy(cam.position);
    u.time.value += dt;
    u.sunDir.value.copy(sunDirVec);
    u.cover.value = w.cover;
    u.sunVis.value = G.clamp(1.2 - w.cover, 0, 1);
    // cenit y horizonte
    const zen = tmpA.copy(SKY.nightZen).lerp(SKY.dayZen, day).lerp(SKY.duskZen, dusk * 0.5);
    const hor = tmpB.copy(SKY.nightHor).lerp(SKY.dayHor, day).lerp(SKY.duskHor, dusk * 0.55);
    const overcast = G.clamp((w.cover - 0.5) * 1.6 + w.fog * 0.5, 0, 1) * day;
    zen.lerp(SKY.overZen.clone().multiplyScalar(0.4 + 0.6 * day), overcast * 0.85);
    hor.lerp(SKY.overHor.clone().multiplyScalar(0.4 + 0.6 * day), overcast * 0.8);
    u.zenith.value.copy(zen); u.horizon.value.copy(hor);
    u.sunColor.value.setRGB(1, 0.85 + 0.15 * day, 0.65 + 0.3 * day).multiplyScalar(day * (1 - w.cover * 0.6) + dusk * 0.3);
    u.cloudLit.value.setRGB(0.95, 0.94, 0.92).multiplyScalar(0.08 + 0.92 * day).lerp(new THREE.Color(0.9, 0.62, 0.45), dusk * 0.4);
    u.cloudDark.value.setRGB(0.42, 0.45, 0.5).multiplyScalar(0.06 + 0.94 * day * (1 - w.rain * 0.35));
    // niebla (densa con niebla, lluvia y de noche)
    const fogAmt = G.clamp(w.fog + w.rain * 0.2, 0, 1);
    u.fogAmt.value = fogAmt;
    G.scene.fog.color.copy(hor);
    G.scene.fog.near = G.lerp(G.lerp(8, 40, day), 2, fogAmt);
    G.scene.fog.far = G.lerp(G.lerp(110, 650, day), G.lerp(60, 120, day), fogAmt);
    // hierba
    const P = G.player;
    if (Math.hypot(P.pos.x - X.grass.cx, P.pos.z - X.grass.cz) > 7) rebuildGrass(P.pos.x, P.pos.z);
    X.grass.uTime.value += dt;
    X.grass.uWind.value = w.wind;
    updateRain(dt, cam, w.rain);
    return { cover: w.cover, rain: w.rain, fog: fogAmt };
  };
  X.resetGrass = () => { if (X.grass) X.grass.cx = 1e9; };
})();
