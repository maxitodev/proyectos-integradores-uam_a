// Plaza trasera, letras «soy uam» y franja del costado de la unidad (Práctica 3, parte de Daniela Nava Martínez).
// Reconstruidos con fotos de campo (23 oct 2026) y Esri World Imagery z19; posiciones y medidas aproximadas.
// construirPlazaTrasera y construirCostado reciben el grupo del marco CU_FRAME (x = u local, z = v local, en metros);
// construirLetrero recibe su propio grupo editable con origen en el centro de la base de las letras.
// Peso en el GLB: lo repetido (bolardos, jardineras, postes, setos, mesas) comparte una geometría de módulo y cada pieza
// es sólo un nodo con traslación; lo único (pavimento, juntas, letras) va en mallas indexadas propias.
import * as THREE from 'three';
import {trazo, arco} from 'geometria';
import {crearArbol, crearPersona} from 'vegetacion';

// Niveles comunes (cara superior, m).
const PREDIO = .1, PLAZA = .34, FRANJA = .30;
const NARANJA = '#d9661f', BLANCO = '#f4f3ee';
// Concreto gris con agregado de las jardineras-banca (más oscuro que la plaza; pedir textura en DETAIL: '#8f8e86': ['concreto', 2.5]).
const CONCRETO_JARDINERA = '#8f8e86';

// ───────────── Malla indexada: vértices compartidos donde la normal lo permite (menos bytes que caras sueltas) ─────────────
class Malla {
  constructor() { this.p = []; this.n = []; this.i = []; }
  get nv() { return this.p.length / 3; }
  v(p, n) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); return this.nv - 1; }
  // Triángulo orientado hacia la normal n (así no importa el sentido en que llegan los vértices).
  t(a, b, c, n) {
    const P = this.p, ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az, vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
    if ((uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  q(a, b, c, d, n) { this.t(a, b, c, n); this.t(a, c, d, n); }
  // Triángulo suelto con su normal plana (hojas).
  plano(a, b, c) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l * (n[1] < 0 ? -1 : 1));
    this.t(this.v(a, n), this.v(b, n), this.v(c, n), n);
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
  malla(parent, nombre, material, {sombra = true, recibe = true} = {}) {
    if (!this.i.length) return null;
    const m = new THREE.Mesh(this.geometria(), material);
    m.name = nombre; m.castShadow = sombra; m.receiveShadow = recibe; parent.add(m);
    return m;
  }
}

// ───────────── Primitivas ─────────────
const area2 = c => c.reduce((s, p, k) => { const q = c[(k + 1) % c.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
function limpiar(c) {
  const r = [];
  for (const p of c) { const u = r[r.length - 1]; if (!u || Math.hypot(p[0] - u[0], p[1] - u[1]) > 1e-4) r.push(p); }
  while (r.length > 2 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-4) r.pop();
  return r;
}
// Prisma recto de una forma 2D (contorno y agujeros) entre las profundidades d0 y d1.
// eje 'z': u→x, v→y, d→z (letras). eje 'y': u→x, v→z, d→y (losas). Las aristas con quiebre menor que «suave» comparten normal.
function prisma(m, contorno, agujeros, d0, d1, {eje = 'z', ox = 0, oy = 0, inferior = true, suave = 40} = {}) {
  const P = eje === 'z' ? (u, v, d) => [ox + u, oy + v, d] : (u, v, d) => [ox + u, d, oy + v];
  const N = eje === 'z' ? (a, b, c) => [a, b, c] : (a, b, c) => [a, c, b];
  let c = limpiar(contorno); if (area2(c) < 0) c = c.reverse();
  const hs = agujeros.map(h => { const l = limpiar(h); return area2(l) > 0 ? l.reverse() : l; });
  const todos = [c, ...hs].flat();
  const caras = THREE.ShapeUtils.triangulateShape(c.map(p => new THREE.Vector2(p[0], p[1])), hs.map(h => h.map(p => new THREE.Vector2(p[0], p[1]))));
  for (const [d, s] of inferior ? [[d1, 1], [d0, -1]] : [[d1, 1]]) {
    const n = N(0, 0, s), base = m.nv;
    for (const [u, v] of todos) m.v(P(u, v, d), n);
    for (const [a, b, e] of caras) m.t(base + a, base + b, base + e, n);
  }
  const lim = Math.cos(suave * Math.PI / 180);
  for (const L of [c, ...hs]) {
    const k = L.length, nrm = [], ini = [], fin = [];
    for (let j = 0; j < k; j++) { const a = L[j], b = L[(j + 1) % k], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1; nrm.push([dv / l, -du / l]); }
    for (let j = 0; j < k; j++) {
      const nA = nrm[(j - 1 + k) % k], nB = nrm[j], [u, v] = L[j];
      const par = ([a, b]) => { const n = N(a, b, 0); return [m.v(P(u, v, d1), n), m.v(P(u, v, d0), n)]; };
      if (nA[0] * nB[0] + nA[1] * nB[1] > lim) { const sx = nA[0] + nB[0], sy = nA[1] + nB[1], l = Math.hypot(sx, sy) || 1, pr = par([sx / l, sy / l]); fin[(j - 1 + k) % k] = pr; ini[j] = pr; }
      else { fin[(j - 1 + k) % k] = par(nA); ini[j] = par(nB); }
    }
    for (let j = 0; j < k; j++) m.q(ini[j][0], ini[j][1], fin[j][1], fin[j][0], N(nrm[j][0], nrm[j][1], 0));
  }
}
// Tronco de cono vertical (lados lisos), opcionalmente con tapa superior.
function cono(m, cx, cz, y0, y1, r0, r1, lados, tapa = false) {
  const base = m.nv, dr = (r0 - r1) / (y1 - y0), l = Math.hypot(1, dr);
  for (let j = 0; j < lados; j++) { const a = 2 * Math.PI * j / lados, c = Math.cos(a), s = Math.sin(a), n = [c / l, dr / l, s / l]; m.v([cx + r1 * c, y1, cz + r1 * s], n); m.v([cx + r0 * c, y0, cz + r0 * s], n); }
  for (let j = 0; j < lados; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % lados), am = 2 * Math.PI * (j + .5) / lados; m.q(a, a + 1, b + 1, b, [Math.cos(am), 0, Math.sin(am)]); }
  if (tapa) disco(m, cx, cz, y1, r1, lados);
}
function disco(m, cx, cz, y, r, lados) {
  const base = m.nv, n = [0, 1, 0]; m.v([cx, y, cz], n);
  for (let j = 0; j < lados; j++) { const a = 2 * Math.PI * j / lados; m.v([cx + r * Math.cos(a), y, cz + r * Math.sin(a)], n); }
  for (let j = 0; j < lados; j++) m.t(base, base + 1 + j, base + 1 + (j + 1) % lados, n);
}
function anillo(m, cx, cz, y, rIn, rOut, lados) {
  const base = m.nv, n = [0, 1, 0];
  for (let j = 0; j < lados; j++) { const a = 2 * Math.PI * j / lados, c = Math.cos(a), s = Math.sin(a); m.v([cx + rOut * c, y, cz + rOut * s], n); m.v([cx + rIn * c, y, cz + rIn * s], n); }
  for (let j = 0; j < lados; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % lados); m.q(a, a + 1, b + 1, b, n); }
}
// Tubo liso entre dos puntos [x,y,z] (sin tapas).
function tubo(m, a, b, r, lados = 6) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), base = m.nv;
  e1.set(Math.abs(d.y) < .9 * d.length() ? 0 : 1, Math.abs(d.y) < .9 * d.length() ? 1 : 0, 0).cross(d).normalize(); e2.crossVectors(d, e1).normalize();
  for (let j = 0; j < lados; j++) {
    const t = 2 * Math.PI * j / lados, n = e1.clone().multiplyScalar(Math.cos(t)).addScaledVector(e2, Math.sin(t));
    m.v([a[0] + n.x * r, a[1] + n.y * r, a[2] + n.z * r], n.toArray()); m.v([b[0] + n.x * r, b[1] + n.y * r, b[2] + n.z * r], n.toArray());
  }
  for (let j = 0; j < lados; j++) { const p = base + 2 * j, q = base + 2 * ((j + 1) % lados); const nm = [m.n[3 * p] + m.n[3 * q], m.n[3 * p + 1] + m.n[3 * q + 1], m.n[3 * p + 2] + m.n[3 * q + 2]]; m.q(p, p + 1, q + 1, q, nm); }
}
// Caja w×h×d centrada en (x,y,z) y girada rotY; o viga de sección w×h entre dos puntos.
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
const CARAS = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
function cajaM(m, mat, omitir = '') { // omitir: 'base' (cara -y) o 'tapas' (caras ±y: extremos de una viga)
  const nm = new THREE.Matrix3().getNormalMatrix(mat), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [f, s, t] of CARAS) {
    if ((omitir === 'base' && f[1] === -1) || (omitir === 'tapas' && f[1] !== 0)) continue;
    n.set(...f).applyMatrix3(nm).normalize(); const nn = n.toArray(), idx = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { p.set(f[0] + a * s[0] + b * t[0], f[1] + a * s[1] + b * t[1], f[2] + a * s[2] + b * t[2]).multiplyScalar(.5).applyMatrix4(mat); idx.push(m.v(p.toArray(), nn)); }
    m.q(idx[0], idx[1], idx[2], idx[3], nn);
  }
}
const caja = (m, x, y, z, w, h, d, rot = 0, omitir = '') => cajaM(m, _M.compose(_V.set(x, y, z), _Q.setFromAxisAngle(_Y, rot), _S.set(w, h, d)), omitir);
function viga(m, a, b, w, h = w) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), l = d.length();
  cajaM(m, _M.compose(A.addScaledVector(d, .5), _Q.setFromUnitVectors(_Y, d.normalize()), _S.set(w, l, h)), 'tapas');
}
// Cintas planas sobre el piso (juntas): segmentos [[x0,z0],[x1,z1]].
function cintas(m, segs, ancho, y) {
  const n = [0, 1, 0];
  for (const [[ax, az], [bx, bz]] of segs) {
    const l = Math.hypot(bx - ax, bz - az); if (l < .01) continue;
    const ux = (bz - az) / l * ancho / 2, uz = -(bx - ax) / l * ancho / 2;
    m.q(m.v([ax + ux, y, az + uz], n), m.v([bx + ux, y, bz + uz], n), m.v([bx - ux, y, bz - uz], n), m.v([ax - ux, y, az - uz], n), n);
  }
}
function azar(semilla) { let a = semilla >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────────── Geometrías y materiales compartidos (se crean una vez; nunca llevan disposeMaterial) ─────────────
const GEO = new Map();
const geo = (clave, fabrica) => { if (!GEO.has(clave)) GEO.set(clave, fabrica()); return GEO.get(clave); };
const MAT_JUNTA = new THREE.MeshStandardMaterial({name: 'Junta_pavimento', color: '#a29e92', roughness: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
const MAT_PLANTA = new THREE.MeshStandardMaterial({name: 'Hojas_agave', color: '#5f8f5b', roughness: .8, side: THREE.DoubleSide});
let MAT_MALLA = null, MAT_ROTULO = null;
// Paño de malla ciclónica: rombo de alambre en un mosaico de 32 px repetido por UV (semitransparente de lejos).
function materialMalla() {
  if (!MAT_MALLA) {
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    x.strokeStyle = '#e6e9e7'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(0, 16); x.lineTo(16, 0); x.lineTo(32, 16); x.lineTo(16, 32); x.closePath(); x.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    MAT_MALLA = new THREE.MeshStandardMaterial({name: 'Malla_ciclonica', color: '#a7adab', map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: .6});
  }
  return MAT_MALLA;
}
// Rótulo «Unidad Cuajimalpa» de la base: texto blanco espaciado y dos sellos circulares sobre el mismo naranja de la base.
function materialRotulo() {
  if (!MAT_ROTULO) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 48; const x = c.getContext('2d');
    x.fillStyle = NARANJA; x.fillRect(0, 0, 768, 48);
    const txt = 'Unidad Cuajimalpa', paso = 33, x0 = 384 - paso * (txt.length - 1) / 2;
    x.fillStyle = '#fbf7f0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '600 30px "DejaVu Sans Mono", "Courier New", monospace';
    for (let k = 0; k < txt.length; k++) x.fillText(txt[k], x0 + paso * k, 25);
    for (const cx of [x0 - 38, x0 + paso * (txt.length - 1) + 38]) {
      x.fillStyle = '#fbf7f0'; x.beginPath(); x.arc(cx, 25, 11, 0, 2 * Math.PI); x.fill();
      x.fillStyle = NARANJA; x.font = 'bold 9px sans-serif'; x.fillText('uam', cx, 26);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    MAT_ROTULO = new THREE.MeshStandardMaterial({name: 'Rotulo_Unidad_Cuajimalpa', map: t, roughness: .88});
  }
  return MAT_ROTULO;
}
// Jardinera-banca circular (foto 3): anillo-asiento ancho y bajo, maceta central cónica y tierra. Origen en el piso.
const geoJardinera = () => geo('jardinera', () => {
  const m = new Malla(), L = 16;
  cono(m, 0, 0, -.06, .40, 1.5, 1.55, L); anillo(m, 0, 0, .40, .72, 1.55, L);
  cono(m, 0, 0, .40, 1.08, .72, .63, L); anillo(m, 0, 0, 1.08, .52, .63, L); disco(m, 0, 0, 1.065, .52, 8);
  return m.geometria();
});
// Roseta de hojas largas y puntiagudas (agave / dracena de las fotos 3 y 5). Origen en la tierra.
const geoAgave = () => geo('agave', () => {
  const m = new Malla(), r = azar(37);
  const hoja = (a, L, h, w, y0) => {
    const c = Math.cos(a), s = Math.sin(a), px = -s * w, pz = c * w;
    const b = [c * .05, y0, s * .05], mi = [c * L * .45, y0 + h * .78, s * L * .45], pu = [c * L, y0 + h, s * L];
    m.plano(b, [mi[0] + px, mi[1], mi[2] + pz], pu); m.plano(b, pu, [mi[0] - px, mi[1], mi[2] - pz]);
  };
  for (let k = 0; k < 11; k++) hoja(2 * Math.PI * k / 11 + r() * .3, .62 + r() * .22, .28 + r() * .3, .08, 0);
  for (let k = 0; k < 5; k++) hoja(2 * Math.PI * k / 5 + r(), .2 + r() * .14, .62 + r() * .22, .06, .02);
  return m.geometria();
});
const geoBolardo = () => geo('bolardo', () => { const m = new Malla(); cono(m, 0, 0, -.05, .80, .12, .12, 8); cono(m, 0, 0, .80, .9, .12, .07, 8, true); return m.geometria(); });
const geoBote = () => geo('bote', () => { const m = new Malla(); cono(m, 0, 0, 0, .88, .25, .29, 10); return m.geometria(); });
const geoTapaBote = () => geo('tapa_bote', () => { const m = new Malla(); cono(m, 0, 0, .86, .96, .31, .29, 10, true); return m.geometria(); });
const geoLuzPiso = () => geo('luz_piso', () => { const m = new Malla(); disco(m, 0, 0, 0, .07, 10); return m.geometria(); });
const geoPosteMalla = () => geo('poste_malla', () => { const m = new Malla(); cono(m, 0, 0, 0, 2.1, .035, .035, 6, true); return m.geometria(); });
const geoPosteBarandal = () => geo('poste_barandal', () => { const m = new Malla(); cono(m, 0, 0, -.02, 1.02, .028, .028, 6, true); return m.geometria(); });
// Seto bajo redondeado: semi-superelipsoide algo irregular; cada nodo lo escala a (largo/2, alto, ancho/2).
const geoSeto = () => geo('seto', () => {
  const S = 12, R = 5, pos = [], idx = [], r = azar(11), e = .55;
  pos.push(0, 1, 0);
  for (let i = 1; i <= R; i++) {
    const f = i / R * Math.PI / 2, sf = Math.sin(f), cf = Math.cos(f);
    for (let j = 0; j < S; j++) {
      const t = 2 * Math.PI * j / S, ct = Math.cos(t), st = Math.sin(t), k = i < R ? .94 + r() * .12 : 1;
      pos.push(Math.sign(ct) * Math.abs(ct) ** e * Math.abs(sf) ** e * k, i < R ? Math.abs(cf) ** e * (.95 + r() * .08) : 0, Math.sign(st) * Math.abs(st) ** e * Math.abs(sf) ** e * k);
    }
  }
  for (let j = 0; j < S; j++) idx.push(0, 1 + (j + 1) % S, 1 + j);
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < S; j++) { const a = 1 + i * S + j, b = 1 + i * S + (j + 1) % S, c = a + S, d = b + S; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
});
// Mesa de picnic sin techo con dos bancas y patas en A (foto 4). Largo a lo largo de x. Origen en el piso.
const geoMesa = () => geo('mesa', () => {
  const m = new Malla();
  caja(m, 0, .74, 0, 1.8, .05, .74); for (const s of [-1, 1]) caja(m, 0, .45, s * .62, 1.8, .05, .28);
  for (const x of [-.66, .66]) { for (const s of [-1, 1]) viga(m, [x, 0, s * .72], [x, .72, s * .12], .06); viga(m, [x, .42, -.78], [x, .42, .78], .06); }
  return m.geometria();
});
// Redondeo a milímetros: el GLB escribe cada traslación con todos sus decimales.
const r3 = v => Math.round(v * 1000) / 1000;
function pieza(parent, nombre, geometria, material, x, y, z, {rot = 0, esc, sombra = true} = {}) {
  const o = new THREE.Mesh(geometria, material); o.name = nombre; o.position.set(r3(x), r3(y), r3(z));
  if (rot) o.rotation.y = rot; if (esc) o.scale.set(...esc.map(r3));
  o.castShadow = sombra; o.receiveShadow = true; parent.add(o); return o;
}
function persona(vida, x, y, z, giro, pose, semilla) { const p = crearPersona({semilla, pose}); p.position.set(x, y, z); p.rotation.y = giro; vida.add(p); }
function arbol(parent, x, z, tipo, tamano, semilla, elevacion) { const a = crearArbol({tipo, tamano, semilla, elevacion}); a.name = 'Árbol_' + tipo; a.userData.arbol = true; a.position.set(x, 0, z); parent.add(a); return a; }

// ───────────── 1) Plaza trasera ─────────────
// Contorno medido en la ortofoto: remetimiento, franja frente al bloque poniente (sin pisar el foro x -31…-1, z ≥ 41.5) y frente al bloque +u.
const CONTORNO_PLAZA = [[-41.2, 38.3], [-38.85, 38.3], [-38.85, 40.92], [-16.53, 40.92], [-16.53, 33.56], [15.32, 33.56], [15.32, 41.41], [36, 41.41], [36, 45.5],
  [-1, 45.5], [-1, 41.5], [-31, 41.5], [-31, 42.6], ...arco(-40, 41.4, 1.2, Math.PI / 2, Math.PI, 4)];
// Andador sur (beige en la ortofoto), con remate redondeado donde arranca el andador lateral.
const CONTORNO_ANDADOR = [[-1, 45.5], ...arco(36, 47.4, 1.9, -Math.PI / 2, Math.PI / 2, 10), [-1, 49.3]];
// Jardineras-banca circulares: [x, z, escala, con árbol]. Las dos del remetimiento y la de la esquina poniente están medidas;
// la del frente del bloque +u explica la copa oscura de la ortofoto (x 23…30) y es interpretación.
const JARDINERAS = [[-15, 37.5, 1], [-11, 37.5, 1], [-40, 41.1, .75], [26.5, 43.4, 1, true]];
// Postes blancos del borde del foro. Fila completa (pedida al principio): Array.from({length: 9}, (_, k) => -30 + 3.5 * k).
// Los postes blancos junto a los pies del arco los dibuja el Ágora (con sus cadenas); aquí no se repiten.
const BOLARDOS_X = [];

export function construirPlazaTrasera(sector, ctx) {
  const g = new THREE.Group(); g.name = 'Plaza_trasera'; g.userData = {approximate: true, referencia: 'Fotos 1, 3 y 5 y ortofoto Esri z19'}; sector.add(g);
  // Pavimentos: losas con canto vertical (el canto hacia el foro marca el escalón a 0.22).
  const piso = new Malla(); prisma(piso, CONTORNO_PLAZA, [], .04, PLAZA, {eje: 'y', inferior: false}); piso.malla(g, 'Pavimento_plaza_trasera', ctx.material('#d6d3c5'), {sombra: false});
  const andador = new Malla(); prisma(andador, CONTORNO_ANDADOR, [], .04, PLAZA, {eje: 'y', inferior: false}); andador.malla(g, 'Andador_sur', ctx.material('#d5cbb1'), {sombra: false});
  // Juntas del colado: módulos de 3.6 m alineados al edificio en la plaza y cortes transversales en el andador.
  const segs = [];
  for (let x = -14.4; x < 15.3; x += 3.6) segs.push([[x, 33.56], [x, x >= -1 ? 45.5 : 41.5]]);
  for (let x = 18; x < 36; x += 3.6) segs.push([[x, 41.41], [x, 45.5]]);
  segs.push([[-16.53, 37.53], [15.32, 37.53]], [[-1, 43.5], [36, 43.5]], [[-1, 45.5], [36, 45.5]], [[-38.85, 41.5], [-31, 41.5]]);
  for (let x = 2.6; x < 36; x += 3.6) segs.push([[x, 45.5], [x, 49.3]]);
  const juntas = new Malla(); cintas(juntas, segs, .035, PLAZA + .004); juntas.malla(g, 'Juntas_pavimento', MAT_JUNTA, {sombra: false});

  // Jardineras-banca circulares de concreto con agaves (foto 3) y, en una, un árbol.
  const concreto = ctx.material(CONCRETO_JARDINERA);
  JARDINERAS.forEach(([x, z, e, conArbol], k) => {
    const j = new THREE.Group(); j.name = 'Jardinera_banca_circular'; j.position.set(x, PLAZA, z); if (e !== 1) j.scale.setScalar(e); g.add(j);
    pieza(j, 'Banca_circular_concreto', geoJardinera(), concreto, 0, 0, 0);
    pieza(j, 'Agaves_jardinera', geoAgave(), MAT_PLANTA, 0, 1.065, 0, {rot: k * 1.9, esc: conArbol ? [.7, .6, .7] : undefined});
    if (conArbol) arbol(j, 0, 0, 'fresno', .62, 'plaza:' + k, 1.06);
  });
  // Jardinera lineal al pie de la celosía (franja oscura de la ortofoto, plantas de la foto 5).
  ctx.box(g, 'Jardinera_lineal_celosia', -11.55, PLAZA + .2, 35.2, 9.5, .5, 1.05, CONCRETO_JARDINERA);
  for (let k = 0; k < 8; k++) pieza(g, 'Agave_jardinera_lineal', geoAgave(), MAT_PLANTA, -15.75 + k * 1.2, PLAZA + .44, 35.2, {rot: k * 2.3, esc: [.62, .55 + (k % 3) * .1, .62]});
  for (const x of [-7.4]) { ctx.box(g, 'Banca_asiento', x, PLAZA + .44, 36.35, 1.9, .07, .48, '#4d5250'); for (const s of [-.75, .75]) ctx.box(g, 'Banca_apoyo', x + s, PLAZA + .2, 36.35, .08, .42, .42, '#4d5250'); }
  // Jardinera lineal entre la plaza y el andador sur (banda oscura de la ortofoto; interpretación) con setos.
  ctx.box(g, 'Jardinera_lineal_sur', 11.5, PLAZA + .17, 44.5, 20, .44, 1.4, CONCRETO_JARDINERA);
  for (const [x, l] of [[4.6, 6], [11.5, 6.4], [18.3, 6]]) pieza(g, 'Seto_jardinera_sur', geoSeto(), ctx.material('#3f8048'), x, PLAZA + .38, 44.5, {esc: [l / 2, .62, .55]});

  // Postes blancos al borde del foro, frente a los pies del arco delantero (fotos 2 y 5: de ellos sube el tirante del arco).
  // La foto 3, tomada entre las jardineras medidas, no muestra postes en medio del borde: por eso no hay una fila completa.
  for (const x of BOLARDOS_X) pieza(g, 'Bolardo_blanco', geoBolardo(), ctx.material('#efeee8'), x, PLAZA, 41.22);
  // Botes de basura naranjas (fotos 2 y 5).
  for (const [x, z] of [[-2.9, 40.35], [16.4, 42.3]]) {
    const b = new THREE.Group(); b.name = 'Bote_basura_naranja'; b.position.set(x, PLAZA, z); g.add(b);
    pieza(b, 'Bote_cuerpo', geoBote(), ctx.material('#e0662b'), 0, 0, 0); pieza(b, 'Bote_tapa', geoTapaBote(), ctx.material('#3b403d'), 0, 0, 0);
  }
  // Barandal metálico en la orilla sur del andador, hacia el talud.
  const bar = new THREE.Group(); bar.name = 'Barandal_andador_sur'; g.add(bar);
  for (let k = 0; k <= 15; k++) pieza(bar, 'Poste_barandal', geoPosteBarandal(), ctx.material('#7f8784'), k * 34 / 15, PLAZA, 49.12);
  const rieles = new Malla(); for (const y of [.5, .98]) tubo(rieles, [0, PLAZA + y, 49.12], [34, PLAZA + y, 49.12], .026, 6);
  rieles.malla(bar, 'Pasamanos_barandal', ctx.material('#7f8784'));

  // Vida (el plano 2D la oculta): visitantes con las letras, en la plaza y en el andador sur.
  const vida = new THREE.Group(); vida.name = 'Vida_decorativa'; vida.userData = {decorativo: true}; g.add(vida);
  persona(vida, -.6, PLAZA, 38.25, 0, 'pie', 301); persona(vida, .4, PLAZA, 43.1, Math.PI, 'pie', 303); persona(vida, 14, PLAZA, 47.2, Math.PI / 2, 'camina', 305);
}

// ───────────── 2) Letras «soy uam» ─────────────
// Minúsculas de trazo grueso tipo grotesca (foto 1): altura 2.1 m, trazo 0.5 m, 0.5 m de grueso. Contornos 2D (x a la derecha, y arriba, base y = 0).
const H = 2.1, T = .5;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const superelipse = (cx, cy, rx, ry, n, e = 2.5) => Array.from({length: n}, (_, k) => { const t = 2 * Math.PI * k / n, c = Math.cos(t), s = Math.sin(t); return [cx + rx * Math.sign(c) * Math.abs(c) ** (2 / e), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / e)]; });
const GLIFOS = {
  s(W) { // dos óvalos encadenados: el de arriba en sentido antihorario y el de abajo en horario
    const a = (W - T) / 2, b = (H - T) / 4, p = [];
    for (let k = 0; k <= 10; k++) { const t = (32 + 238 * k / 10) * Math.PI / 180; p.push([W / 2 + a * Math.cos(t), H / 2 + b + b * Math.sin(t)]); }
    for (let k = 1; k <= 10; k++) { const t = (90 - 238 * k / 10) * Math.PI / 180; p.push([W / 2 + a * Math.cos(t), H / 2 - b + b * Math.sin(t)]); }
    return [{c: trazo(p, T)}];
  },
  o: W => [{c: superelipse(W / 2, H / 2, W / 2, H / 2, 24, 2.1), h: [superelipse(W / 2, H / 2, W / 2 - .55, H / 2 - .42, 16, 2.3)]}],
  Y(W) { // la «y» de la foto es una Y de brazos rectos a la altura de las minúsculas
    const cx = W / 2, s = .28, yJ = .88, th = Math.atan2(W - cx - s, H - yJ), a = T / Math.cos(th), yC = H - (W - a - cx) / Math.tan(th);
    return [{c: [[cx - s, 0], [cx + s, 0], [cx + s, yJ], [W, H], [W - a, H], [cx, yC], [a, H], [0, H], [cx - s, yJ]]}];
  },
  u(W) { const xL = T / 2, xR = W - T / 2, r = (xR - xL) / 2; return [{c: trazo([[xL, H], ...arco(W / 2, T / 2 + r, r, Math.PI, 2 * Math.PI, 9)], T)}, {c: rect(W - T, 0, W, H)}]; },
  a(W) { // «a» de dos pisos: asta con gancho superior y panza con ojo
    const xs = W - T / 2, rh = .48, yh = H - T / 2 - rh;
    return [{c: trazo([[xs, 0], ...arco(xs - rh, yh, rh, 0, 2.6, 8)], T)}, {c: superelipse(.68, .6, .68, .6, 20, 2.3), h: [superelipse(.69, .6, .26, .24, 12, 2.4)]}];
  },
  m(W) {
    const x1 = T / 2, x3 = W - T / 2, x2 = (x1 + x3) / 2, r = (x2 - x1) / 2, yA = H - T / 2 - r;
    return [{c: rect(0, 0, T, H)}, {c: trazo([...arco((x1 + x2) / 2, yA, r, Math.PI, 0, 8), [x2, 0]], T)}, {c: trazo([...arco((x2 + x3) / 2, yA, r, Math.PI, 0, 8), [x3, 0]], T)}];
  }
};
// Anchos medidos en la foto 1 (en proporción a la altura), con 5 cm entre letras y un espacio entre «soy» y «uam».
const PALABRA = [['s', 1.45], ['o', 1.74], ['Y', 1.72], [' ', .27], ['u', 1.55], ['a', 1.5], ['m', 2.7]];
const BASE_ALTO = .55, BASE_LARGO = 12, BASE_FONDO = 1, LETRA_FONDO = .5;

export function construirLetrero(g, ctx) {
  // Base naranja en cuatro tramos (juntas visibles en la foto 1); arranca en y = 0 para quedar asentada en la plaza (0.34) o en el pasto.
  const tope = PLAZA + BASE_ALTO, cortes = [-BASE_LARGO / 2, -3.5, -.7, 2.6, BASE_LARGO / 2];
  for (let k = 0; k < 4; k++) { const a = cortes[k] + (k ? .012 : 0), b = cortes[k + 1] - (k < 3 ? .012 : 0); ctx.box(g, 'Base_letrero_naranja', (a + b) / 2, tope / 2, 0, b - a, tope, BASE_FONDO, NARANJA); }
  // Letras: una sola malla blanca para todo el texto.
  const letras = new Malla(), centros = [];
  const total = PALABRA.reduce((s, [, w]) => s + w, 0) + .05 * (PALABRA.length - 1);
  let x = -total / 2 - .08; // en la foto sobra un poco más de base a la derecha de la «m»
  for (const [l, w] of PALABRA) {
    if (GLIFOS[l]) { for (const f of GLIFOS[l](w)) prisma(letras, f.c, f.h || [], -LETRA_FONDO / 2, LETRA_FONDO / 2, {eje: 'z', ox: x, oy: tope, suave: 32}); centros.push(x + w / 2); }
    x += w + .05;
  }
  letras.malla(g, 'Letras_soy_uam', ctx.material(BLANCO));
  // Luminarias de piso empotradas en la base, delante de cada letra (foto 5).
  for (const c of centros) pieza(g, 'Luminaria_piso_letrero', geoLuzPiso(), ctx.material('#cfd2cf'), c, tope + .003, .37, {sombra: false});
  // Rótulo al frente de la base, un poco a la izquierda del centro como en la foto 1.
  const ancho = 5.6, rotulo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho / 16), materialRotulo()); // lienzo 768×48
  rotulo.name = 'Rotulo_base_Unidad_Cuajimalpa'; rotulo.position.set(-.7, PLAZA + BASE_ALTO / 2, BASE_FONDO / 2 + .004); rotulo.receiveShadow = true; g.add(rotulo);
}

// ───────────── 3) Costado +u ─────────────
// Franja entre el edificio y la malla (foto 4 y ortofoto l_costado_gris): andador de concreto junto a la fachada, canaleta, pasto con setos,
// mesas de picnic y árboles jóvenes. Setos: [x, z, largo (z), ancho (x), alto, giro].
const SETOS = [[40.6, 20.4, 3.8, 1.5, .85, .1], [42.5, 15.1, 2.6, 1.3, .8, -.2], [39.4, 12.0, 2.2, 1.2, .75, .3], [42.6, 6.6, 3.2, 1.4, .9, 0], [39.9, 1.5, 4.2, 1.6, .85, -.1],
  [42.8, -4.6, 2.4, 1.2, .8, .25], [39.4, -9.4, 3.4, 1.4, .9, 0], [42.4, -15.0, 3.6, 1.5, .85, -.15], [40.0, -19.9, 2.6, 1.3, .8, .2], [42.9, -21.9, 1.6, 1.1, .7, 0]];
const MESAS = [[40.0, 16.4], [40.6, 9.2], [41.4, -1.9], [40.4, -12.9]];
// Malla junto a la fachada, entre las dos torres de escaleras (foto 4): separa la franja de servicio de los setos y las mesas.
const MALLA_X = 37.6, MALLA_Z0 = -23.5, MALLA_Z1 = 23.5;

export function construirCostado(sector, ctx) {
  const g = new THREE.Group(); g.name = 'Costado_setos_y_mesas'; g.userData = {approximate: true, referencia: 'Foto 4 y ortofoto Esri z19'}; sector.add(g);
  const yb = (FRANJA + PREDIO) / 2, hb = FRANJA - PREDIO + .06;
  ctx.box(g, 'Franja_costado_concreto', 39.5, yb - .03, 0, 9, hb, 48, '#c9c8bf');
  ctx.box(g, 'Franja_frente_torre_este', 43, yb - .03, -32, 2, hb, 16, '#c9c8bf');
  ctx.box(g, 'Franja_frente_torre_sur', 43, yb - .03, 30.5, 2, hb, 13, '#c9c8bf');
  ctx.box(g, 'Pasto_franja_costado', 41.03, FRANJA, 0, 5.94, .04, 47.4, '#6a9a46');
  ctx.box(g, 'Canaleta_costado', 37.8, FRANJA - .01, 0, .5, .03, 47.4, '#d3cfc4');
  for (const [x, z] of MESAS) {
    ctx.box(g, 'Firme_mesa_picnic', x, FRANJA + .012, z, 3, .04, 2.7, '#c9c8bf');
    pieza(g, 'Mesa_picnic', geoMesa(), ctx.material('#d9dad4'), x, FRANJA + .032, z);
  }
  for (const [x, z, l, w, h, r] of SETOS) pieza(g, 'Seto_bajo', geoSeto(), ctx.material('#3f8048'), x, FRANJA + .015, z, {rot: r, esc: [w / 2, h, l / 2]});
  arbol(g, 43.4, 11.0, 'jacaranda', .45, 'costado:1', FRANJA); arbol(g, 43.2, -8.4, 'fresno', .5, 'costado:2', FRANJA); arbol(g, 38.9, 22.8, 'fresno', .42, 'costado:3', FRANJA);
  // Malla ciclónica: postes grises cada 3 m, tubo superior y paño semitransparente.
  const malla = new THREE.Group(); malla.name = 'Malla_ciclonica_costado'; g.add(malla);
  for (let z = MALLA_Z0; z <= MALLA_Z1 + .01; z += 3) pieza(malla, 'Poste_malla', geoPosteMalla(), ctx.material('#8b918e'), MALLA_X, PREDIO, z);
  const tub = new Malla(); tubo(tub, [MALLA_X, PREDIO + 2.02, MALLA_Z0], [MALLA_X, PREDIO + 2.02, MALLA_Z1], .022, 6); tub.malla(malla, 'Tubo_superior_malla', ctx.material('#8b918e'));
  const L = MALLA_Z1 - MALLA_Z0, h = 1.95, pg = new THREE.BufferGeometry(), y0 = PREDIO + .05, rep = .09;
  pg.setAttribute('position', new THREE.Float32BufferAttribute([MALLA_X, y0, MALLA_Z0, MALLA_X, y0, MALLA_Z1, MALLA_X, y0 + h, MALLA_Z1, MALLA_X, y0 + h, MALLA_Z0], 3));
  pg.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L / rep, 0, L / rep, h / rep, 0, h / rep], 2));
  pg.setIndex([0, 1, 2, 0, 2, 3]);
  const pano = new THREE.Mesh(pg, materialMalla()); pano.name = 'Pano_malla_ciclonica'; malla.add(pano);
  const vida = new THREE.Group(); vida.name = 'Vida_decorativa'; vida.userData = {decorativo: true}; g.add(vida);
  persona(vida, 41.5, FRANJA + .03, 17.9, Math.PI, 'pie', 311); persona(vida, 36.2, FRANJA, -5, Math.PI, 'camina', 312);
}
