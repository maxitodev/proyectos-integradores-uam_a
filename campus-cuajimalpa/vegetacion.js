// vegetacion.js · Vegetación, relieve y vida para el visor del campus (three.js r160).
// Sólo importa 'three' (cabe en el importmap y en build.mjs). Unidades: metros.
// Todo es determinista (PRNG con semilla): el GLB y el PNG salen iguales en cada guardado.
// Árboles: origen en la base del tronco. Autos y personas: origen en el piso, frente hacia +Z local.
import * as THREE from 'three';

// ───────────────────────── Ajustes ─────────────────────────
export const CONFIG = {
  maxTriangulosArbol: 600,   // tope duro por árbol (copa + tronco + ramas)
  variantes: {fresno: 3, jacaranda: 3, pino: 2, cedro: 2, arbusto: 2, palmera: 1}, // geometrías distintas por especie (se comparten; cada una pesa ~9 KB en el GLB)
  copaRecibeSombra: true,    // las copas reciben la sombra del sol (da volumen)
  pesosTipo: {fresno: .40, jacaranda: .28, pino: .08, cedro: .08, arbusto: .14},   // mezcla cuando no se indica tipo
  floracionJacaranda: 0      // probabilidad (0..1) de jacaranda en flor (lila) cuando no se pasa 'floracion'
};
export const TIPOS_ARBOL = ['fresno', 'jacaranda', 'pino', 'cedro', 'arbusto', 'palmera'];

// ───────────────────────── Utilidades ─────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
function hash32(v) { // admite números (también flotantes) y cadenas
  const s = typeof v === 'string' ? v : String(Math.round(Number(v) * 1000));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
}
// PRNG mulberry32 con semilla (número o texto). Devuelve una función () => [0,1).
export function prng(semilla = 1) {
  let a = hash32(semilla) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const elige = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const lin = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }; // sRGB -> lineal (colores de vértice)

// Materiales compartidos: un Map por clave (color). Nunca llevan userData.disposeMaterial.
const MATS = new Map();
function matCache(clave, fabrica) {
  let m = MATS.get(clave);
  if (!m) { m = fabrica(); m.name = clave; MATS.set(clave, m); }
  return m;
}
const matCopa = c => matCache('Copa_' + c, () => new THREE.MeshStandardMaterial({color: c, roughness: .92, metalness: 0, vertexColors: true}));
const matTronco = c => matCache('Tronco_' + c, () => new THREE.MeshStandardMaterial({color: c, roughness: .97, metalness: 0, vertexColors: true}));
const matPalma = c => matCache('Palma_' + c, () => new THREE.MeshStandardMaterial({color: c, roughness: .9, metalness: 0, vertexColors: true, side: THREE.DoubleSide}));
const matSimple = (c, rug = .85) => matCache('Simple_' + c + '_' + rug, () => new THREE.MeshStandardMaterial({color: c, roughness: rug, metalness: 0}));
export const materialesCompartidos = () => [...MATS.values()];

// ───────────────────────── Constructor de mallas ─────────────────────────
// Acumula posiciones, colores de vértice e índices. tri() orienta cada cara hacia fuera del punto 'ref'.
class Malla {
  constructor() { this.p = []; this.c = []; this.i = []; }
  get nv() { return this.p.length / 3; }
  get tris() { return this.i.length / 3; }
  v(x, y, z, col = [1, 1, 1]) { this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]); return this.nv - 1; }
  tri(a, b, c, ref) {
    const P = this.p, ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az, vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const d = nx * ((ax + P[3 * b] + P[3 * c]) / 3 - ref[0]) + ny * ((ay + P[3 * b + 1] + P[3 * c + 1]) / 3 - ref[1]) + nz * ((az + P[3 * b + 2] + P[3 * c + 2]) / 3 - ref[2]);
    if (d < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  quad(a, b, c, d, ref) { this.tri(a, b, c, ref); this.tri(a, c, d, ref); }
  tintar(rgb) { for (let k = 0; k < this.c.length; k += 3) { this.c[k] *= rgb[0]; this.c[k + 1] *= rgb[1]; this.c[k + 2] *= rgb[2]; } return this; }
  // Sombreado falso por altura (más oscuro abajo, más claro arriba) con ruido; nunca supera 1 (válido para COLOR_0 de glTF).
  sombrear(rng, min = .55, jit = .1) {
    let y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < this.nv; k++) { const y = this.p[3 * k + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let k = 0; k < this.nv; k++) {
      const t = clamp((this.p[3 * k + 1] - y0) / ((y1 - y0) || 1), 0, 1), s = Math.min(1, lerp(min, .97, Math.pow(t, .8)) * (1 + (rng() - .5) * jit));
      this.c[3 * k] *= s; this.c[3 * k + 1] *= s; this.c[3 * k + 2] *= s;
    }
    return this;
  }
  agregar(o) { const off = this.nv; for (const x of o.p) this.p.push(x); for (const x of o.c) this.c.push(x); for (const k of o.i) this.i.push(k + off); return this; }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

// Icosfera con vértices compartidos (sin grietas al desplazarlos): detalle 0 = 20 caras, detalle 1 = 80 caras.
function crearIco(n) {
  const t = (1 + Math.sqrt(5)) / 2, nm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < n; s++) {
    const cache = new Map(), g = [];
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { v.push(nm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); cache.set(k, v.length - 1); } return cache.get(k); };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); g.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = g;
  }
  return {v, f};
}
const ICO = [crearIco(0), crearIco(1)];
// Mancha de follaje: icosfera escalada y con desplazamiento radial aleatorio por vértice.
function blob(m, c, r, detalle, hue, rng, ruido) {
  const B = ICO[detalle], idx = B.v.map(d => { const k = 1 + ruido * (rng() * 2 - 1); return m.v(c[0] + d[0] * r[0] * k, c[1] + d[1] * r[1] * k, c[2] + d[2] * r[2] * k, hue); });
  for (const f of B.f) m.tri(idx[f[0]], idx[f[1]], idx[f[2]], c);
  return idx;
}
// Tubo cónico por una trayectoria. pts = [x,y,z,radio,(ex),(ez)]; fcol(t) da el color (0..1 a lo largo). tapa cierra el extremo final.
function tubo(m, pts, seg, fcol, tapa = false) {
  const anillos = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const L = Math.hypot(tx, ty, tz) || 1; tx /= L; ty /= L; tz /= L;
    let hx = 0, hy = 1; if (Math.abs(ty) > .9) { hx = 1; hy = 0; }
    const d = hx * tx + hy * ty; let ux = hx - tx * d, uy = hy - ty * d, uz = -tz * d; const lu = Math.hypot(ux, uy, uz); ux /= lu; uy /= lu; uz /= lu;
    const wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux;
    const p = pts[i], ex = p[4] ?? 1, ez = p[5] ?? 1, col = fcol(i / Math.max(1, pts.length - 1)), ring = [];
    for (let j = 0; j < seg; j++) {
      const th = 2 * Math.PI * j / seg, c = Math.cos(th) * p[3], s = Math.sin(th) * p[3];
      ring.push(m.v(p[0] + c * ux * ex + s * wx * ez, p[1] + c * uy * ex + s * wy * ez, p[2] + c * uz * ex + s * wz * ez, col));
    }
    anillos.push(ring);
  }
  for (let i = 0; i < anillos.length - 1; i++) {
    const r0 = anillos[i], r1 = anillos[i + 1], a = pts[i], b = pts[i + 1], ref = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let j = 0; j < seg; j++) { const k = (j + 1) % seg; m.quad(r0[j], r0[k], r1[k], r1[j], ref); }
  }
  if (tapa) {
    const e = pts[pts.length - 1], q = pts[pts.length - 2], last = anillos[anillos.length - 1], c = m.v(e[0], e[1], e[2], fcol(1));
    for (let j = 0; j < seg; j++) m.tri(c, last[j], last[(j + 1) % seg], q);
  }
}
// Esfera UV de pocas caras (cabezas). polar < PI = casquete (cabello).
function esfera(m, c, r, seg, n, col, polar = Math.PI) {
  const full = polar >= Math.PI - 1e-6, top = m.v(c[0], c[1] + r, c[2], col), rings = [], nr = full ? n - 1 : n;
  for (let k = 1; k <= nr; k++) {
    const ph = polar * k / n, y = Math.cos(ph) * r, rr = Math.sin(ph) * r, ring = [];
    for (let j = 0; j < seg; j++) { const th = 2 * Math.PI * j / seg; ring.push(m.v(c[0] + Math.cos(th) * rr, c[1] + y, c[2] + Math.sin(th) * rr, col)); }
    rings.push(ring);
  }
  for (let j = 0; j < seg; j++) m.tri(top, rings[0][j], rings[0][(j + 1) % seg], c);
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < seg; j++) { const q = (j + 1) % seg; m.quad(rings[k][j], rings[k][q], rings[k + 1][q], rings[k + 1][j], c); }
  if (full) { const bot = m.v(c[0], c[1] - r, c[2], col), L = rings[rings.length - 1]; for (let j = 0; j < seg; j++) m.tri(bot, L[j], L[(j + 1) % seg], c); }
}

// ───────────────────────── Árboles ─────────────────────────
// 'copa' es el color base (el más claro); los colores de vértice sólo lo oscurecen o lo desvían (≤ 1), así el GLB
// conserva el aspecto aunque un visor ignore COLOR_0.
const HUE_LATIF = [[1, 1, 1], [.93, 1, .88], [1, .97, .80], [.86, .98, .92], [.96, 1, .90]];
const HUE_CONIF = [[1, 1, 1], [.90, 1, .92], [.95, .98, .90]];
const PAL = {
  fresno: {copa: ['#6a9c58', '#76a863', '#5f9150', '#7db06a'], hue: HUE_LATIF},
  jacaranda: {copa: ['#5f9658', '#6aa261', '#548c52'], flor: ['#b497d9', '#a68bd1', '#bba2de'], hue: HUE_LATIF, hueFlor: [[1, 1, 1], [.95, .90, 1], [.90, .88, .98]]},
  pino: {copa: ['#3d6e47', '#356440', '#447a4e'], hue: HUE_CONIF},
  cedro: {copa: ['#356650', '#2f5c49', '#3d7258'], hue: HUE_CONIF},
  arbusto: {copa: ['#4d8442', '#5b9249', '#437a40'], hue: HUE_LATIF},
  palmera: {copa: ['#5f9140', '#52853a'], hue: [[1, 1, 1], [.88, 1, .82]]},
  tronco: ['#6f5d47', '#7b6850', '#5f5040', '#847560']
};
const colTronco = t => [lerp(.62, 1, t), lerp(.60, .97, t), lerp(.58, .94, t)]; // base más oscura por humedad

// Latifoliadas redondeadas (fresno, jacaranda): 5-7 manchas solapadas, tronco con adelgazamiento y 3 ramas.
function construirLatifoliada(tipo, rng, flor) {
  const jac = tipo === 'jacaranda', H = jac ? 8.2 : 9.2, R = jac ? 3.0 : 2.6, RV = jac ? 2.7 : 3.1, ht = H * (jac ? .38 : .41), r0 = jac ? .33 : .30, r1 = .14, sy = RV / R; // R = radio horizontal de la copa, RV = vertical
  const lean = [(rng() - .5) * .55, (rng() - .5) * .55], pal = PAL[tipo], tronco = new Malla(), copa = new Malla();
  tubo(tronco, [[0, 0, 0, r0 * 1.4], [lean[0] * .3, ht * .16, lean[1] * .3, r0 * 1.08], [lean[0] * .7, ht * .6, lean[1] * .7, r0 * .82], [lean[0], ht * 1.02, lean[1], r1]], 6, colTronco);
  const cx = lean[0], cz = lean[1], cy = ht + R * sy * .62, n = 5 + Math.floor(rng() * 3), bl = [{c: [cx, cy, cz], r: [.66 * R, .60 * R * sy, .66 * R]}];
  for (let k = 1; k < n; k++) {
    const a = (k - 1) / (n - 1) * Math.PI * 2 + rng() * .9, d = R * (.40 + rng() * .30) * (jac ? 1.12 : 1), dy = R * sy * ((rng() - .42) * .55), rr = R * (.46 + rng() * .2);
    bl.push({c: [cx + Math.cos(a) * d, cy + dy, cz + Math.sin(a) * d], r: [rr, rr * sy, rr]});
  }
  if (n >= 6) bl[n - 1] = {c: [cx + (rng() - .5) * R * .5, cy + R * sy * .66, cz + (rng() - .5) * R * .5], r: [.5 * R, .46 * R * sy, .5 * R]}; // copete
  // Presupuesto de triángulos: tronco 36 + ramas 24 + manchas (80 las grandes, 20 las pequeñas).
  let grandes = n; const costo = g => 60 + g * 80 + (n - g) * 20;
  while (grandes > 3 && costo(grandes) > CONFIG.maxTriangulosArbol) grandes--;
  const bajas = new Set(); // manchas de 20 caras: las últimas del anillo (el copete, siempre visible, queda de 80)
  for (let q = 0; q < n - grandes; q++) bajas.add(n >= 6 ? n - 2 - q : n - 1 - q);
  const hueDe = () => flor ? (rng() < .3 ? [.66, 1, .62] : elige(rng, pal.hueFlor)) : elige(rng, pal.hue);
  bl.forEach((b, k) => blob(copa, b.c, b.r, bajas.has(k) ? 0 : 1, hueDe(), rng, bajas.has(k) ? .18 : .13));
  copa.sombrear(rng, .55, .1);
  for (const b of [bl[1], bl[2], bl[3]]) tubo(tronco, [[lean[0] * .9, ht * .84, lean[1] * .9, r1 * .62], [lerp(cx, b.c[0], .8), b.c[1] - .25 * b.r[1], lerp(cz, b.c[2], .8), .045]], 4, () => [.8, .78, .74]);
  return {copa, tronco};
}
function construirArbusto(rng) {
  const copa = new Malla(), tronco = new Malla(), pal = PAL.arbusto;
  tubo(tronco, [[0, 0, 0, .07], [0, .28, 0, .05]], 4, () => [.9, .85, .8]);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + rng() * .8, d = k ? .35 + rng() * .25 : .05, rr = k ? .45 + rng() * .25 : .70, ry = rr * .85;
    blob(copa, [Math.cos(a) * d, ry * .82 + .05 + rng() * .1, Math.sin(a) * d], [rr, ry, rr], 1, elige(rng, pal.hue), rng, .14);
  }
  copa.sombrear(rng, .5, .12);
  return {copa, tronco};
}
// Coníferas por capas (pino: ancha y escalonada; cedro: esbelta y densa). Cada capa = faldón con borde irregular.
const PINO = {H: 11.5, R: 2.7, tiers: 8, seg: 10, y0: .12, y1: .80, hf: .21, jit: .22, lean: .6, rt: .20, hues: HUE_CONIF};
const CEDRO = {H: 12.5, R: 1.55, tiers: 10, seg: 9, y0: .05, y1: .82, hf: .19, jit: .12, lean: .3, rt: .16, hues: HUE_CONIF};
function construirConifera(rng, p) {
  const copa = new Malla(), tronco = new Malla(), lean = [(rng() - .5) * p.lean, (rng() - .5) * p.lean];
  tubo(tronco, [[0, 0, 0, p.rt * 1.3], [lean[0] * .3, p.H * .3, lean[1] * .3, p.rt], [lean[0] * .9, p.H * .86, lean[1] * .9, p.rt * .25]], 6, colTronco);
  for (let i = 0; i < p.tiers; i++) {
    const t = p.tiers > 1 ? i / (p.tiers - 1) : 0, yb = p.H * (p.y0 + (p.y1 - p.y0) * Math.pow(t, .92)), hi = p.H * p.hf * (1 - .4 * t);
    const apexY = i === p.tiers - 1 ? p.H : yb + hi, ri = p.R * (1 - .88 * Math.pow(t, 1.05)), rot = rng() * Math.PI * 2, hue = elige(rng, p.hues);
    const ax = lean[0] * (yb / p.H), az = lean[1] * (yb / p.H), ref = [ax, yb - hi, az];
    const apex = copa.v(lean[0] * (apexY / p.H), apexY, lean[1] * (apexY / p.H), hue), mid = [], rim = [];
    for (let j = 0; j < p.seg; j++) {
      const a = rot + 2 * Math.PI * j / p.seg, rr = ri * (1 + (rng() - .5) * p.jit), rm = ri * .56 * (1 + (rng() - .5) * p.jit), dy = (j % 2 ? 1 : -1) * hi * .07 * rng();
      rim.push(copa.v(ax + Math.cos(a) * rr, yb + dy, az + Math.sin(a) * rr, [hue[0] * .80, hue[1] * .82, hue[2] * .82])); // borde más oscuro: marca la capa
      mid.push(copa.v(ax + Math.cos(a) * rm, yb + hi * .5, az + Math.sin(a) * rm, [hue[0] * .94, hue[1] * .94, hue[2] * .94]));
    }
    for (let j = 0; j < p.seg; j++) { const k = (j + 1) % p.seg; copa.tri(apex, mid[j], mid[k], ref); copa.quad(mid[j], rim[j], rim[k], mid[k], ref); }
  }
  copa.sombrear(rng, .62, .08);
  return {copa, tronco};
}
// Palmera: tronco curvo y 9 frondas en V (hojas dobles: material DoubleSide).
function construirPalmera(rng) {
  const H = 10.5, tronco = new Malla(), copa = new Malla(), lean = [(rng() - .5) * 1.4, (rng() - .5) * 1.4], pts = [];
  for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([lean[0] * t * t, H * t, lean[1] * t * t, lerp(.30, .20, t) * (k === 0 ? 1.25 : 1)]); }
  tubo(tronco, pts, 6, t => [lerp(.7, 1, t), lerp(.68, .98, t), lerp(.64, .9, t)]);
  const top = pts[4], ref = [top[0], top[1] - 3, top[2]];
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + rng() * .3, L = 2.9 + rng() * .9, ca = Math.cos(a), sa = Math.sin(a), hue = elige(rng, PAL.palmera.hue), anillos = [];
    for (let s = 0; s < 3; s++) {
      const t = s / 2, w = [.14, .62, .12][s], px = top[0] + ca * L * t, py = top[1] + L * (.45 * t - .55 * t * t), pz = top[2] + sa * L * t, sx = -sa, sz = ca;
      anillos.push([copa.v(px + sx * w, py - .10 * w, pz + sz * w, hue), copa.v(px, py + .03, pz, hue), copa.v(px - sx * w, py - .10 * w, pz - sz * w, hue)]);
    }
    for (let s = 0; s < 2; s++) for (let q = 0; q < 2; q++) copa.quad(anillos[s][q], anillos[s][q + 1], anillos[s + 1][q + 1], anillos[s + 1][q], ref);
  }
  copa.sombrear(rng, .75, .1);
  return {copa, tronco};
}
const CONSTRUCTORES = {
  fresno: (r, f) => construirLatifoliada('fresno', r, f), jacaranda: (r, f) => construirLatifoliada('jacaranda', r, f),
  pino: r => construirConifera(r, PINO), cedro: r => construirConifera(r, CEDRO), arbusto: construirArbusto, palmera: construirPalmera
};
const GEO = new Map(); // geometrías por (especie, variante, flor): se construyen una vez y se comparten entre todos los árboles
function geometrias(tipo, v, flor) {
  const k = tipo + '#' + v + (flor ? 'f' : '');
  let e = GEO.get(k);
  if (!e) { const b = CONSTRUCTORES[tipo](prng('arbol:' + k), flor); e = {copa: b.copa.geometria(), tronco: b.tronco.geometria(), tris: b.copa.tris + b.tronco.tris}; GEO.set(k, e); }
  return e;
}
const ALIAS = {fresno: 'fresno', arbol: 'fresno', latifoliado: 'fresno', roble: 'fresno', jacaranda: 'jacaranda', pino: 'pino', conifera: 'pino', cedro: 'cedro', cipres: 'cedro', arbusto: 'arbusto', seto: 'arbusto', palmera: 'palmera', palma: 'palmera'};
export function normalizarTipo(t) {
  if (!t) return null;
  return ALIAS[String(t).split('/')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()] || null;
}
export function elegirTipo(u) { // u en [0,1): mezcla según CONFIG.pesosTipo
  const w = CONFIG.pesosTipo, total = Object.values(w).reduce((a, b) => a + b, 0);
  let x = u * total;
  for (const [k, v] of Object.entries(w)) { if ((x -= v) < 0) return k; }
  return 'fresno';
}
// Árbol listo para reemplazar el cuerpo de tree() de app.js. tamano = 1 equivale a ~9 m (latifoliadas), 11.5 m (pino),
// 12.5 m (cedro), 1.5 m (arbusto) y 10.5 m (palmera). 'elevacion' sube todo el árbol (montecito, jardineras) como antes.
export function crearArbol({tipo, tamano = 1, semilla = 1, elevacion = 0, floracion} = {}) {
  const rng = prng('arbol:' + semilla), r = Array.from({length: 8}, () => rng()); // consumo fijo: misma semilla, mismo árbol
  const t = normalizarTipo(tipo) || elegirTipo(r[0]), palma = t === 'palmera';
  const flor = t === 'jacaranda' && r[7] < (floracion ?? CONFIG.floracionJacaranda);
  const geo = geometrias(t, Math.floor(r[1] * (CONFIG.variantes[t] || 2)), flor);
  const g = new THREE.Group(); g.name = palma ? 'Palmera_editable' : 'Árbol_editable';
  g.userData = {tipoArbol: t, semilla: Number(semilla) || 0, flor};
  const pal = PAL[t], colorCopa = flor ? elige(() => r[2], pal.flor) : elige(() => r[2], pal.copa), colorTronco = elige(() => r[3], PAL.tronco);
  const tronco = new THREE.Mesh(geo.tronco, matTronco(colorTronco)), copa = new THREE.Mesh(geo.copa, palma ? matPalma(colorCopa) : matCopa(colorCopa));
  tronco.name = palma ? 'Palmera_tronco' : 'Árbol_tronco'; copa.name = palma ? 'Palmera_copa' : 'Árbol_copa';
  const sxz = tamano * (.92 + r[5] * .16), sy = tamano * (.92 + r[6] * .16);
  for (const o of [tronco, copa]) { o.scale.set(sxz, sy, sxz); o.position.y = elevacion; o.rotation.y = r[4] * Math.PI * 2; o.castShadow = true; }
  copa.receiveShadow = CONFIG.copaRecibeSombra;
  g.add(tronco, copa);
  return g;
}

// ───────────────────────── Bosque decorativo (InstancedMesh) ─────────────────────────
const COL_BOSQUE = {pino: '#2a4f34', eucalipto: '#44624a', latif: '#2a5035'};
function geoBosque(tipo) {
  const k = 'bosque:' + tipo;
  let g = GEO.get(k);
  if (g) return g;
  const rng = prng(k);
  let m;
  if (tipo === 'pino') {
    const b = construirConifera(rng, {H: 15, R: 3.4, tiers: 5, seg: 7, y0: .12, y1: .80, hf: .30, jit: .2, lean: .8, rt: .28, hues: HUE_CONIF});
    m = b.copa.tintar(lin(COL_BOSQUE.pino)).agregar(b.tronco.tintar(lin('#4a3b2c')));
  } else if (tipo === 'eucalipto') { // alto, esbelto, copa rala y colgante
    const H = 21, lean = [(rng() - .5) * 1.2, (rng() - .5) * 1.2], tr = new Malla(), cp = new Malla();
    tubo(tr, [[0, 0, 0, .36], [lean[0] * .2, H * .3, lean[1] * .2, .26], [lean[0] * .6, H * .65, lean[1] * .6, .18], [lean[0], H * .95, lean[1], .1]], 6, colTronco);
    for (let k = 0; k < 4; k++) { const a = k * 2.4 + rng(), d = k ? 1.1 + rng() * .8 : .2, y = H * (.66 + k * .1); blob(cp, [lean[0] + Math.cos(a) * d, y, lean[1] + Math.sin(a) * d], [1.7, 2.7, 1.7], 0, elige(rng, HUE_LATIF), rng, .22); }
    cp.sombrear(rng, .6, .12);
    m = cp.tintar(lin(COL_BOSQUE.eucalipto)).agregar(tr.tintar(lin('#8a8070')));
  } else { // latifoliada oscura
    const H = 11, tr = new Malla(), cp = new Malla();
    tubo(tr, [[0, 0, 0, .34], [0, H * .3, 0, .26], [0, H * .5, 0, .18]], 6, colTronco);
    [[0, H * .66, 0, 3.4, 1], [2, H * .6, 1.2, 2.5, 1], [-1.6, H * .74, -1.4, 2.2, 0]].forEach(([x, y, z, rr, d]) => blob(cp, [x, y, z], [rr, rr * .85, rr], d, elige(rng, HUE_LATIF), rng, .15));
    cp.sombrear(rng, .6, .12);
    m = cp.tintar(lin(COL_BOSQUE.latif)).agregar(tr.tintar(lin('#4a3b2c')));
  }
  g = {geo: m.geometria(), tris: m.tris}; GEO.set(k, g);
  return g;
}
const matBosque = () => matCache('Bosque_material', () => new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, metalness: 0, vertexColors: true}));
// Distancia con signo al polígono [[x,z],...]: negativa dentro, positiva fuera.
function distPoligono(pts, x, z) {
  let dentro = false, dmin = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, az] = pts[j], [bx, bz] = pts[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) dentro = !dentro;
    const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    dmin = Math.min(dmin, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return dentro ? -dmin : dmin;
}
// Cinturones de bosque oscuro alrededor del predio. Opciones (todas opcionales salvo el polígono):
//   sitio: data.site en px (X=(px-origenPx[0])*mpp, Z=(py-origenPx[1])*mpp)   o   poligono: [[x,z],...] en metros del mundo
//   n (1800) · semilla · distMin/distMax (metros desde el borde del predio: 14 / 260) · separacion (4.8 m entre troncos)
//   limite {xMin,xMax,zMin,zMax} donde se permiten árboles (por defecto 4 m dentro del plano de la maqueta)
//   excluir(x,z) -> true para dejar libre · altura(x,z) -> y del terreno (por defecto 0) · sombras (false)
//   ladera {pendiente (.1), max (30 m), inicio (distMin-4 m)}: el terreno bajo el bosque sube con la distancia (laderas boscosas); sin ella el bosque es plano
//   mezcla {pino,eucalipto,latif} · suelo: false | {color,y,rect}  (alfombra verde oscura bajo el bosque; el predio queda libre)
export function crearBosque(parent, opts = {}) {
  const mpp = opts.mpp ?? 1, o = opts.origenPx || [895, 390];
  const poli = opts.poligono || (opts.sitio || []).map(p => [(p[0] - o[0]) * mpp, (p[1] - o[1]) * mpp]);
  if (poli.length < 3) throw new Error('crearBosque: falta el polígono del predio (opts.sitio o opts.poligono)');
  const lim = opts.limite || {xMin: -256, xMax: 256, zMin: -246, zMax: 246}, n = opts.n ?? 1800, dMin = opts.distMin ?? 14, dMax = opts.distMax ?? 260, sep = opts.separacion ?? 4.8;
  const mezcla = {pino: .58, eucalipto: .27, latif: .15, ...(opts.mezcla || {})}, rng = prng('bosque:' + (opts.semilla ?? 2026)), lad = opts.ladera || null;
  // ladera: el terreno bajo el bosque sube con la distancia al predio (arranque suave, luego pendiente constante hasta 'max').
  const altura = opts.altura || (lad ? (x, z) => { const dd = Math.max(0, distPoligono(poli, x, z) - (lad.inicio ?? dMin - 4)); return Math.min(lad.max ?? 30, (lad.pendiente ?? .1) * (dd < 40 ? dd * dd / 80 : dd - 20)); } : () => 0);
  const grid = new Map(), pos = [];
  const libre = (x, z) => { const cx = Math.floor(x / sep), cz = Math.floor(z / sep); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get((cx + i) + ',' + (cz + j)); if (a) for (const q of a) if ((q[0] - x) ** 2 + (q[1] - z) ** 2 < sep * sep) return false; } return true; };
  for (let intentos = 0; pos.length < n && intentos < n * 70; intentos++) {
    const x = lerp(lim.xMin, lim.xMax, rng()), z = lerp(lim.zMin, lim.zMax, rng()), d = distPoligono(poli, x, z);
    if (d < dMin || d > dMax || (opts.excluir && opts.excluir(x, z)) || !libre(x, z)) continue;
    const key = Math.floor(x / sep) + ',' + Math.floor(z / sep); if (!grid.has(key)) grid.set(key, []); grid.get(key).push([x, z]);
    pos.push({x, z, d});
  }
  const g = new THREE.Group(); g.name = 'Bosque_decorativo'; g.userData = {noExportGLB: true, decorativo: true, instancias: pos.length};
  const tot = mezcla.pino + mezcla.eucalipto + mezcla.latif, porTipo = {pino: [], eucalipto: [], latif: []};
  for (const p of pos) { const u = rng() * tot; porTipo[u < mezcla.pino ? 'pino' : u < mezcla.pino + mezcla.eucalipto ? 'eucalipto' : 'latif'].push(p); }
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  for (const [tipo, lista] of Object.entries(porTipo)) {
    if (!lista.length) continue;
    const im = new THREE.InstancedMesh(geoBosque(tipo).geo, matBosque(), lista.length); im.name = 'Bosque_' + tipo;
    lista.forEach((p, i) => {
      const k = clamp((p.d - dMin) / ((dMax - dMin) || 1), 0, 1), s = (.75 + rng() * .7) * (1 + .35 * k), w = s * (.9 + rng() * .25), br = .72 + rng() * .32;
      dummy.position.set(p.x, altura(p.x, p.z), p.z); dummy.rotation.set(0, rng() * Math.PI * 2, 0); dummy.scale.set(w, s, w); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, col.setRGB(br * (.94 + rng() * .1), br, br * (.92 + rng() * .12)));
    });
    im.instanceMatrix.setUsage(THREE.StaticDrawUsage); im.castShadow = !!opts.sombras; im.receiveShadow = false; im.computeBoundingSphere();
    g.add(im);
  }
  if (opts.suelo !== false) { // alfombra verde oscura bajo el bosque (en modo plano recorta el predio: sin traslape ni z-fighting con 'Predio_aproximado')
    const s = opts.suelo || {}, r = s.rect || {xMin: -260, xMax: 260, zMin: -250, zMax: 250};
    let geo;
    if (lad || opts.altura) { // malla regular con la altura del terreno (sin hueco: bajo el predio queda a y ≤ .08, tapada por él)
      const nx = Math.ceil((r.xMax - r.xMin) / 5), nz = Math.ceil((r.zMax - r.zMin) / 5);
      geo = new THREE.PlaneGeometry(r.xMax - r.xMin, r.zMax - r.zMin, nx, nz); geo.rotateX(-Math.PI / 2);
      const P = geo.attributes.position;
      for (let k = 0; k < P.count; k++) { const x = P.getX(k) + (r.xMax + r.xMin) / 2, z = P.getZ(k) + (r.zMax + r.zMin) / 2; P.setXYZ(k, x, altura(x, z), z); }
      geo.computeVertexNormals();
    } else {
      const sh = new THREE.Shape([[r.xMin, -r.zMin], [r.xMax, -r.zMin], [r.xMax, -r.zMax], [r.xMin, -r.zMax]].map(p => new THREE.Vector2(p[0], p[1])));
      sh.holes.push(new THREE.Path(poli.map(p => new THREE.Vector2(p[0], -p[1]))));
      geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
    }
    const mat = new THREE.MeshStandardMaterial({color: s.color || '#2f4a36', roughness: 1}); mat.userData.disposeMaterial = true;
    const suelo = new THREE.Mesh(geo, mat); suelo.name = 'Bosque_suelo'; suelo.position.y = s.y ?? .08; suelo.receiveShadow = true; g.add(suelo);
  }
  if (parent) parent.add(g);
  return g;
}
// generate() descarta el mundo con geometry.dispose(); las InstancedMesh además necesitan dispose() propio para liberar su buffer de instancias.
export function liberarInstancias(root) { root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
// Para el GLB: oculta lo marcado con userData.noExportGLB; devuelve la función que lo restaura (úsala en un finally).
export function ocultarParaExportar(root) {
  const ocultos = [];
  root.traverse(o => { if (o.userData && o.userData.noExportGLB === true && o.visible) { o.visible = false; ocultos.push(o); } });
  return () => { for (const o of ocultos) o.visible = true; };
}

// ───────────────────────── Autos ─────────────────────────
// Perfil lateral (z, y) del cuerpo, cabina (cristales + techo), ruedas y luces. Frente = +Z. ≤ 150 triángulos por auto.
const MODELOS_AUTO = {
  sedan: {ancho: 1.82, perfil: [[-2.25, .30], [-2.27, .62], [-2.10, .90], [-1.20, .97], [1.05, .99], [1.90, .84], [2.26, .60], [2.25, .30]],
    cab: {zb: [-1.20, 1.05], zt: [-.72, .42], yb: .97, yt: 1.47, wb: .80, wt: .70}, ruedas: [-1.35, 1.40], zf: 2.27, zr: -2.28},
  hatch: {ancho: 1.74, perfil: [[-1.95, .30], [-1.98, .66], [-1.90, .98], [-1.2, 1.02], [.95, 1.0], [1.65, .86], [2.0, .62], [1.98, .30]],
    cab: {zb: [-1.9, .95], zt: [-1.78, .35], yb: 1.0, yt: 1.52, wb: .78, wt: .68}, ruedas: [-1.15, 1.2], zf: 2.01, zr: -1.99},
  suv: {ancho: 1.92, rr: .37, perfil: [[-2.3, .38], [-2.32, .80], [-2.2, 1.12], [-1.8, 1.2], [1.1, 1.2], [1.95, 1.0], [2.3, .78], [2.28, .38]],
    cab: {zb: [-2.2, 1.1], zt: [-1.95, .55], yb: 1.2, yt: 1.78, wb: .84, wt: .76}, ruedas: [-1.45, 1.45], zf: 2.31, zr: -2.33}
};
const GEO_AUTO = new Map();
function geometriasAuto(tipo) {
  if (GEO_AUTO.has(tipo)) return GEO_AUTO.get(tipo);
  const M = MODELOS_AUTO[tipo], W = M.ancho, hw = y => W / 2 * (1 - .07 * clamp((y - .3) / .75, 0, 1));
  const cuerpo = new Malla(), vidrio = new Malla(), llantas = new Malla(), luces = new Malla(), C = [1, 1, 1], L = [], R = [], n = M.perfil.length, ref = [0, .7, 0];
  for (const [z, y] of M.perfil) { L.push(cuerpo.v(-hw(y), y, z, C)); R.push(cuerpo.v(hw(y), y, z, C)); }
  for (let i = 0; i < n; i++) { const k = (i + 1) % n; cuerpo.quad(L[i], L[k], R[k], R[i], ref); }
  for (let i = 1; i < n - 1; i++) { cuerpo.tri(L[0], L[i], L[i + 1], ref); cuerpo.tri(R[0], R[i], R[i + 1], ref); }
  const c = M.cab, [b0, b1] = c.zb, [t0, t1] = c.zt, cref = [0, (c.yb + c.yt) / 2, (b0 + b1) / 2];
  const B = [[-c.wb, c.yb, b0], [c.wb, c.yb, b0], [c.wb, c.yb, b1], [-c.wb, c.yb, b1]].map(p => vidrio.v(p[0], p[1], p[2], C));
  const T = [[-c.wt, c.yt, t0], [c.wt, c.yt, t0], [c.wt, c.yt, t1], [-c.wt, c.yt, t1]].map(p => vidrio.v(p[0], p[1], p[2], C));
  vidrio.quad(B[0], B[1], T[1], T[0], cref); vidrio.quad(B[2], B[3], T[3], T[2], cref); vidrio.quad(B[0], B[3], T[3], T[0], cref); vidrio.quad(B[1], B[2], T[2], T[1], cref);
  const techo = [[-c.wt, c.yt + .005, t0], [c.wt, c.yt + .005, t0], [c.wt, c.yt + .005, t1], [-c.wt, c.yt + .005, t1]].map(p => cuerpo.v(p[0], p[1], p[2], C));
  cuerpo.quad(techo[0], techo[1], techo[2], techo[3], [0, c.yt - 1, (t0 + t1) / 2]);
  const rr = M.rr || .32, ww = .22;
  for (const z of M.ruedas) for (const s of [-1, 1]) {
    const cx = s * (W / 2 - .09), cy = rr, ext = [], int = [], rf = [cx, cy, z];
    for (let j = 0; j < 8; j++) { const a = 2 * Math.PI * j / 8, y = cy + Math.sin(a) * rr, zz = z + Math.cos(a) * rr; ext.push(llantas.v(cx + s * ww / 2, y, zz, C)); int.push(llantas.v(cx - s * ww / 2, y, zz, C)); }
    for (let j = 0; j < 8; j++) { const k = (j + 1) % 8; llantas.quad(ext[j], ext[k], int[k], int[j], rf); }
    const cen = llantas.v(cx + s * ww / 2, cy, z, C); for (let j = 0; j < 8; j++) llantas.tri(cen, ext[j], ext[(j + 1) % 8], rf);
  }
  const faro = (z, col, x, dir) => { const a = luces.v(x - .15, .60, z, col), b = luces.v(x + .15, .60, z, col), c2 = luces.v(x + .15, .72, z, col), d = luces.v(x - .15, .72, z, col); luces.quad(a, b, c2, d, [x, .66, z - dir]); };
  for (const s of [-1, 1]) { faro(M.zf, [1, .97, .85], s * .62, 1); faro(M.zr, [.75, .03, .03], s * .62, -1); }
  const e = {cuerpo: cuerpo.geometria(), vidrio: vidrio.geometria(), llantas: llantas.geometria(), luces: luces.geometria(), tris: cuerpo.tris + vidrio.tris + llantas.tris + luces.tris};
  GEO_AUTO.set(tipo, e);
  return e;
}
const COLORES_AUTO = ['#e9e8e4', '#3a3f46', '#8d939a', '#b8bcc2', '#c0392b', '#1f4e8c', '#f0efe9', '#2d3a4a', '#d4b04a', '#4e7a52', '#7a2e2e'];
export function crearAuto({color, tipo = 'sedan', semilla = 1} = {}) {
  const rng = prng('auto:' + semilla), c = color || elige(rng, COLORES_AUTO), m = MODELOS_AUTO[tipo] ? tipo : 'sedan', geo = geometriasAuto(m);
  const g = new THREE.Group(); g.name = 'Auto_decorativo'; g.userData = {modelo: m, color: c};
  const cuerpo = new THREE.Mesh(geo.cuerpo, matCache('Auto_' + c, () => new THREE.MeshStandardMaterial({color: c, roughness: .38, metalness: .1})));
  const vidrio = new THREE.Mesh(geo.vidrio, matCache('Auto_vidrio', () => new THREE.MeshStandardMaterial({color: '#22323d', roughness: .1, metalness: 0})));
  const llantas = new THREE.Mesh(geo.llantas, matCache('Auto_llanta', () => new THREE.MeshStandardMaterial({color: '#1c1c1e', roughness: .9})));
  const luces = new THREE.Mesh(geo.luces, matCache('Auto_luces', () => new THREE.MeshStandardMaterial({vertexColors: true, roughness: .35, metalness: 0})));
  cuerpo.name = 'Auto_carroceria'; vidrio.name = 'Auto_cristales'; llantas.name = 'Auto_llantas'; luces.name = 'Auto_luces';
  cuerpo.castShadow = true; cuerpo.receiveShadow = true; llantas.castShadow = true;
  g.add(cuerpo, vidrio, llantas, luces);
  return g;
}

// ───────────────────────── Personas ─────────────────────────
const ROPA = ['#c0392b', '#2e6da4', '#e0a526', '#3f8f5f', '#7b4fa0', '#e8e6df', '#2b2f36', '#e07b39', '#4aa3a2', '#b64f7a'];
const PANTALON = ['#2b3a55', '#3a3d44', '#5a4a3a', '#1f2430', '#6b6f76'];
const PIEL = ['#f1c9a5', '#d9a074', '#b97a4f', '#8d5a3b', '#6b4128'];
const PELO = ['#1b1511', '#3a2a1c', '#6b4a2a', '#a77b45', '#222222'];
const GEO_PERSONA = new Map();
function geometriasPersona(pose) {
  if (GEO_PERSONA.has(pose)) return GEO_PERSONA.get(pose);
  const sw = pose === 'camina' ? .30 : 0, aw = pose === 'camina' ? .20 : 0, W = () => [1, 1, 1];
  const piernas = new Malla(), cuerpo = new Malla(), cabeza = new Malla(), pelo = new Malla(), C = [1, 1, 1];
  for (const s of [-1, 1]) {
    tubo(piernas, [[s * .095, .93, 0, .085], [s * .095, .03, -s * sw, .052]], 6, W);
    tubo(cuerpo, [[s * .215, 1.40, 0, .048], [s * .235, .84, s * aw, .040]], 5, W);
  }
  tubo(cuerpo, [[0, .90, 0, 1, .165, .105], [0, 1.24, 0, 1, .195, .12], [0, 1.44, 0, 1, .175, .10]], 8, W, true);
  esfera(cabeza, [0, 1.575, 0], .115, 6, 4, C);
  esfera(pelo, [0, 1.588, -.008], .124, 6, 2, C, 1.25);
  const e = {piernas: piernas.geometria(), cuerpo: cuerpo.geometria(), cabeza: cabeza.geometria(), pelo: pelo.geometria(), tris: piernas.tris + cuerpo.tris + cabeza.tris + pelo.tris};
  GEO_PERSONA.set(pose, e);
  return e;
}
// Persona de 1.7 m (±6 %). pose: 'pie' | 'camina'. Colores opcionales (hex); sin ellos salen de la semilla.
export function crearPersona({ropa, piel, pantalon, pelo, semilla = 1, pose = 'pie'} = {}) {
  const rng = prng('persona:' + semilla), p = pose === 'camina' ? 'camina' : 'pie', geo = geometriasPersona(p);
  const cr = ropa || elige(rng, ROPA), cp = pantalon || elige(rng, PANTALON), cs = piel || elige(rng, PIEL), ch = pelo || elige(rng, PELO), esc = .94 + rng() * .12;
  const g = new THREE.Group(); g.name = 'Persona_decorativa'; g.userData = {pose: p, ropa: cr};
  const partes = [['Persona_piernas', geo.piernas, matSimple(cp, .9)], ['Persona_cuerpo', geo.cuerpo, matSimple(cr, .85)], ['Persona_cabeza', geo.cabeza, matSimple(cs, .7)], ['Persona_pelo', geo.pelo, matSimple(ch, .9)]];
  for (const [nombre, geometria, material] of partes) { const m = new THREE.Mesh(geometria, material); m.name = nombre; m.castShadow = nombre !== 'Persona_pelo'; g.add(m); }
  g.scale.setScalar(esc);
  return g;
}

// Lista de vida del campus en el marco local CU_FRAME (x a la derecha, z hacia la sede). giro: 0 mira a +Z, π/2 mira a +X.
function construirVida() {
  const rng = prng('vida:campus'), L = [], r2 = v => +v.toFixed(2);
  // ocupacion: un carácter por cajón ('1' = hay auto), para que la escena no dependa de la suerte del PRNG.
  const fila = ({x0, x1, paso, z, giro, ocupacion, saltar = [], y}) => {
    let k = 0;
    for (let x = x0; x <= x1 + 1e-6; x += paso, k++) {
      if (saltar.some(([a, b]) => x >= a && x <= b) || ocupacion[k % ocupacion.length] !== '1') continue;
      L.push({tipo: 'auto', x: r2(x + (rng() - .5) * .25), z: r2(z + (rng() - .5) * .4), giro: +(giro + (rng() - .5) * .06).toFixed(3), color: elige(rng, COLORES_AUTO), modelo: elige(rng, ['sedan', 'sedan', 'hatch', 'suv']), ...(y !== undefined ? {y} : {})});
    }
  };
  fila({x0: -4.7, x1: 16.1, paso: 2.6, z: -84, giro: Math.PI, ocupacion: '111011011'});                                              // franja de cajones al sur del frontón / explanada
  // (la fila norte de z -164.4 caía dentro del edificio auxiliar AUX_N y se quitó)
  fila({x0: -23.5, x1: 8.3, paso: 2.7, z: -155.6, giro: Math.PI, ocupacion: '101101011101', saltar: [[-11.8, -5.4]], y: .12});     // fila sur, con hueco donde arranca el camino de en medio
  L.push({tipo: 'auto', x: -25, z: -77.3, giro: Math.PI / 2, color: '#e9e8e4', modelo: 'sedan', y: .31}, {tipo: 'auto', x: -8, z: -72.1, giro: -Math.PI / 2, color: '#1f4e8c', modelo: 'hatch', y: .31}); // calle frente a la sede
  L.push({tipo: 'auto', x: -44.0, z: -168, giro: 0, color: '#8d939a', modelo: 'suv', y: .31}, {tipo: 'auto', x: -39.9, z: -128, giro: 3.247, color: '#3a3f46', modelo: 'sedan', y: .31},
    {tipo: 'auto', x: -44.1, z: -100, giro: -.04, color: '#c0392b', modelo: 'hatch', y: .31}, {tipo: 'auto', x: -43.2, z: -30, giro: .098, color: '#f0efe9', modelo: 'sedan', y: .31}); // camino poniente
  const P = (x, z, giro, pose = 'camina', y) => L.push({tipo: 'persona', x, z, giro, pose, semilla: L.length + 7, ...(y !== undefined ? {y} : {})});
  // Camino de en medio (x ≈ -9): caminantes en ambos sentidos y una pareja conversando.
  P(-9.9, -147.5, 0); P(-7.3, -141, Math.PI); P(-10.2, -133, 0); P(-9.5, -129, Math.PI); P(-9.5, -119.6, Math.PI / 2, 'pie'); P(-8.5, -119.3, -Math.PI / 2, 'pie'); P(-9.6, -102.5, Math.PI); P(-10.6, -112, 0);
  // Calle frente a la sede (z ≈ -75) y explanada sur.
  P(-30, -76.5, Math.PI / 2, 'camina', .31); P(-24, -73.2, Math.PI / 2, 'camina', .31); P(-12, -75.6, -Math.PI / 2, 'camina', .31); P(-3.5, -72.8, -Math.PI / 2, 'camina', .31); P(2, -77, Math.PI / 2, 'pie', .31);
  P(2, -90, 0.6, 'pie'); P(-1, -91.5, -2.4, 'pie'); P(-9.4, -92.2, 1, 'pie'); P(-7.6, -93.4, -1.8, 'pie');
  // Banqueta frente a la sede.
  P(-28, -46, Math.PI / 2); P(-10, -47.2, -Math.PI / 2); P(5, -45.5, Math.PI, 'pie');
  // Escaleras del montecito: al pie, a media escalera y en el andador de arriba (alturas calculadas con la sección del muro en z = -151).
  P(29.2, -151, Math.PI / 2, 'pie', .36); P(31.5, -151, Math.PI / 2, 'camina', 1.62); P(40.4, -151, 0, 'camina', 3.2);
  return L;
}
export const VIDA_CAMPUS = construirVida();
// Coloca la lista en 'parent' (grupo con el marco CU_FRAME: posición X(CU_FRAME.x),0,Z(CU_FRAME.z) y rotation.y = CU_FRAME.angle).
// Entradas: {tipo:'auto'|'persona', x, z, giro, y?, color?, modelo?, ropa?, piel?, pantalon?, pelo?, pose?, semilla?}. y por defecto .35 (cara superior de andadores).
export function colocarVida(parent, lista = VIDA_CAMPUS, {exportarGLB = true} = {}) {
  const g = new THREE.Group(); g.name = 'Vida_decorativa'; g.userData = {decorativo: true, noExportGLB: !exportarGLB};
  lista.forEach((e, i) => {
    if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.z)) return;
    const o = e.tipo === 'persona' ? crearPersona({ropa: e.ropa, piel: e.piel, pantalon: e.pantalon, pelo: e.pelo, pose: e.pose, semilla: e.semilla ?? i})
      : crearAuto({color: e.color, tipo: e.modelo, semilla: e.semilla ?? i});
    o.position.set(e.x, e.y ?? .35, e.z); o.rotation.y = e.giro || 0; g.add(o);
  });
  if (parent) parent.add(g);
  return g;
}

// ───────────────────────── Relieve de materiales ─────────────────────────
// mejorarMaterial inyecta (onBeforeCompile) una perturbación de normal triplanar en coordenadas del mundo, SIN pisar lo anterior:
// llama al onBeforeCompile previo (p. ej. addDetail) y encadena customProgramCacheKey. Debe aplicarse DESPUÉS de addDetail.
// Opciones:
//   normalTex  : Texture | {value:Texture} | nombre ('pasto_n' -> ./texturas/pasto_n.jpg). Normal OpenGL (NormalGL), repetible.
//   bumpTex    : Texture | {value} | nombre cuya LUMINANCIA se usa como altura (alternativa sin archivo de normales; dFdx/dFdy).
//   escala     : metros por repetición de la textura (usa la misma que addDetail para que normal y color coincidan).
//   fuerza     : 0..2 intensidad de la normal · bumpFuerza: altura (m) del bump por luminancia (def. .03)
//   procedural : {frecuencia (ciclos/m), amplitud (m)} micro-relieve de ruido 3D, no necesita archivos
//   rugosidad  : {variacion 0..1, escala (m), mojado:{cobertura 0..1, rugosidad, oscurecer}} charcos / asfalto mojado
//   manchas    : {escala (m), fuerza 0..1, tinte '#hex' (multiplicador; blanco = sin cambio)} parches de color
//   desvanecer : [cerca, lejos] metros: el relieve se apaga con la distancia (evita centelleo y desaparece en el plano superior)
//   modo       : 'tri' (def.) | 'plano' (sólo proyección en XZ, más barato, para pisos)
const RELIEVE = new WeakSet(); // materiales ya mejorados (evita doble inyección = error de GLSL)
const holder = t => !t ? null : typeof t === 'string' ? texturaRelieve(t) : t.isTexture ? {value: t} : t;
const _plana = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); _plana.needsUpdate = true;
const _texRelieve = new Map();
// Texturas incrustadas por build.mjs en Visor_UAM_autonomo.html (bloque JSON id="uam-texturas", data: URI): abierto con doble clic
// (file://) el navegador bloquea por CORS las imágenes de ./texturas/, las data: URI no. Sin bloque (index.html servido) se piden a la carpeta.
let _incrustadas = null;
export function urlTextura(nombre, ruta = './texturas/') {
  if (_incrustadas === null) {
    _incrustadas = {};
    try { const el = typeof document !== 'undefined' && document.getElementById('uam-texturas'); if (el) _incrustadas = JSON.parse(el.textContent); } catch { /* sin texturas incrustadas */ }
  }
  return _incrustadas[nombre] || ruta + nombre + '.jpg';
}
// Carga asíncrona con textura plana de reserva: si el archivo no existe no pasa nada.
export function texturaRelieve(nombre, ruta = './texturas/') {
  if (_texRelieve.has(nombre)) return _texRelieve.get(nombre);
  const h = {value: _plana}; _texRelieve.set(nombre, h);
  if (typeof document !== 'undefined') new THREE.TextureLoader().load(urlTextura(nombre, ruta), t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; h.value = t; }, undefined, () => {});
  return h;
}
const GLSL_RUIDO = `float rlHash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float rlNoise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(rlHash(i),rlHash(i+vec3(1.0,0.0,0.0)),f.x),mix(rlHash(i+vec3(0.0,1.0,0.0)),rlHash(i+vec3(1.0,1.0,0.0)),f.x),f.y),
  mix(mix(rlHash(i+vec3(0.0,0.0,1.0)),rlHash(i+vec3(1.0,0.0,1.0)),f.x),mix(rlHash(i+vec3(0.0,1.0,1.0)),rlHash(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);}`;
const GLSL_PERT = `vec3 rlPert(vec3 pos,vec3 N,float dBs,float dBt,float fd){
 vec3 sx=dFdx(pos);vec3 sy=dFdy(pos);vec3 R1=cross(sy,N);vec3 R2=cross(N,sx);
 float fDet=dot(sx,R1)*fd;if(abs(fDet)<1e-12)return N;
 vec3 g=sign(fDet)*(dBs*R1+dBt*R2);return normalize(abs(fDet)*N-g);}`;
const GLSL_TRI = `vec3 rlTri(vec3 p,vec3 n){
 vec3 w=pow(abs(n),vec3(4.0));w/=(w.x+w.y+w.z+1e-5);
 vec3 tx=texture2D(rlNormal,p.zy/rlA.x).xyz*2.0-1.0;vec3 ty=texture2D(rlNormal,p.xz/rlA.x).xyz*2.0-1.0;vec3 tz=texture2D(rlNormal,p.xy/rlA.x).xyz*2.0-1.0;
 tx=vec3(tx.xy+n.zy,abs(tx.z)*n.x);ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);tz=vec3(tz.xy+n.xy,abs(tz.z)*n.z);
 return normalize(tx.zyx*w.x+ty.xzy*w.y+tz.xyz*w.z);}`;
const GLSL_PLANO = `vec3 rlTri(vec3 p,vec3 n){
 vec3 ty=texture2D(rlNormal,p.xz/rlA.x).xyz*2.0-1.0;ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);return normalize(ty.xzy);}`;
const GLSL_LUM = `float rlLum(vec3 p,vec3 n){
 vec3 w=pow(abs(n),vec3(4.0));w/=(w.x+w.y+w.z+1e-5);const vec3 L=vec3(0.299,0.587,0.114);
 return dot(texture2D(rlBump,p.zy/rlA.x).rgb,L)*w.x+dot(texture2D(rlBump,p.xz/rlA.x).rgb,L)*w.y+dot(texture2D(rlBump,p.xy/rlA.x).rgb,L)*w.z;}`;
const GLSL_LUM_PLANO = `float rlLum(vec3 p,vec3 n){return dot(texture2D(rlBump,p.xz/rlA.x).rgb,vec3(0.299,0.587,0.114));}`;

export function mejorarMaterial(mat, op = {}) {
  if (!mat || RELIEVE.has(mat)) return mat;
  const nTex = holder(op.normalTex), bTex = holder(op.bumpTex), proc = op.procedural || null, rug = op.rugosidad || null, wet = rug && rug.mojado || null, man = op.manchas || null, plano = op.modo === 'plano';
  const clave = 'rel:' + [nTex && 'n', bTex && 'b', proc && 'p', rug && 'r', wet && 'w', man && 'm', plano && 'pl'].filter(Boolean).join('');
  const u = {rlA: {value: new THREE.Vector3(op.escala ?? 6, op.fuerza ?? .7, op.bumpFuerza ?? .03)}, rlFade: {value: new THREE.Vector2(...(op.desvanecer || [90, 420]))}};
  if (nTex) u.rlNormal = nTex;
  if (bTex) u.rlBump = bTex;
  if (proc) u.rlProc = {value: new THREE.Vector2(proc.frecuencia ?? 8, proc.amplitud ?? .01)};
  if (rug) { u.rlRug = {value: new THREE.Vector4(rug.variacion ?? .15, wet ? wet.cobertura ?? .2 : 0, wet ? wet.rugosidad ?? .3 : 1, wet ? wet.oscurecer ?? .2 : 0)}; u.rlRugS = {value: rug.escala ?? 8}; }
  if (man) { u.rlMan = {value: new THREE.Vector2(man.escala ?? 14, man.fuerza ?? .4)}; u.rlManC = {value: new THREE.Vector3(...lin(man.tinte || '#ffffff'))}; }
  const decl = ['varying vec3 vRlP;', 'uniform vec3 rlA;', 'uniform vec2 rlFade;'], funcs = [];
  if (nTex) decl.push('uniform sampler2D rlNormal;');
  if (bTex) decl.push('uniform sampler2D rlBump;');
  if (proc) decl.push('uniform vec2 rlProc;');
  if (rug) decl.push('uniform vec4 rlRug;', 'uniform float rlRugS;');
  if (man) decl.push('uniform vec2 rlMan;', 'uniform vec3 rlManC;');
  if (proc || rug || man) funcs.push(GLSL_RUIDO);
  if (nTex) funcs.push(plano ? GLSL_PLANO : GLSL_TRI);
  if (bTex) funcs.push(plano ? GLSL_LUM_PLANO : GLSL_LUM);
  if (nTex || bTex || proc) funcs.push(GLSL_PERT);
  // Bloques de main(): color (tras map_fragment), rugosidad (tras roughnessmap_fragment) y normal (tras normal_fragment_maps).
  const bloqueColor = man ? `{float rlM=rlNoise(vRlP/rlMan.x)*0.65+rlNoise(vRlP/(rlMan.x*0.37)+7.3)*0.35;
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*rlManC,smoothstep(0.38,0.72,rlM)*rlMan.y*(isOrthographic?0.0:1.0));}` : ''; // sin parches en cámaras ortográficas (plano 2D y «Plano superior»)
  const bloqueRug = rug ? `{float rlF2=1.0-smoothstep(rlFade.y*0.8,rlFade.y*2.5,length(cameraPosition-vRlP));
 float rlQ=rlNoise(vRlP/rlRugS)*0.6+rlNoise(vRlP/(rlRugS*0.31)+3.7)*0.4;
 roughnessFactor=clamp(roughnessFactor+(rlQ-0.5)*rlRug.x*rlF2,0.04,1.0);
${wet ? ` float rlWet=smoothstep(1.0-rlRug.y-0.07,1.0-rlRug.y+0.07,rlNoise(vRlP/(rlRugS*1.7)+11.0)*0.65+rlQ*0.35)*step(0.001,rlRug.y)*rlF2;
 roughnessFactor=mix(roughnessFactor,rlRug.z,rlWet);diffuseColor.rgb*=1.0-rlWet*rlRug.w;` : ''}}` : '';
  const partesN = [];
  if (nTex) partesN.push(' vec3 rlNn=normalize(rlWn+(rlTri(vRlP,rlWn)-rlWn)*rlA.y*rlF);normal=normalize((viewMatrix*vec4(rlNn,0.0)).xyz);');
  if (bTex || proc) {
    partesN.push(' float rlH=0.0;');
    if (bTex) partesN.push(' rlH+=(rlLum(vRlP,rlWn)-0.5)*rlA.z;');
    if (proc) partesN.push(' float rlPx=length(fwidth(vRlP));float rlAa=1.0-smoothstep(0.25,0.8,rlPx*rlProc.x);float rlAb=1.0-smoothstep(0.25,0.8,rlPx*rlProc.x*2.7);',
      ' rlH+=((rlNoise(vRlP*rlProc.x)-0.5)*0.65*rlAa+(rlNoise(vRlP*rlProc.x*2.7+3.1)-0.5)*0.35*rlAb)*rlProc.y;');
    partesN.push(' rlH*=rlF;normal=rlPert(-vViewPosition,normal,dFdx(rlH),dFdy(rlH),faceDirection);');
  }
  const bloqueNormal = partesN.length ? `{float rlF=1.0-smoothstep(rlFade.x,rlFade.y,length(cameraPosition-vRlP));
 vec3 rlWn=normalize((vec4(normal,0.0)*viewMatrix).xyz);
${partesN.join('\n')}}` : '';
  const previo = mat.onBeforeCompile;
  // clave previa: la función propia del material (addDetail) o, si no hay, la instantánea del texto del onBeforeCompile anterior (valor por defecto de three)
  const clavePrevia = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : (k => () => k)(mat.customProgramCacheKey());
  mat.onBeforeCompile = (sh, renderer) => {
    previo.call(mat, sh, renderer);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRlP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRlP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + decl.join('\n') + '\n' + funcs.join('\n'));
    if (bloqueColor) f = f.replace('#include <map_fragment>', '#include <map_fragment>\n' + bloqueColor);
    if (bloqueRug) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + bloqueRug);
    if (bloqueNormal) f = f.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bloqueNormal);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => clavePrevia() + '|' + clave;
  RELIEVE.add(mat); mat.needsUpdate = true;
  return mat;
}
// Ajustes por tipo de superficie (clave = nombre de DETAIL en app.js). 'césped': normal de pasto + ruido fino + parches secos.
export const PRESETS_RELIEVE = {
  pasto: {normal: 'pasto_n', fuerza: .9, procedural: {frecuencia: 6.5, amplitud: .014}, desvanecer: [60, 340]},
  asfalto: {normal: 'asfalto_n', fuerza: .8, procedural: {frecuencia: 16, amplitud: .005}, rugosidad: {variacion: .16, escala: 8, mojado: {cobertura: .2, rugosidad: .3, oscurecer: .2}}},
  asfalto2: {normal: 'asfalto2_n', fuerza: .8, procedural: {frecuencia: 14, amplitud: .004}, rugosidad: {variacion: .12, escala: 7, mojado: {cobertura: .12, rugosidad: .35, oscurecer: .15}}},
  concreto: {normal: 'concreto_n', fuerza: .55, procedural: {frecuencia: 9, amplitud: .003}},
  muro: {normal: 'muro_n', fuerza: .7},
  ladrillo: {normal: 'ladrillo_n', fuerza: 1}
};
// Atajo para app.js: aplica el preset del detalle con la MISMA escala que addDetail. Los prados grandes (escala ≥ 8) reciben parches secos.
export function relieveParaDetalle(mat, nombre, escala = 6) {
  const p = PRESETS_RELIEVE[nombre];
  if (!p) return mat;
  const cesped = nombre === 'pasto' && escala >= 8;
  return mejorarMaterial(mat, {...p, normalTex: p.normal ? texturaRelieve(p.normal) : null, escala, ...(cesped ? {manchas: {escala: 16, fuerza: .45, tinte: '#f0e6a8'}} : {})});
}

// ───────────────────────── Estadísticas (pruebas / depuración) ─────────────────────────
export function estadisticas(obj) {
  const geos = new Set(); let tris = 0, verts = 0, mallas = 0, instancias = 0;
  obj.traverse(o => {
    if (!o.isMesh) return;
    mallas++; const g = o.geometry, n = o.isInstancedMesh ? o.count : 1; instancias += n;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * n; verts += g.attributes.position.count * n; geos.add(g);
  });
  let bytes = 0; for (const g of geos) { for (const k in g.attributes) bytes += g.attributes[k].array.byteLength; if (g.index) bytes += g.index.array.byteLength; }
  return {triangulos: tris, vertices: verts, mallas, instancias, geometriasUnicas: geos.size, bytesGeometriaUnica: bytes};
}
