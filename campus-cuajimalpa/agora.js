// Ágora de la UAM Cuajimalpa. Diseño y propuesta original de Daniela Nava Martínez (issue #37, PR #45);
// reconstruido con fotos de campo (23 oct 2026) y Esri World Imagery z19. Medidas y alturas aproximadas.
// Coordenadas del grupo: x a lo largo del edificio (ESE, +u del marco CU_FRAME), z hacia el SSO (se aleja del edificio), y hacia arriba.
// El origen es el ancla medida (local CU (-16, 57)); el foro mira al edificio (−z) y las gradas suben hacia +z.
//
// Qué sale de dónde (ver también el informe de la Práctica 3):
//  · satélite: huella de la membrana (casco medido), tres columnas, borde del foro (z −15.5), mesas, bandas claras de la escalera.
//  · fotos 2, 3 y 5: arcos de armadura triangulada, membrana con tres picos y luminaria de anillo, bocinas line-array,
//    pantallas sobre andamio, 6 gradas curvas café rojizo con medio escalón y narices amarillas, muro poniente bajo con
//    barandal y talud con vegetación detrás, mesas con techito naranja, botes naranjas y bolardos.
//  · interpretación: alturas exactas, sección de las armaduras, curvatura fina de la membrana, escaleras del lado oriente.
//
// Peso: las geometrías son deterministas y se construyen UNA vez (caché del módulo); cada llamada sólo crea nodos.
// Las piezas de acero (armaduras, barandales, cables, andamios) van sin normales con sombreado plano: la mitad de bytes.
// Las piezas que se repiten (mástiles, luminarias, bocinas, pantallas, mesas, botes) comparten una sola geometría.
import * as THREE from 'three';
import {Combinador, trazo} from 'geometria';
import {crearArbol, crearPersona, prng, CONFIG} from 'vegetacion';

// ───────────────────────── Niveles (cara superior, m) y trazo ─────────────────────────
const Y_PREDIO = .1, Y_FORO = .22, Y_TERRAZA = 2.92, Y_BANCA = 1.42;
const PELDANO = .45, HUELLA = .9, N_GRADAS = 6, R_GRADAS = 29.6, CZ_GRADAS = -34, X_GRADAS = 11;
const PASILLOS = [-4.2, 4.2], MEDIO_PASILLO = .65;
const Z_BORDE_FORO = -15.5, X_FORO = [-15.6, 14.8];
const ARCO_FRONTAL = {xa: -15.6, xb: 15.6, yPie: 1.2, clave: 12.5, z: -12.6, peralte: .9, ancho: .9, nodos: 40, yEsquina: 6, colgado: .35};
const ARCO_TRASERO = {xa: -10.8, xb: 10.4, yPie: 3.72, clave: 9, z: 11.8, peralte: .75, ancho: .75, nodos: 26, yEsquina: 5.6, colgado: .3};
const MASTILES = [[-6.2, 1.6], [0, 1.8], [6.2, 1.6]], Y_ANILLO = 11.2, R_ANILLO = .8, R_MASTIL = .17, Y_CIMA = Y_ANILLO + .1;
// Anclas laterales de la membrana: punta del puntal (a, a Y_ANCLA), base del puntal sobre la terraza y muerto del tirante.
const ANCLAS = [{a: [-16.6, -.5], base: [-15.6, -.6], tirante: [-20.2, -.4]}, {a: [17.2, .3], base: [17.6, 1.0], tirante: [19.4, 1.3]}];
const Y_ANCLA = 6.2; // bordes laterales altos: desde la plaza se ve el foro bajo la membrana (fotos 2 y 5)
const MESAS = [[-20, 16, .06], [-16.5, 15.5, -.04], [-13, 13.6, .03], [-10, 13.7, -.05], [-6.5, 18.5, .08], [-7, 21.3, .02]];
const ZR = (R, x) => CZ_GRADAS + Math.sqrt(R * R - x * x); // z de un arco de las gradas (centro (0, −34)) en la abscisa x

// Terraza de pasto (y 2.92): borde superior de las gradas, muro hacia el foro al oriente, llegada de la escalera lateral,
// taludes exteriores hacia el predio y, al poniente, talud corto hasta el muro bajo (1.2 m) que da al foro.
const ARCO_SUPERIOR = Array.from({length: 17}, (_, i) => { const x = -X_GRADAS + 2 * X_GRADAS * i / 16; return [x, ZR(R_GRADAS + N_GRADAS * HUELLA, x)]; });
const TALUD = {tipo: 'talud', base: Y_PREDIO, corrida: 3.2};
const TERRAZA = [...ARCO_SUPERIOR, [14.8, -1.2], [14.8, .5], [17, .5], [20.6, .5], [12.6, 12.4], [9.5, 15.2], [2.5, 16.8], [-3, 19.6],
  [-4.6, 23.6], [-11, 25.2], [-18, 22.4], [-23.5, 18.5], [-25, 9], [-23.5, -1], [-20.6, -6], [-17.58, -8.95]];
const LADOS_TERRAZA = TERRAZA.map((_, i) => {
  if (i < 16) return {tipo: 'nada'};                                        // tapado por las gradas
  if (i === 16) return {tipo: 'muro', base: Y_PREDIO};                       // muro al foro, lado oriente
  if (i === 17 || i === 18) return {tipo: 'nada'};                           // alfarda y llegada de la escalera lateral
  if (i === TERRAZA.length - 1) return {tipo: 'talud', base: Y_BANCA, corrida: 2.4, muro: Y_PREDIO}; // talud poniente + muro bajo
  return TALUD;
});

// ───────────────────────── Materiales especiales (una sola vez) ─────────────────────────
// Sin userData.disposeMaterial: se comparten entre reconstrucciones. Los de acero usan sombreado plano (geometría sin normales).
const MAT = {
  armadura: new THREE.MeshStandardMaterial({name: 'Acero_blanco_armadura', color: '#f1f1ec', roughness: .5, metalness: .15, flatShading: true, side: THREE.DoubleSide}),
  acero: new THREE.MeshStandardMaterial({name: 'Acero_blanco', color: '#f1f1ec', roughness: .45, metalness: .15}),
  metal: new THREE.MeshStandardMaterial({name: 'Metal_galvanizado', color: '#a7abad', roughness: .45, metalness: .55, flatShading: true, side: THREE.DoubleSide}),
  cable: new THREE.MeshStandardMaterial({name: 'Cable_acero', color: '#6f7275', roughness: .55, metalness: .4, flatShading: true, side: THREE.DoubleSide}),
  membrana: new THREE.MeshStandardMaterial({name: 'Membrana_tensada_blanca', color: '#f7f6f1', roughness: .7, metalness: 0, side: THREE.DoubleSide, emissive: '#fff5e6', emissiveIntensity: .2}),
  luz: new THREE.MeshStandardMaterial({name: 'Luminaria_encendida', color: '#fff6e2', emissive: '#ffe6b8', emissiveIntensity: 2.6, roughness: .4}),
  pantalla: new THREE.MeshStandardMaterial({name: 'Pantalla_LED_apagada', color: '#0c0d0f', roughness: .5, metalness: 0}),
  bocina: new THREE.MeshStandardMaterial({name: 'Bocina_negra', color: '#1c1d1f', roughness: .72, metalness: .08}),
};
// Colores de ctx.material(): los de concreto, pasto y asfalto llevan textura (tabla DETAIL de app.js).
const COLOR = {
  foro: '#45484a', gradas: '#7f5747', nariz: '#e2b223', bandaRoja: '#a8695e', guarnicion: '#d6d3c5',
  pasto: '#6a9a46', talud: '#90aa81', muro: '#c9c8bf', escalera: '#c8c3b5', pedestal: '#d6d3c5',
  techoMesa: '#d9703c', mesa: '#8a6a56', bote: '#d8662a', boteBanda: '#2f8a5e', oscuro: '#3a3c3e',
};

// ───────────────────────── Utilidades vectoriales ─────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mezcla = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const newell = q => { const n = [0, 0, 0]; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return unit(n); };
const GEO = {}; // caché de geometrías del módulo (deterministas)
const geo = (clave, fabrica) => GEO[clave] || (GEO[clave] = fabrica());

// ───────────────────────── Constructores ligeros ─────────────────────────
// Malla con normales e índices compartidos: superficies de concreto, pasto y asfalto (materiales de ctx con textura).
class Malla {
  constructor() { this.p = []; this.n = []; this.i = []; }
  get vacia() { return !this.i.length; }
  v(q, n) { this.p.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); return this.p.length / 3 - 1; }
  // Polígono plano (puntos 3D coplanares) triangulado; la cara mira hacia 'normal'.
  plano(pts, normal) {
    if (pts.length < 3) return this;
    const n = unit(normal), e1 = unit(Math.abs(n[1]) < .9 ? cruz([0, 1, 0], n) : cruz([1, 0, 0], n)), e2 = cruz(n, e1), s = this.p.length / 3;
    for (const q of pts) this.v(q, n);
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(pts.map(q => new THREE.Vector2(pt(q, e1), pt(q, e2))), [])) {
      if (pt(cruz(sub(pts[b], pts[a]), sub(pts[c], pts[a])), n) >= 0) this.i.push(s + a, s + b, s + c); else this.i.push(s + a, s + c, s + b);
    }
    return this;
  }
  // Cuadrilátero (o triángulo) plano; si se da 'hacia', la cara se orienta hacia ese lado.
  cara(q, hacia) {
    let n = newell(q);
    if (hacia && pt(n, hacia) < 0) { q = [...q].reverse(); n = n.map(v => -v); }
    const s = this.p.length / 3; q.forEach(p => this.v(p, n));
    for (let k = 1; k < q.length - 1; k++) this.i.push(s, s + k, s + k + 1);
    return this;
  }
  // Franja entre dos filas de puntos con normales por vértice (superficies curvas).
  franja(A, B, nA, nB) {
    const s = this.p.length / 3, k = A.length;
    A.forEach((q, j) => this.v(q, nA[j])); B.forEach((q, j) => this.v(q, nB[j]));
    for (let j = 0; j < k - 1; j++) {
      const a = s + j, b = s + j + 1, c = s + k + j + 1, d = s + k + j;
      if (pt(cruz(sub(A[j + 1], A[j]), sub(B[j], A[j])), nA[j]) >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, c, b, a, d, c);
    }
    return this;
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}
// Lote sin normales (acero con sombreado plano): tubos continuos con anillos compartidos en las juntas.
class Lote {
  constructor() { this.p = []; this.i = []; }
  get vacio() { return !this.i.length; }
  tubo(pts, r, lados = 3) {
    const n = pts.length; if (n < 2) return this;
    const s = this.p.length / 3; let n1 = null;
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[k], c = pts[Math.min(n - 1, k + 1)], t1 = unit(sub(b, a)), t2 = unit(sub(c, b));
      const t = k === 0 ? t2 : k === n - 1 ? t1 : unit([t1[0] + t2[0], t1[1] + t2[1], t1[2] + t2[2]]);
      const cosm = k === 0 || k === n - 1 ? 1 : Math.max(.55, Math.sqrt(Math.max(0, (1 + pt(t1, t2)) / 2)));
      const ref = Math.abs(t[1]) < .95 ? [0, 1, 0] : [1, 0, 0];
      if (n1) { const d = pt(n1, t); n1 = [n1[0] - t[0] * d, n1[1] - t[1] * d, n1[2] - t[2] * d]; if (Math.hypot(...n1) < 1e-4) n1 = cruz(t, ref); }
      else n1 = cruz(t, ref);
      n1 = unit(n1);
      const n2 = cruz(t, n1), rr = r / cosm;
      for (let j = 0; j < lados; j++) {
        const th = 2 * Math.PI * j / lados, cs = Math.cos(th) * rr, sn = Math.sin(th) * rr;
        this.p.push(b[0] + n1[0] * cs + n2[0] * sn, b[1] + n1[1] * cs + n2[1] * sn, b[2] + n1[2] * cs + n2[2] * sn);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < lados; j++) {
      const a = s + k * lados + j, b = s + k * lados + (j + 1) % lados;
      this.i.push(a, b, b + lados, a, b + lados, a + lados);
    }
    return this;
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}
function malla(parent, nombre, geometria, material, {sombra = true, recibe = true} = {}) {
  const m = new THREE.Mesh(geometria, material); m.name = nombre; m.castShadow = sombra; m.receiveShadow = recibe; parent.add(m); return m;
}
// Une geometrías con posición y normal en una sola, con un grupo (material) por pieza.
function fusionar(geos, grupos = true) {
  const g = new THREE.BufferGeometry(), pos = [], nor = [], idx = []; let base = 0;
  geos.forEach((q, k) => {
    const p = q.attributes.position.array, n = q.attributes.normal.array, ix = q.index.array, ini = idx.length;
    for (let j = 0; j < p.length; j++) { pos.push(p[j]); nor.push(n[j]); }
    for (const i of ix) idx.push(i + base);
    if (grupos) g.addGroup(ini, ix.length, k);
    base += p.length / 3;
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
const CUBO = new THREE.BoxGeometry(1, 1, 1);
const caja = (c, m4) => c.agregar(CUBO, m4);
const matriz = (pos, rot = [0, 0, 0], esc = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...esc));

// ───────────────────────── Terreno: terraplén con taludes y muros ─────────────────────────
const signoArea = pts => Math.sign(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
function fueraDe(pts, i) { const sg = signoArea(pts), p = pts[i], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [sg * dz / l, -sg * dx / l]; }
function dentro(pts, x, z) { let v = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, az] = pts[i], [bx, bz] = pts[j]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) v = !v; } return v; }
// lados[i]: {tipo:'nada'} | {tipo:'muro', base} | {tipo:'talud', base, corrida, muro?} (muro = pie del muro bajo el talud).
function terraplen(pts, h, lados) {
  const tapa = new Malla(), talud = new Malla(), muro = new Malla(), n = pts.length, sg = signoArea(pts);
  tapa.plano(pts.map(([x, z]) => [x, h, z]), [0, 1, 0]);
  const pie = (i, k) => { const L = lados[i], [ox, oz] = fueraDe(pts, i), p = pts[(i + k) % n]; return [p[0] + ox * L.corrida, L.base, p[1] + oz * L.corrida]; };
  for (let i = 0; i < n; i++) {
    const L = lados[i], p = pts[i], q = pts[(i + 1) % n], [ox, oz] = fueraDe(pts, i), A = [p[0], h, p[1]], B = [q[0], h, q[1]];
    if (L.tipo === 'muro') muro.cara([A, B, [q[0], L.base, q[1]], [p[0], L.base, p[1]]], [ox, 0, oz]);
    else if (L.tipo === 'talud') {
      const D = pie(i, 0), C = pie(i, 1);
      talud.cara([A, B, C, D], [ox, 1, oz]);
      if (L.muro !== undefined) muro.cara([D, C, [C[0], L.muro, C[2]], [D[0], L.muro, D[2]]], [ox, 0, oz]);
    }
  }
  // Esquinas: abanico entre taludes en esquinas convexas; cierre lateral de un talud junto a un muro.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, Li = lados[i], Lj = lados[j], q = pts[j], Q = [q[0], h, q[1]], [ax, az] = fueraDe(pts, i), [bx, bz] = fueraDe(pts, j);
    const di = [q[0] - pts[i][0], q[1] - pts[i][1]], dj = [pts[(j + 1) % n][0] - q[0], pts[(j + 1) % n][1] - q[1]];
    if (sg * (di[0] * dj[1] - di[1] * dj[0]) <= 0) continue; // esquina cóncava: los taludes se cruzan solos
    if (Li.tipo === 'talud' && Lj.tipo === 'talud') {
      const Ti = pie(i, 1), Tj = pie(j, 0), fondo = Math.min(Li.muro ?? Li.base, Lj.muro ?? Lj.base);
      talud.cara([Q, Ti, Tj], [ax + bx, 1, az + bz]);
      if (Math.max(Ti[1], Tj[1]) > fondo + .01) (Li.muro !== undefined || Lj.muro !== undefined ? muro : talud).cara([Ti, Tj, [Tj[0], fondo, Tj[2]], [Ti[0], fondo, Ti[2]]], [ax + bx, 0, az + bz]);
    } else if (Li.tipo === 'talud' && Lj.tipo === 'muro') { const T = pie(i, 1), y = Li.muro ?? Li.base; muro.cara([Q, T, [T[0], y, T[2]], [q[0], y, q[1]]], [di[0], 0, di[1]]); }
    else if (Li.tipo === 'muro' && Lj.tipo === 'talud') { const T = pie(j, 0), y = Lj.muro ?? Lj.base; muro.cara([Q, T, [T[0], y, T[2]], [q[0], y, q[1]]], [-dj[0], 0, -dj[1]]); }
  }
  return {tapa, talud, muro};
}
// Altura del suelo modelado en (x, z) del grupo: terraza, taludes o predio.
function alturaSuelo(x, z) {
  if (dentro(TERRAZA, x, z)) return Y_TERRAZA;
  let y = Y_PREDIO;
  TERRAZA.forEach((p, i) => {
    const L = LADOS_TERRAZA[i]; if (L.tipo !== 'talud') return;
    const q = TERRAZA[(i + 1) % TERRAZA.length], dx = q[0] - p[0], dz = q[1] - p[1], t = ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz);
    if (t < -.05 || t > 1.05) return;
    const [ox, oz] = fueraDe(TERRAZA, i), d = (x - p[0]) * ox + (z - p[1]) * oz;
    if (d >= 0 && d <= L.corrida) y = Math.max(y, Y_TERRAZA - (Y_TERRAZA - L.base) * d / L.corrida);
  });
  return y;
}
// Pie del muro poniente (línea del muro bajo): desplazamiento del borde de la terraza, recortado en la cara de las gradas.
const MURO_PONIENTE = (() => {
  const i = TERRAZA.length - 1, L = LADOS_TERRAZA[i], [ox, oz] = fueraDe(TERRAZA, i), a = TERRAZA[i], b = TERRAZA[0];
  const A = [a[0] + ox * L.corrida, a[1] + oz * L.corrida], B = [b[0] + ox * L.corrida, b[1] + oz * L.corrida], t = (-X_GRADAS - A[0]) / (B[0] - A[0]);
  return [A, [-X_GRADAS, A[1] + (B[1] - A[1]) * t]];
})();

// ───────────────────────── Prismas de perfil (escaleras, alfardas, andador) ─────────────────────────
// perfil [[s, y], …] en el plano vertical que sigue 'eje' (unitario en planta) desde 'origen'; se extruye en lateral de l0 a l1.
function prismaPerfil(m, perfil, origen, eje, l0, l1) {
  const lat = [eje[1], -eje[0]], P = (s, y, l) => [origen[0] + eje[0] * s + lat[0] * l, y, origen[1] + eje[1] * s + lat[1] * l];
  m.plano(perfil.map(([s, y]) => P(s, y, l1)), [lat[0], 0, lat[1]]);
  m.plano(perfil.map(([s, y]) => P(s, y, l0)), [-lat[0], 0, -lat[1]]);
  const sg = signoArea(perfil);
  perfil.forEach(([s, y], k) => {
    const [s2, y2] = perfil[(k + 1) % perfil.length], ds = s2 - s, dy = y2 - y, l = Math.hypot(ds, dy) || 1, ns = sg * dy / l, ny = -sg * ds / l;
    if (ny < -.5) return; // cara inferior: no se ve
    m.cara([P(s, y, l0), P(s2, y2, l0), P(s2, y2, l1), P(s, y, l1)], [eje[0] * ns, ny, eje[1] * ns]);
  });
  return P;
}
// Escalera (cuerpo macizo hasta el predio): tramos [{peldanos, contra, huella}] separados por descansos de largo 'descanso'.
function perfilEscalera(y0, tramos, inicio = 0, fin = 0) {
  const per = [[0, Y_PREDIO], [0, y0]]; let s = 0, y = y0;
  if (inicio) per.push([s += inicio, y]);
  tramos.forEach((t, k) => {
    for (let j = 0; j < t.peldanos; j++) { y += t.contra; per.push([s, y]); s += j < t.peldanos - 1 || t.descanso ? t.huella : 0; per.push([s, y]); }
    if (t.descanso) { s += t.descanso - t.huella; per[per.length - 1][0] = s; }
  });
  if (fin) per.push([s += fin, y]);
  per.push([s, Y_PREDIO]);
  return per.filter((p, k) => k === 0 || p[0] !== per[k - 1][0] || p[1] !== per[k - 1][1]);
}

// ───────────────────────── Barandales ─────────────────────────
// linea: puntos [x, y, z] del borde donde se apoyan los postes; pasamanos a 'alto' y travesaño medio.
function barandal(lote, linea, {alto = .95, paso = 1.5, medio = true} = {}) {
  lote.tubo(linea.map(([x, y, z]) => [x, y + alto, z]), .028, 4);
  if (medio) lote.tubo(linea.map(([x, y, z]) => [x, y + alto * .48, z]), .018, 3);
  const postes = [];
  for (let k = 0; k < linea.length - 1; k++) {
    const a = linea[k], b = linea[k + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / paso));
    for (let j = 0; j < n; j++) postes.push(mezcla(a, b, j / n));
  }
  postes.push(linea[linea.length - 1]);
  for (const p of postes) lote.tubo([p, [p[0], p[1] + alto, p[2]]], .024, 3);
  return lote;
}

// ───────────────────────── Arcos y membrana ─────────────────────────
// Círculo que pasa por los dos pies y la clave: {cx, cy, R, phi0} (phi0 = ángulo desde la vertical hasta cada pie).
function circulo({xa, xb, yPie, clave}) {
  const cx = (xa + xb) / 2, m = (xb - xa) / 2, h = clave - yPie, R = (m * m + h * h) / (2 * h), cy = clave - R;
  return {cx, cy, R, phi0: Math.atan2(m, yPie - cy)};
}
const CF = circulo(ARCO_FRONTAL), CT = circulo(ARCO_TRASERO);
const enArco = (c, phi, dr = 0) => [c.cx + (c.R + dr) * Math.sin(phi), c.cy + (c.R + dr) * Math.cos(phi)];
// Armadura de sección triangular (un cordón arriba, dos abajo) con diagonales en zigzag (Warren) en las tres caras.
function armadura(lote, c, {z, peralte, ancho, nodos}, {rCordon = .062, rDiag = .03, conica = 1.5} = {}) {
  const L = 2 * c.phi0 * c.R, A = [], B = [], C = [];
  for (let k = 0; k <= nodos; k++) {
    const phi = -c.phi0 + 2 * c.phi0 * k / nodos, f = Math.min(1, Math.min(k, nodos - k) * L / nodos / conica) ** .8;
    const sn = Math.sin(phi), cs = Math.cos(phi), [x, y] = enArco(c, phi), h = peralte / 2 * f, w = ancho / 2 * f;
    A.push([x + sn * h, y + cs * h, z]); B.push([x - sn * h, y - cs * h, z - w]); C.push([x - sn * h, y - cs * h, z + w]);
  }
  lote.tubo(A, rCordon, 5).tubo(B, rCordon, 5).tubo(C, rCordon, 5);
  const zig = (P, Q) => P.map((_, k) => (k % 2 ? Q : P)[k]);
  lote.tubo(zig(A, B), rDiag).tubo(zig(A, C), rDiag).tubo(zig(C, B), rDiag);
  for (let k = 1; k < nodos; k += 2) lote.tubo([B[k], C[k]], rDiag * .85);
  return {A, B, C};
}

// Membrana: parche de Coons sobre las cuatro curvas de borde (arcos y cables laterales cóncavos), hundimiento interior
// y tres conos empujados por los mástiles. Rejilla no uniforme, más densa alrededor de cada mástil.
const MEMBRANA = (() => {
  const borde = (c, {z, peralte, yEsquina, colgado}) => { const r = c.R - peralte / 2 - colgado, f = Math.acos((yEsquina - c.cy) / r); return u => { const [x, y] = enArco(c, -f + 2 * f * u, -peralte / 2 - colgado); return [x, y, z]; }; };
  const C0 = borde(CF, ARCO_FRONTAL), C1 = borde(CT, ARCO_TRASERO);
  const lateral = (F, Aa, Bb) => {
    const va = (Aa[2] - F[2]) / (Bb[2] - F[2]);
    const tramo = (P, Q, t) => {
      const dx = Q[0] - P[0], dz = Q[2] - P[2], L = Math.hypot(dx, dz), mx = (P[0] + Q[0]) / 2, mz = (P[2] + Q[2]) / 2;
      let nx = -dz / L, nz = dx / L; if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
      const b = 4 * t * (1 - t);
      return [P[0] + dx * t + nx * .085 * L * b, P[1] + (Q[1] - P[1]) * t + .55 * b, P[2] + dz * t + nz * .085 * L * b];
    };
    return {va, f: v => v <= va ? tramo(F, Aa, v / va) : tramo(Aa, Bb, (v - va) / (1 - va))};
  };
  const [aO, aE] = ANCLAS.map(a => [a.a[0], Y_ANCLA, a.a[1]]);
  const D0 = lateral(C0(0), aO, C1(0)), D1 = lateral(C0(1), aE, C1(1));
  const P00 = C0(0), P10 = C0(1), P01 = C1(0), P11 = C1(1);
  const coons = (u, v) => { const a = C0(u), b = C1(u), c = D0.f(v), d = D1.f(v); return [0, 1, 2].map(k => (1 - v) * a[k] + v * b[k] + (1 - u) * c[k] + u * d[k] - ((1 - u) * (1 - v) * P00[k] + u * (1 - v) * P10[k] + (1 - u) * v * P01[k] + u * v * P11[k])); };
  // (u, v) de cada mástil: Newton sobre la proyección en planta del parche.
  const invertir = ([x, z]) => {
    let u = .5 + x / 31, v = (z + 12.6) / 24.4;
    for (let it = 0; it < 30; it++) {
      const p = coons(u, v), e = 1e-4, pu = coons(u + e, v), pv = coons(u, v + e);
      const a = (pu[0] - p[0]) / e, b = (pv[0] - p[0]) / e, c = (pu[2] - p[2]) / e, d = (pv[2] - p[2]) / e, det = a * d - b * c, rx = x - p[0], rz = z - p[2];
      u += (d * rx - b * rz) / det; v += (-c * rx + a * rz) / det;
    }
    return [u, v];
  };
  const uvM = MASTILES.map(invertir), vM = uvM.reduce((s, q) => s + q[1], 0) / uvM.length, uM = uvM.map(q => q[0]);
  const nudos = (n, esp, anillos) => {
    const lim = anillos[anillos.length - 1] * .85;
    let k = Array.from({length: n + 1}, (_, i) => i / n).filter(t => esp.every(e => Math.abs(t - e) > lim));
    for (const e of esp) for (const d of [0, ...anillos, ...anillos.map(a => -a)]) k.push(e + d);
    k = k.filter(t => t >= 0 && t <= 1).sort((a, b) => a - b);
    return k.filter((t, i) => i === 0 || t - k[i - 1] > .006);
  };
  const U = nudos(30, uM, [.026, .052, .082, .12]), V = nudos(20, [vM], [.033, .066, .1, .15]);
  const BASE = [], PLANTA = [];
  // Hundimiento interior: leve hacia el arco frontal (desde la plaza se ven las luminarias, fotos 2 y 3), mayor detrás y a los lados.
  const suave = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const hundir = (u, v) => -4.6 * Math.sin(Math.PI * u) ** .8 * Math.sin(Math.PI * v) * (.35 + .65 * suave(.45, .8, v));
  const ventana = (u, v) => (Math.sin(Math.PI * u) * Math.sin(Math.PI * v)) ** .25;
  // Conos: perfil de trompeta (empinado junto al anillo, más tendido lejos) unido suavemente a la superficie base
  // (unión «soft-max»): la cima queda plana a Y_CIMA dentro del anillo y nunca la tapa la superficie base.
  // Hacia el arco frontal el cono baja la mitad: la membrana sube casi continua del arco a cada anillo (fotos 2 y 3).
  const cono = (dx, dz) => { const d = Math.hypot(dx, dz); return Y_CIMA - 1.26 * (1 - .5 * Math.max(0, -dz / (d || 1))) * Math.max(0, d - R_ANILLO) ** .7; }, K = .35;
  for (const v of V) for (const u of U) { const p = coons(u, v); BASE.push(p[1] + hundir(u, v)); PLANTA.push([p[0], p[2]]); }
  const iu = uM.map(u => U.findIndex(t => Math.abs(t - u) < 1e-9)), iv = V.findIndex(t => Math.abs(t - vM) < 1e-9);
  const cima = iu.map(i => PLANTA[iv * U.length + i]);
  const pos = [];
  V.forEach((v, j) => U.forEach((u, i) => {
    const [x, z] = PLANTA[j * U.length + i], b = BASE[j * U.length + i];
    const suma = cima.reduce((s, c) => s + Math.exp((cono(x - c[0], z - c[1]) - b) / K), 0);
    pos.push(x, b + K * Math.log1p(suma) * Math.min(1, ventana(u, v) / .75), z);
  }));
  // Punto sobre los mismos triángulos de la malla (para tender cables pegados a la cara inferior sin que asomen arriba).
  const busca = (T, t) => { let i = 0; while (i < T.length - 2 && T[i + 1] < t) i++; return [i, Math.min(1, Math.max(0, (t - T[i]) / (T[i + 1] - T[i])))]; };
  const en = (u, v) => {
    const [i, a] = busca(U, u), [j, b] = busca(V, v), P = (ii, jj) => pos.slice(3 * (jj * U.length + ii), 3 * (jj * U.length + ii) + 3);
    const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
    return a >= b ? A.map((x, k) => x + a * (B[k] - x) + b * (C[k] - B[k])) : A.map((x, k) => x + b * (D[k] - x) + a * (C[k] - D[k]));
  };
  return {U, V, pos, en, uM, vM, cima, va: [D0.va, D1.va], C0, C1, D0: D0.f, D1: D1.f};
})();
// Posición final de cada mástil (vértice de la rejilla más cercano al medido).
const MASTILES_REJILLA = MEMBRANA.cima;

function geometriaMembrana() {
  const {U, V, pos} = MEMBRANA, idx = [];
  for (let j = 0; j < V.length - 1; j++) for (let i = 0; i < U.length - 1; i++) {
    const a = j * U.length + i, b = a + 1, c = a + U.length + 1, d = a + U.length;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // Normales hacia arriba (el material es de doble cara).
  const n = g.attributes.normal; if (n.getY(Math.floor(n.count / 2)) < 0) { for (let k = 0; k < n.array.length; k++) n.array[k] *= -1; idx.reverse(); g.setIndex(new THREE.Uint16BufferAttribute(idx, 1)); }
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────── Geometrías (caché) ─────────────────────────
function geoArmaduras() {
  const f = new Lote(), t = new Lote();
  armadura(f, CF, ARCO_FRONTAL); armadura(t, CT, ARCO_TRASERO, {rCordon: .055, rDiag: .027});
  return {frontal: f.geometria(), trasero: t.geometria()};
}
function geoGradas() {
  const m = new Malla(), am = new Malla(), up = [0, 1, 0];
  const nR = (R, x) => unit([-x, 0, CZ_GRADAS - ZR(R, x)]); // normal del peralte: hacia el centro del arco (el foro)
  const xs = (a, b, paso) => { const n = Math.max(1, Math.ceil((b - a) / paso - 1e-9)); return Array.from({length: n + 1}, (_, i) => a + (b - a) * i / n); };
  const peralte = (mm, R, a, b, y0, y1, paso = 1.15) => { const X = xs(a, b, paso); mm.franja(X.map(x => [x, y0, ZR(R, x)]), X.map(x => [x, y1, ZR(R, x)]), X.map(x => nR(R, x)), X.map(x => nR(R, x))); };
  const huella = (mm, Ra, Rb, a, b, y, paso = 1.15) => { const X = xs(a, b, paso); mm.franja(X.map(x => [x, y, ZR(Ra, x)]), X.map(x => [x, y, ZR(Rb, x)]), X.map(() => up), X.map(() => up)); };
  const tramos = [[-X_GRADAS, PASILLOS[0] - MEDIO_PASILLO], [PASILLOS[0] + MEDIO_PASILLO, PASILLOS[1] - MEDIO_PASILLO], [PASILLOS[1] + MEDIO_PASILLO, X_GRADAS]];
  for (let k = 0; k < N_GRADAS; k++) {
    const Ra = R_GRADAS + k * HUELLA, Rb = Ra + HUELLA, Rm = Ra + HUELLA / 2, y0 = Y_FORO + k * PELDANO, y1 = y0 + PELDANO, ym = y0 + PELDANO / 2;
    for (const [a, b] of tramos) { peralte(m, Ra, a, b, y0, y1); huella(m, Ra, Rb, a, b, y1); }
    // Pasillo de escalera: medio escalón intermedio con nariz amarilla.
    for (const c of PASILLOS) {
      const a = c - MEDIO_PASILLO, b = c + MEDIO_PASILLO;
      peralte(m, Ra, a, b, y0, ym, 2); huella(m, Ra, Rm, a, b, ym, 2); peralte(m, Rm, a, b, ym, y1, 2); huella(m, Rm, Rb, a, b, y1, 2);
      for (const [x, s] of [[a, 1], [b, -1]]) m.cara([[x, ym, ZR(Ra, x)], [x, ym, ZR(Rm, x)], [x, y1, ZR(Rm, x)], [x, y1, ZR(Ra, x)]], [s, 0, 0]);
      huella(am, Ra - .006, Ra + .12, a + .05, b - .05, ym + .006, 2);
      peralte(am, Ra - .006, a + .05, b - .05, ym - .06, ym + .006, 2);
    }
  }
  // Caras laterales cerradas (x = ±11): perfil escalonado.
  for (const s of [-1, 1]) {
    const x = s * X_GRADAS, per = [[x, Y_PREDIO, ZR(R_GRADAS, x)]];
    for (let k = 0; k < N_GRADAS; k++) { const y1 = Y_FORO + (k + 1) * PELDANO; per.push([x, y1, ZR(R_GRADAS + k * HUELLA, x)], [x, y1, ZR(R_GRADAS + (k + 1) * HUELLA, x)]); }
    per.push([x, Y_PREDIO, ZR(R_GRADAS + N_GRADAS * HUELLA, x)]);
    m.plano(per, [s, 0, 0]);
  }
  return {concreto: m.geometria(), narices: am.geometria()};
}
function geoForo() {
  const piso = new Malla(), banda = new Malla(), up = [0, 1, 0];
  const [M0, M1] = MURO_PONIENTE;
  const contorno = [[X_FORO[0], Z_BORDE_FORO], [X_FORO[1], Z_BORDE_FORO], [X_FORO[1], -1.2], [X_GRADAS, ZR(R_GRADAS + N_GRADAS * HUELLA, X_GRADAS)], [-X_GRADAS, ZR(R_GRADAS + N_GRADAS * HUELLA, X_GRADAS)], M1, M0];
  piso.plano(contorno.map(([x, z]) => [x, Y_FORO, z]), up);
  contorno.forEach((p, k) => { const q = contorno[(k + 1) % contorno.length], [ox, oz] = fueraDe(contorno, k); piso.cara([[p[0], Y_FORO, p[1]], [q[0], Y_FORO, q[1]], [q[0], Y_PREDIO - .02, q[1]], [p[0], Y_PREDIO - .02, p[1]]], [ox, 0, oz]); });
  // Banda rojiza al pie de las gradas y del muro poniente.
  const X = Array.from({length: 23}, (_, i) => -X_GRADAS + i);
  banda.franja(X.map(x => [x, Y_FORO + .008, ZR(R_GRADAS - .38, x)]), X.map(x => [x, Y_FORO + .008, ZR(R_GRADAS, x)]), X.map(() => up), X.map(() => up));
  const [ox, oz] = fueraDe(TERRAZA, TERRAZA.length - 1);
  banda.cara([[M0[0], Y_FORO + .008, M0[1]], [M1[0], Y_FORO + .008, M1[1]], [M1[0] + ox * .32, Y_FORO + .008, M1[1] + oz * .32], [M0[0] + ox * .32, Y_FORO + .008, M0[1] + oz * .32]], up);
  return {piso: piso.geometria(), banda: banda.geometria()};
}
function geoTerraza() {
  const {tapa, talud, muro} = terraplen(TERRAZA, Y_TERRAZA, LADOS_TERRAZA);
  // Remates de concreto sobre los muros que dan al foro.
  const remate = new Combinador(), [M0, M1] = MURO_PONIENTE, [ox, oz] = fueraDe(TERRAZA, TERRAZA.length - 1);
  const tira = (a, b, y, ancho, alto, desp = [0, 0]) => { const dx = b[0] - a[0], dz = b[1] - a[1]; remate.caja((a[0] + b[0]) / 2 + desp[0], y + alto / 2, (a[1] + b[1]) / 2 + desp[1], ancho, alto, Math.hypot(dx, dz) + ancho * .5, Math.atan2(dx, dz)); };
  tira(M0, M1, Y_BANCA - .02, .32, .1, [ox * -.08, oz * -.08]);
  const e0 = TERRAZA[16], e1 = TERRAZA[17], [px, pz] = fueraDe(TERRAZA, 16);
  tira(e0, e1, Y_TERRAZA - .02, .3, .1, [px * -.12, pz * -.12]);
  // Andador de concreto sobre la terraza: de la escalera lateral hacia la bajada del oriente.
  const camino = new Malla(), recorrido = [[15.9, .2], [15.8, 3], [14.2, 6.6], [12.4, 10.6], [11.6, 13]];
  camino.plano(trazo(recorrido, 1.9).map(([x, z]) => [x, Y_TERRAZA + .015, z]), [0, 1, 0]);
  return {tapa: tapa.geometria(), talud: talud.geometria(), muro: muro.geometria(), remate: remate.geometria(), camino: camino.geometria()};
}
// Escalera lateral (oriente): de la plaza (z −9) a la terraza, dos tramos de 8 peldaños con descanso; alfardas y barandales.
const ESCALERA = {x0: 15, x1: 16.8, z0: -9, tramos: [{peldanos: 8, contra: (Y_TERRAZA - .34) / 16, huella: .36, descanso: 3.48}, {peldanos: 8, contra: (Y_TERRAZA - .34) / 16, huella: .36}], fin: .98};
// Bajada al oriente desde la terraza (banda clara del satélite): rampa escalonada con alfardas y barandal.
const BAJADA = {origen: [11.5, 13.3], fin: [26.4, 4.6], ancho: 2, inicio: 2.2, peldanos: 12};
function geoEscaleras() {
  const m = new Malla(), alf = new Malla(), bar = new Lote();
  // Escalera lateral: el eje va hacia +z y el lateral coincide con +x (l = x del grupo).
  const {x0, x1, z0, tramos, fin} = ESCALERA, c = tramos[0].contra, h = tramos[0].huella, origen = [0, z0], eje = [0, 1];
  const per = perfilEscalera(.34, tramos, 0, fin);
  prismaPerfil(m, per, origen, eje, x0, x1);
  const sTot = per[per.length - 1][0], s1 = (tramos[0].peldanos - 1) * h, s2 = s1 + tramos[0].descanso, s3 = s2 + (tramos[1].peldanos - 1) * h;
  const borde = [[-.2, .34 + .12], [s1, .34 + 8 * c + .12], [s2 - .3, .34 + 8 * c + .12], [s3, Y_TERRAZA + .12], [sTot, Y_TERRAZA + .12]];
  for (const [l0, l1] of [[x0 - .2, x0], [x1, x1 + .2]]) {
    prismaPerfil(alf, [[-.2, Y_PREDIO], ...borde, [sTot, Y_PREDIO]], origen, eje, l0, l1);
    barandal(bar, borde.map(([ss, y]) => [(l0 + l1) / 2, y, z0 + ss]), {alto: .9});
  }
  // Bajada al oriente
  const d = [BAJADA.fin[0] - BAJADA.origen[0], BAJADA.fin[1] - BAJADA.origen[1]], L = Math.hypot(...d), e = [d[0] / L, d[1] / L];
  const ytop = Y_TERRAZA + .015, contra = (ytop - Y_PREDIO) / BAJADA.peldanos, paso = (L - BAJADA.inicio) / (BAJADA.peldanos - 1);
  const pb = [[0, Y_PREDIO], [0, ytop], [BAJADA.inicio, ytop]]; let s = BAJADA.inicio, y = ytop;
  for (let k = 1; k < BAJADA.peldanos; k++) { y -= contra; pb.push([s, y]); s += paso; pb.push([s, y]); }
  pb[pb.length - 1][0] = L; pb.push([L, Y_PREDIO]);
  prismaPerfil(m, pb.filter((p, k, a) => k === 0 || p[0] !== a[k - 1][0] || p[1] !== a[k - 1][1]), BAJADA.origen, e, -BAJADA.ancho / 2, BAJADA.ancho / 2);
  const bordeB = [[0, ytop + .13], [BAJADA.inicio, ytop + .13], [L - paso, Y_PREDIO + contra + .13], [L, Y_PREDIO + contra + .13]];
  const lat = [e[1], -e[0]];
  for (const [l0, l1] of [[-BAJADA.ancho / 2 - .18, -BAJADA.ancho / 2], [BAJADA.ancho / 2, BAJADA.ancho / 2 + .18]]) {
    prismaPerfil(alf, [[0, Y_PREDIO], ...bordeB, [L, Y_PREDIO]], BAJADA.origen, e, l0, l1);
    const lm = (l0 + l1) / 2;
    barandal(bar, bordeB.map(([ss, yy]) => [BAJADA.origen[0] + e[0] * ss + lat[0] * lm, yy, BAJADA.origen[1] + e[1] * ss + lat[1] * lm]), {alto: .9});
  }
  barandalesFijos(bar);
  return {peldanos: m.geometria(), alfardas: alf.geometria(), barandal: bar.geometria()};
}
// Barandales fijos: muro poniente, muro oriente de la terraza, extremos de las gradas.
function barandalesFijos(b) {
  const [M0, M1] = MURO_PONIENTE, [ox, oz] = fueraDe(TERRAZA, TERRAZA.length - 1);
  barandal(b, [[M0[0] - ox * .08, Y_BANCA + .08, M0[1] - oz * .08], [M1[0] - ox * .08, Y_BANCA + .08, M1[1] - oz * .08]], {alto: 1, medio: false});
  const e0 = TERRAZA[16], e1 = TERRAZA[17], [px, pz] = fueraDe(TERRAZA, 16);
  barandal(b, [[e0[0] - px * .12, Y_TERRAZA + .08, e0[1] - pz * .12], [e1[0] - px * .12, Y_TERRAZA + .08, e1[1] - pz * .12]], {alto: 1});
  for (const s of [-1, 1]) {
    const x = s * (X_GRADAS - .12), pie = [x, Y_FORO + PELDANO, ZR(R_GRADAS + .3, x)], cima = [x, Y_TERRAZA, ZR(R_GRADAS + N_GRADAS * HUELLA - .3, x)];
    b.tubo([[x, pie[1] + .9, pie[2]], [x, cima[1] + .9, cima[2]]], .028, 4).tubo([[x, pie[1] + .45, pie[2]], [x, cima[1] + .45, cima[2]]], .018, 3);
    for (let k = 0; k < N_GRADAS; k++) {
      const z = ZR(R_GRADAS + k * HUELLA + .45, x), y = Y_FORO + (k + 1) * PELDANO, t = (z - pie[2]) / (cima[2] - pie[2]);
      b.tubo([[x, y, z], [x, pie[1] + .9 + (cima[1] - pie[1]) * t, z]], .024, 3);
    }
  }
  // Postes cortos a los lados de los pasillos (cada dos escalones), como en la foto 3.
  for (const c of PASILLOS) for (const s of [-1, 1]) for (let k = 0; k < N_GRADAS; k += 2) {
    const x = c + s * (MEDIO_PASILLO + .1), R = R_GRADAS + k * HUELLA + .2, y = Y_FORO + (k + 1) * PELDANO;
    b.tubo([[x, y, ZR(R, x)], [x, y + .42, ZR(R, x)]], .035, 4);
  }
  return b;
}
function geoMastil() {
  const c = new Combinador(), H = Y_ANILLO - Y_TERRAZA;
  c.cilindro([0, 0, 0], [0, H - .05, 0], R_MASTIL, 12).cilindro([0, 0, 0], [0, .5, 0], R_MASTIL + .06, 12);
  return c.geometria();
}
function geoLuminaria() {
  const blanco = new Combinador(), luz = new Combinador(), tapa = new Combinador();
  blanco.agregar(new THREE.TorusGeometry(R_ANILLO, .07, 5, 22), matriz([0, 0, 0], [Math.PI / 2, 0, 0]));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; blanco.cilindro([0, -.02, 0], [Math.cos(a) * R_ANILLO, 0, Math.sin(a) * R_ANILLO], .03, 4); }
  blanco.cilindro([0, -.25, 0], [0, .06, 0], R_MASTIL + .05, 10);
  luz.agregar(new THREE.CircleGeometry(R_ANILLO - .03, 22), matriz([0, .045, 0], [Math.PI / 2, 0, 0]));
  tapa.agregar(new THREE.CircleGeometry(R_ANILLO - .04, 16), matriz([0, .15, 0], [-Math.PI / 2, 0, 0]));
  return fusionar([blanco.geometria(), luz.geometria(), tapa.geometria()]);
}
// Line array: bastidor y 4 cajas con inclinación creciente (curva en J), frente hacia +z.
function geoBocina() {
  const c = new Combinador();
  caja(c, matriz([0, -.04, 0], [0, 0, 0], [.95, .07, .72]));
  let y = -.08, z = 0, a = 0;
  for (const inc of [.03, .05, .08, .12]) {
    a += inc; const h = .36;
    caja(c, matriz([0, y - h / 2 * Math.cos(a), z + h / 2 * Math.sin(a)], [a, 0, 0], [.86, h - .015, .62]));
    y -= h * Math.cos(a); z += h * Math.sin(a);
  }
  return c.geometria();
}
// Pantalla LED (y cubierta del templete) y andamio: frente hacia +z, base en y = 0.
function geoPantalla() {
  const p = new Combinador(), d = new Combinador();
  caja(p, matriz([0, 1.3 + 1.35, 0], [0, 0, 0], [2.0, 2.7, .14]));
  caja(d, matriz([0, 1.24, -.15], [0, 0, 0], [2.6, .05, 1.5]));
  return fusionar([p.geometria(), d.geometria()]);
}
function geoAndamio() {
  const l = new Lote(), r = .028, X = 1.25, Z0 = -.85, Z1 = .55, H = 1.2;
  const esq = [[-X, Z0], [X, Z0], [X, Z1], [-X, Z1]];
  for (const [x, z] of esq) l.tubo([[x, 0, z], [x, H, z]], r, 3);
  for (const y of [.15, H]) l.tubo([...esq, esq[0]].map(([x, z]) => [x, y, z]), r, 3);
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) l.tubo([[esq[a][0], .15, esq[a][1]], [esq[b][0], H, esq[b][1]]], r * .8, 3);
  // Torre detrás de la pantalla
  const T = [[-.85, -.35], [.85, -.35], [.85, -.8], [-.85, -.8]];
  for (const [x, z] of T) l.tubo([[x, H, z], [x, 4.35, z]], r, 3);
  for (let y = H + .6; y < 4.4; y += .62) l.tubo([...T, T[0]].map(([x, z]) => [x, y, z]), r * .8, 3);
  for (const [a, b] of [[0, 1], [3, 2]]) l.tubo([[T[a][0], H, T[a][1]], [T[b][0], H + 1.5, T[b][1]], [T[a][0], H + 3, T[a][1]]], r * .7, 3);
  return l.geometria();
}
// Mesa de picnic con techito a dos aguas (cumbrera a lo largo de z) sobre 4 postes.
function geoMesa() {
  const postes = new Combinador(), techo = new Combinador(), mesa = new Combinador(), Xp = 1.0, Zp = .9, ye = 2.2, yc = 2.68, X = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) postes.cilindro([sx * Xp, 0, sz * Zp], [sx * Xp, ye + .02, sz * Zp], .045, 5);
  for (const sx of [-1, 1]) postes.caja(sx * Xp, ye, 0, .07, .07, 2 * Zp + .1);
  postes.caja(0, yc - .06, 0, .08, .08, 2.4);
  const ang = Math.atan2(yc - ye, X);
  for (const sx of [-1, 1]) caja(techo, matriz([sx * X / 2, (ye + yc) / 2 + .03, 0], [0, 0, -sx * ang], [Math.hypot(X, yc - ye) + .04, .05, 2.6]));
  mesa.caja(0, .74, 0, .76, .05, 1.85);
  for (const sx of [-1, 1]) mesa.caja(sx * .64, .45, 0, .3, .045, 1.85);
  for (const sz of [-1, 1]) { mesa.caja(0, .36, sz * .72, .06, .72, .06); mesa.caja(0, .2, sz * .72, 1.5, .05, .07); }
  return fusionar([postes.geometria(), techo.geometria(), mesa.geometria()]);
}
function geoBote() {
  const cuerpo = new Combinador(), banda = new Combinador(), tapa = new Combinador();
  cuerpo.agregar(new THREE.CylinderGeometry(.27, .23, .82, 10, 1, true), matriz([0, .41, 0]));
  banda.agregar(new THREE.CylinderGeometry(.275, .272, .1, 10, 1, true), matriz([0, .66, 0]));
  tapa.agregar(new THREE.CylinderGeometry(.24, .29, .1, 10), matriz([0, .87, 0]));
  return fusionar([cuerpo.geometria(), banda.geometria(), tapa.geometria()]);
}
function geoBolardo() {
  const c = new Combinador();
  c.agregar(new THREE.CylinderGeometry(.13, .14, 1.2, 9, 1, true), matriz([0, .6, 0]));
  c.agregar(new THREE.SphereGeometry(.13, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2), matriz([0, 1.2, 0]));
  return c.geometria();
}
// Cables: tirantes de la membrana (cara inferior), esquinas a los pies, contravientos de los puntales, colgantes del borde frontal.
function geoCables() {
  // Los tirantes van por la cara inferior: cada muestra se baja 13 cm según la normal local, y las muestras se apiñan junto al anillo,
  // donde la membrana se dobla más (así ningún tramo asoma por encima).
  const l = new Lote(), M = MEMBRANA;
  const debajo = (u, v) => {
    const p = M.en(u, v), e = .004, pu = sub(M.en(Math.min(1, u + e), v), M.en(Math.max(0, u - e), v)), pv = sub(M.en(u, Math.min(1, v + e)), M.en(u, Math.max(0, v - e)));
    let n = unit(cruz(pu, pv)); if (n[1] > 0) n = n.map(c => -c);
    return [p[0] + n[0] * .13, p[1] + n[1] * .13, p[2] + n[2] * .13];
  };
  const tender = (u0, v0, u1, v1, n = 14) => l.tubo(Array.from({length: n + 1}, (_, k) => { const t = (k / n) ** 1.7; return debajo(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t); }), .017, 3);
  const du = .028, dv = .036;
  M.uM.forEach((u, k) => {
    for (const s of [-1, 1]) { tender(u + s * du, M.vM - dv, u + s * .1, 0); tender(u + s * du, M.vM + dv, u + s * .075, 1); }
    if (k === 0) tender(u - du, M.vM, 0, M.va[0]);
    if (k === M.uM.length - 1) tender(u + du, M.vM, 1, M.va[1]);
  });
  for (let k = 0; k < M.uM.length - 1; k++) { const u = (M.uM[k] + M.uM[k + 1]) / 2; tender(u, 0, u, 1, 26); }
  // Cables de borde laterales y colgantes de la membrana a los arcos
  for (const f of [M.D0, M.D1]) l.tubo(Array.from({length: 19}, (_, k) => f(k / 18)), .025, 3);
  for (let k = 2; k < 39; k += 3) { const p = M.C0(k / 40), phi = Math.atan2(p[0] - CF.cx, p[1] - CF.cy), [x, y] = enArco(CF, phi, -ARCO_FRONTAL.peralte / 2); l.tubo([p, [x, y, p[2]]], .018, 3); }
  for (let k = 2; k < 29; k += 3) { const p = M.C1(k / 30), phi = Math.atan2(p[0] - CT.cx, p[1] - CT.cy), [x, y] = enArco(CT, phi, -ARCO_TRASERO.peralte / 2); l.tubo([p, [x, y, p[2]]], .018, 3); }
  // Esquinas de la membrana a los pies de los arcos
  for (const [u, c, cfg] of [[0, M.C0, ARCO_FRONTAL], [1, M.C0, ARCO_FRONTAL]]) { const p = c(u), x = u ? cfg.xb : cfg.xa; l.tubo([p, [x, cfg.yPie + .6, cfg.z]], .024, 3); }
  for (const u of [0, 1]) { const p = M.C1(u), x = u ? ARCO_TRASERO.xb : ARCO_TRASERO.xa; l.tubo([p, [x, ARCO_TRASERO.yPie + .5, ARCO_TRASERO.z]], .024, 3); }
  // Contravientos de los puntales
  for (const a of ANCLAS) l.tubo([[a.a[0], Y_ANCLA, a.a[1]], [a.tirante[0], alturaSuelo(...a.tirante) + .35, a.tirante[1]]], .024, 3);
  // Cadenas de los bolardos al arco frontal
  for (const s of [-1, 1]) { const phi = s * (CF.phi0 - .2), [x, y] = enArco(CF, phi, -ARCO_FRONTAL.peralte / 2); l.tubo([[x, y, ARCO_FRONTAL.z - .3], [s * 14.3, 1.25, -16.7]], .03, 3); }
  // Cadenas de las bocinas
  for (const s of [-1, 1]) {
    const x = s * 8.6, phi = Math.asin((x - CF.cx) / CF.R), [, y] = enArco(CF, phi, -ARCO_FRONTAL.peralte / 2);
    for (const dz of [-.3, .3]) l.tubo([[x - s * .1, y, ARCO_FRONTAL.z + dz * 1.5], [x, 7.96, ARCO_FRONTAL.z + dz]], .02, 3);
  }
  return l.geometria();
}
function geoPuntales() {
  const c = new Combinador();
  for (const a of ANCLAS) { const yb = alturaSuelo(...a.base); c.cilindro([a.base[0], yb, a.base[1]], [a.a[0], Y_ANCLA + .15, a.a[1]], .12, 10); c.cilindro([a.base[0], yb, a.base[1]], [a.base[0], yb + .25, a.base[1]], .2, 10); }
  return c.geometria();
}

// Árboles con las variantes de copa que el resto del campus ya usa (el GLB comparte esas geometrías y no suma bytes):
// cedro 1, fresno 0 y 1, arbusto 0 (con CONFIG.variantes de vegetacion.js). La semilla sólo elige la variante.
const VARIANTES_COMPARTIDAS = {cedro: [1], fresno: [0, 1], arbusto: [0]};
function semillaArbol(tipo, k) {
  for (let s = 3700 + k * 17; s < 3700 + k * 17 + 200; s++) { const r = prng('arbol:' + s); r(); if ((VARIANTES_COMPARTIDAS[tipo] || [0]).includes(Math.floor(r() * (CONFIG.variantes[tipo] || 2)))) return s; }
  return 3700 + k * 17;
}

// ───────────────────────── Construcción ─────────────────────────
// ctx = {box(parent,name,x,y,z,w,h,d,color), material(color)} de app.js.
export function construirAgora(g, ctx) {
  const mat = ctx.material, box = ctx.box;
  // Foro, gradas, terraza, muros y escaleras (piezas del mismo material en una sola malla; grupos para los colores)
  const te = geo('terraza', geoTerraza), es = geo('escaleras', geoEscaleras);
  malla(g, 'Foro_piso', geo('foro', () => { const f = geoForo(); return fusionar([f.piso, f.banda]); }), [mat(COLOR.foro), mat(COLOR.bandaRoja)], {sombra: false});
  box(g, 'Foro_guarnicion', (X_FORO[0] + X_FORO[1]) / 2, .225, Z_BORDE_FORO, X_FORO[1] - X_FORO[0], .25, .3, COLOR.guarnicion);
  box(g, 'Foro_tope_amarillo', -8.1, Y_FORO + .035, Z_BORDE_FORO + .32, 13, .07, .26, COLOR.nariz);
  malla(g, 'Gradas_concreto', geo('gradas', () => { const q = geoGradas(); return fusionar([q.concreto, q.narices]); }), [mat(COLOR.gradas), mat(COLOR.nariz)]);
  malla(g, 'Terraza_pasto', geo('pasto', () => fusionar([te.tapa, te.talud])), [mat(COLOR.pasto), mat(COLOR.talud)], {sombra: false});
  malla(g, 'Muro_poniente_remates_y_alfardas', geo('muros', () => fusionar([te.muro, te.remate, es.alfardas], false)), mat(COLOR.muro));
  malla(g, 'Escalera_lateral_agora_y_andadores', geo('peldanos', () => fusionar([es.peldanos, te.camino], false)), mat(COLOR.escalera));
  malla(g, 'Barandales_agora', es.barandal, MAT.metal);

  // Arcos de armadura, pedestales, mástiles y luminarias
  const ar = geo('armaduras', geoArmaduras);
  malla(g, 'Arco_frontal_armadura', ar.frontal, MAT.armadura);
  malla(g, 'Arco_trasero_armadura', ar.trasero, MAT.armadura);
  for (const [cfg, nombre, y0, w, d] of [[ARCO_FRONTAL, 'Pedestal_arco_frontal', Y_PREDIO, 1.25, 1.25], [ARCO_TRASERO, 'Pedestal_arco_trasero', Y_TERRAZA - .3, 2.2, 1.6]])
    for (const [x, lado] of [[cfg.xa, 'poniente'], [cfg.xb, 'oriente']]) box(g, `${nombre}_${lado}`, x, (y0 + cfg.yPie) / 2, cfg.z, w, cfg.yPie - y0, d, COLOR.pedestal);
  const mastil = geo('mastil', geoMastil), lum = geo('luminaria', geoLuminaria);
  MASTILES_REJILLA.forEach(([x, z], k) => {
    const m = malla(g, `Mastil_luminaria_${k + 1}`, mastil, MAT.acero); m.position.set(x, Y_TERRAZA, z);
    box(g, `Base_mastil_${k + 1}`, x, Y_TERRAZA + .12, z, .8, .3, .8, COLOR.pedestal);
    const l = malla(g, `Luminaria_anillo_${k + 1}`, lum, [MAT.acero, MAT.luz, mat(COLOR.oscuro)], {sombra: false}); l.position.set(x, Y_ANILLO, z);
  });
  // Membrana y cables
  malla(g, 'Membrana_agora', geo('membrana', geometriaMembrana), MAT.membrana);
  malla(g, 'Cables_membrana_y_tirantes', geo('cables', geoCables), MAT.cable, {sombra: false});
  malla(g, 'Puntales_ancla', geo('puntales', geoPuntales), MAT.acero);
  for (const [k, a] of ANCLAS.entries()) { const t = a.tirante; box(g, `Muerto_tirante_${k + 1}`, t[0], alturaSuelo(...t) + .12, t[1], .6, .45, .6, COLOR.pedestal); }

  // Bocinas line-array colgadas del arco frontal y pantallas sobre andamio
  const boc = geo('bocina', geoBocina);
  for (const [s, lado] of [[-1, 'poniente'], [1, 'oriente']]) { const b = malla(g, `Bocina_line_array_${lado}`, boc, MAT.bocina); b.position.set(s * 8.6, 8.0, ARCO_FRONTAL.z); b.rotation.y = -s * .12; }
  const pan = geo('pantalla', geoPantalla), anda = geo('andamio', geoAndamio);
  for (const [x, z, lado] of [[-12.1, -8.9, 'poniente'], [12.6, -8.1, 'oriente']]) {
    const giro = Math.atan2(0 - x, -11 - z);
    const p = malla(g, `Pantalla_led_${lado}`, pan, [MAT.pantalla, mat(COLOR.oscuro)]); p.position.set(x, Y_FORO, z); p.rotation.y = giro;
    const a = malla(g, `Andamio_pantalla_${lado}`, anda, MAT.metal); a.position.set(x, Y_FORO, z); a.rotation.y = giro;
  }

  // Mesas de picnic (una geometría para las seis)
  const mesa = geo('mesa', geoMesa), matsMesa = [MAT.metal, mat(COLOR.techoMesa), mat(COLOR.mesa)];
  MESAS.forEach(([x, z, giro], k) => { const m = malla(g, `Mesa_picnic_${k + 1}`, mesa, matsMesa); m.position.set(x, Y_TERRAZA, z); m.rotation.y = giro; });
  // Botes de basura naranjas y bolardos
  const bote = geo('bote', geoBote), matsBote = [mat(COLOR.bote), mat(COLOR.boteBanda), mat(COLOR.oscuro)];
  for (const [k, [x, z]] of [[-10.4, -11.2], [-11.6, 17.4], [14.2, 2.6], [-15.4, -16.6]].entries()) { const b = malla(g, `Bote_basura_${k + 1}`, bote, matsBote); b.position.set(x, alturaSuelo(x, z) > Y_FORO + .1 ? alturaSuelo(x, z) : z < Z_BORDE_FORO ? .34 : Y_FORO, z); }
  const bol = geo('bolardo', geoBolardo);
  for (const s of [-1, 1]) { const b = malla(g, `Bolardo_${s < 0 ? 'poniente' : 'oriente'}`, bol, mat(COLOR.pedestal)); b.position.set(s * 14.3, .1, -16.7); }

  // Árboles: grandes al poniente y al fondo (talud), arbustos junto a la terraza.
  const arboles = [['cedro', -21.4, -3.2, 1.05], ['fresno', -22.6, 4.6, 1.15], ['cedro', -22.2, 12.2, 1], ['fresno', -18.4, 20.4, 1.1], ['cedro', -12.5, 23.6, .95],
    ['fresno', -1.6, 17.6, 1.05], ['cedro', 6.2, 15.4, .85], ['fresno', 18.4, 6.2, .95], ['cedro', 22.5, 14.5, 1.1], ['fresno', 4.5, 22.5, 1.2], ['cedro', -27.5, -9.5, 1.1],
    ['arbusto', -17.6, 8.6, 1.2], ['arbusto', -15.8, -8.4, 1.1], ['arbusto', -14.2, -6.4, 1.3], ['arbusto', -12.7, -4.3, 1], ['arbusto', -16.4, -4.2, 1.2], ['arbusto', 13.4, 4.2, 1.1], ['arbusto', -4.2, 21.8, 1.3], ['arbusto', -19.5, -7.2, 1], ['arbusto', 19.7, 2.4, 1.2], ['arbusto', 20.8, -.9, 1], ['arbusto', 9.6, 5.6, 1.1], ['arbusto', 11.9, 7.8, 1.2], ['arbusto', -9.8, 5.2, 1.1]];
  arboles.forEach(([tipo, x, z, t], k) => { const a = crearArbol({tipo, tamano: t, semilla: semillaArbol(tipo, k), elevacion: alturaSuelo(x, z)}); a.name = `Arbol_agora_${tipo}_${k + 1}`; a.position.set(x, 0, z); g.add(a); });

  // Personas (el plano 2D oculta 'Vida_decorativa')
  const vida = new THREE.Group(); vida.name = 'Vida_decorativa'; vida.userData = {decorativo: true}; g.add(vida);
  const grada = (k, x) => { const R = R_GRADAS + (k - 1) * HUELLA + .55; return [x, Y_FORO + k * PELDANO, ZR(R, x)]; };
  const personas = [
    [[-2.6, Y_FORO, -9.4], .4, 'pie'], [[-1.8, Y_FORO, -8.8], -2.6, 'pie'], [[5.5, Y_FORO, -11.5], -1.2, 'camina'], [[-9.5, .34, -17.6], 1.4, 'camina'],
    [grada(2, -7.2), Math.PI, 'pie'], [grada(4, 1.6), Math.PI + .2, 'pie'], [grada(1, 8.2), Math.PI - .3, 'pie'], [grada(5, -1.2), Math.PI, 'camina'],
    [[-13, Y_TERRAZA, 12.2], .1, 'pie'], [[-6.5, Y_TERRAZA, 16.9], .3, 'pie'], [[15.1, Y_TERRAZA + .02, 5.0], 2.7, 'camina'], [[15.9, .34 + 8 * ESCALERA.tramos[0].contra, -4.9], 0, 'camina'],
  ];
  personas.forEach(([[x, y, z], giro, pose], k) => { const p = crearPersona({semilla: 4100 + k * 7, pose}); p.position.set(x, y, z); p.rotation.y = giro; vida.add(p); });
}
