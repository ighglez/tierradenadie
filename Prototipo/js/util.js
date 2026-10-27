'use strict';
// Utilidades compartidas: ruido procedural, aleatorio con semilla y matemáticas.
const G = window.G = {};

G.SEED = 1337;

G.mulberry32 = function (a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
G.wrand = G.mulberry32(G.SEED); // aleatorio determinista para generar el mundo

G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.smoothstep = (e0, e1, x) => {
  const t = G.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
G.dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
G.randRange = (a, b) => a + Math.random() * (b - a);

function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + G.SEED * 1013;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// Ruido de valor 2D en [-1, 1]
G.noise2 = function (x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
};

G.fbm = function (x, z, oct) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += G.noise2(x * f + i * 17.3, z * f - i * 9.1) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
};

G.ridge = function (x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) {
    s += (1 - Math.abs(G.noise2(x * f + 31, z * f + 77))) * amp;
    amp *= 0.5; f *= 2.1;
  }
  return s;
};

// Intersección rayo-AABB (método de slabs). Devuelve distancia o -1.
G.rayAABB = function (ox, oy, oz, dx, dy, dz, b, maxD) {
  let tmin = 0, tmax = maxD;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return -1;
    } else {
      let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
};

// Intersección rayo-esfera. Devuelve distancia o -1.
G.raySphere = function (ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  return tca - Math.sqrt(r * r - d2);
};

G.fmtTime = function (secs) {
  const m = Math.floor(secs / 60), h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} min` : `${m} min ${Math.floor(secs % 60)} s`;
};
