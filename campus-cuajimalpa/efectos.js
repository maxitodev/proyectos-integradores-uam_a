// efectos.js · Cielo físico (Preetham), hora del día, nublado y postproceso en tiempo real para el visor.
// Sólo afecta a la VISTA: nada de esto entra al GLB (todo cuelga de `scene`, no de `world`) ni al plano 2D (ver modoPlano()).
// Imports sólo con nombres planos del importmap (también válido para el visor autónomo de build.mjs).
import * as THREE from 'three';
import {Sky} from 'sky';
import {EffectComposer} from 'post-composer';
import {RenderPass} from 'post-render';
import {GTAOPass} from 'post-gtao';
import {UnrealBloomPass} from 'post-bloom';
import {OutputPass} from 'post-output';
import {SMAAPass} from 'post-smaa';
import {posicionSolar, direccionSolar, paletaLuz, parametrosCielo, colorHorizonte, colorNiebla, LUNA, formatoHora, parchearFragmentoCielo} from 'efectos-solar';
export {formatoHora, parchearFragmentoCielo};

const ESCALA_CIELO = 450000;   // medida de la caja de Sky en los ejemplos de three; el shader fija z=w, así que nunca lo recorta el far
const ELEV_MIN_LUZ = 5;        // la luz direccional no baja de 5° para que las sombras sigan estables (el disco del cielo sí baja)

// ───────────────────────── AO: GTAOPass de three adaptado a la escena ─────────────────────────
/** ¿Debe quedar fuera de la pasada de normales/profundidad del AO? Transparentes (redes, techos, rótulos), líneas, puntos y el cielo. */
function sinAO(o) {
  if (o.isPoints || o.isLine || o.isSprite || o.isSky) return true;
  if (o.userData && o.userData.sinAO) return true;
  const m = o.material;
  if (!m) return false;
  return Array.isArray(m) ? m.some(x => x.transparent || x.depthWrite === false) : (m.transparent === true || m.depthWrite === false);
}
class GTAOPassCampus extends GTAOPass {
  // La pasada de normales usa scene.overrideMaterial (opaco): sin este filtro las mallas transparentes harían sombra de AO.
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse(o => { cache.set(o, o.visible); if (sinAO(o)) o.visible = false; });
  }
  // renderer.render() recalcularía el mapa de sombras de 4096 px; el RenderPass ya lo dejó listo en este cuadro.
  renderOverride(renderer, material, destino, color, alfa) {
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try { super.renderOverride(renderer, material, destino, color, alfa); } finally { renderer.shadowMap.autoUpdate = auto; this.scene.overrideMaterial = null; }
  }
  // Si la pasada lanza una excepción, devuelve la visibilidad de los objetos (nada queda oculto ni con material de normales).
  render(...a) { try { super.render(...a); } finally { if (this._visibilityCache.size) this.restoreVisibility(); } }
}

/**
 * Crea el sistema de efectos. Se llama una vez, después de crear `sun` y `hemi`.
 *  · renderer, scene: los del visor.
 *  · getCamera: () => cámara activa (el visor alterna perspectiva/ortográfica).
 *  · getSun / hemi: DirectionalLight y HemisphereLight (objeto o función que lo devuelva).
 *  · fog: scene.fog (THREE.Fog) o null.
 *  · sky: opcional. Si es el Sky de Preetham se reutiliza; si es otra malla (el degradado anterior) se retira de la escena y se desecha.
 *  · norte: {x,z} vector unitario del norte geográfico en XZ (por omisión (0,-1)); ver setNorte().
 *  · opciones: {horaInicial=14.5, nubladoInicial=0, desfaseAcimut=0, distanciaLuz, entornoIntensidad=.25, pixelRatioMax=1.5, onCambio, onModoPlano}.
 */
export function createEfectos({renderer, scene, getCamera, getSun, hemi, sky, fog = null, norte, opciones = {}}) {
  const dame = v => typeof v === 'function' ? v() : v;
  if (typeof getCamera !== 'function') throw new Error('createEfectos: getCamera debe ser una función que devuelva la cámara activa.');
  const sol0 = dame(getSun), hemi0 = dame(hemi);
  if (!sol0 || !hemi0) throw new Error('createEfectos: crea `sun` y `hemi` antes de llamar a createEfectos.');
  const cfg = {horaInicial: 14.5, nubladoInicial: 0, desfaseAcimut: 0, entornoIntensidad: 0.25, pixelRatioMax: 1.5, ...opciones};
  const distanciaLuz = cfg.distanciaLuz || sol0.position.length() || 573.4;

  // Ajustes visibles: se pueden editar y luego llamar a aplicarAjustes().
  const ajustes = {
    activos: {ao: true, brillo: true, smaa: true},
    // Unidades en metros. radius = alcance del AO; thickness = diferencia de profundidad máxima que cuenta como oclusor.
    ao: {radius: 6, thickness: 6, distanceExponent: 1.4, scale: 1, samples: 16, distanceFallOff: 1, intensidad: 0.85,
      denoise: {lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 16}},
    brillo: {strength: 0.12, radius: 0.5, threshold: 0.9},
    entorno: {intensidad: cfg.entornoIntensidad, umbralHora: 0.25, umbralNublado: 0.2},
    pixelRatioMax: cfg.pixelRatioMax,
  };

  // Iluminación original del visor: es la que usa modoPlano() para que plano_2d.png no dependa de la hora.
  const ref = {pos: sol0.position.clone(), color: sol0.color.clone(), int: sol0.intensity, hemiCielo: hemi0.color.clone(), hemiSuelo: hemi0.groundColor.clone(),
    hemiInt: hemi0.intensity, expo: renderer.toneMappingExposure};
  const nieblaBase = fog ? {near: fog.near, far: fog.far} : null;

  // ── Cielo ──
  if (sky && !sky.isSky) { sky.removeFromParent(); sky.geometry?.dispose(); sky.material?.dispose(); sky = null; }
  const cielo = sky || new Sky();
  cielo.name = 'Cielo'; cielo.scale.setScalar(ESCALA_CIELO); cielo.position.set(0, 0, 0); cielo.frustumCulled = false; cielo.renderOrder = -1;
  const mat = cielo.material;
  mat.fog = false; mat.depthWrite = false;
  Object.assign(mat.uniforms, {uGanancia: {value: 0.44}, uSaturacion: {value: 1}, uDisco: {value: 1}, uTinte: {value: new THREE.Vector3(1, 1, 1)}});
  mat.onBeforeCompile = sh => {
    const r = parchearFragmentoCielo(sh.fragmentShader); sh.fragmentShader = r.src;
    if (r.fallos.length) console.warn('efectos: el shader de Sky no coincide con r160; el cielo se verá sin ajuste de color.', r.fallos);
  };
  mat.customProgramCacheKey = () => 'cielo-uam-1';
  mat.needsUpdate = true;
  if (!cielo.parent) scene.add(cielo);
  const U = mat.uniforms;

  // ── Estado ──
  let hora = cfg.horaInicial, nublado = cfg.nubladoInicial, norteEscena = norte && Number.isFinite(norte.x) && Number.isFinite(norte.z) ? {x: norte.x, z: norte.z} : {x: 0, z: -1};
  let usarPost = false, enPlano = false, estadoActual = null;
  let pmrem = null, rtEntorno = null, escenaEnt = null, cieloEnt = null, horaEnt = NaN, nubEnt = NaN;
  let post = null, ultimo = null, claveAO = '', fallo = false;

  // ── Luz, cielo y niebla según hora y nublado ──
  function aplicarLuz() {
    const sol = dame(getSun), hm = dame(hemi);
    const pos = posicionSolar(hora, {desfaseAcimut: cfg.desfaseAcimut});
    const dirSol = direccionSolar(pos.elevacion, pos.acimut, norteEscena);
    const pc = parametrosCielo(pos.elevacion, nublado), pl = paletaLuz(pos.elevacion, nublado);

    U.sunPosition.value.set(dirSol.x, dirSol.y, dirSol.z);
    U.turbidity.value = pc.turbidity; U.rayleigh.value = pc.rayleigh; U.mieCoefficient.value = pc.mieCoefficient; U.mieDirectionalG.value = pc.mieDirectionalG;
    U.uGanancia.value = pc.ganancia; U.uSaturacion.value = pc.saturacion; U.uTinte.value.set(...pc.tinte); U.uDisco.value = pc.disco;

    // Luz direccional: el sol; con el sol bajo −3° pasa a «luna» (la intensidad de ambas es 0 en el cruce, así que el cambio de dirección no se nota).
    const dirLuz = pl.luna ? direccionSolar(LUNA.elevacion, LUNA.acimut + cfg.desfaseAcimut, norteEscena)
      : direccionSolar(Math.max(pos.elevacion, ELEV_MIN_LUZ), pos.acimut, norteEscena);
    sol.position.set(dirLuz.x * distanciaLuz, dirLuz.y * distanciaLuz, dirLuz.z * distanciaLuz);
    sol.color.setRGB(...pl.solColor, THREE.SRGBColorSpace); sol.intensity = pl.solInt;
    hm.color.setRGB(...pl.hemiCielo, THREE.SRGBColorSpace); hm.groundColor.setRGB(...pl.hemiSuelo, THREE.SRGBColorSpace); hm.intensity = pl.hemiInt;
    renderer.toneMappingExposure = pl.expo;

    estadoActual = {hora, elevacion: pos.elevacion, acimut: pos.acimut, direccion: dirSol, noche: pl.noche, luna: pl.luna, nublado, expo: pl.expo, params: pc,
      horizonte: colorHorizonte(dirSol, pc)};
    aplicarNiebla();
  }
  // La niebla se mezcla en espacios distintos según el camino de render (ver colorNiebla en efectos-solar.js).
  function aplicarNiebla() {
    if (!fog || !estadoActual) return;
    const c = colorNiebla(estadoActual.horizonte, estadoActual.expo, usarPost, nublado);
    fog.color.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
    if (nieblaBase) { fog.near = nieblaBase.near * (1 - 0.4 * nublado); fog.far = nieblaBase.far * (1 - 0.35 * nublado); }
  }
  // Iluminación original (modoPlano): mismas posiciones y colores que antes de integrar los efectos.
  function aplicarReferencia() {
    const sol = dame(getSun), hm = dame(hemi);
    sol.position.copy(ref.pos); sol.color.copy(ref.color); sol.intensity = ref.int;
    hm.color.copy(ref.hemiCielo); hm.groundColor.copy(ref.hemiSuelo); hm.intensity = ref.hemiInt;
    renderer.toneMappingExposure = ref.expo;
  }

  // ── Entorno (PMREM del propio cielo) para reflejos y ambiente suaves ──
  // Coste: una pasada de cielo a cubo de 256 px + convolución PMREM (unos milisegundos de GPU; la primera vez compila shaders).
  // three r160 no tiene scene.environmentIntensity: la intensidad se aplica atenuando el cielo al generar el mapa.
  const entornoSucio = () => !rtEntorno || Math.abs(hora - horaEnt) > ajustes.entorno.umbralHora || Math.abs(nublado - nubEnt) > ajustes.entorno.umbralNublado;
  function regenerarEntorno() {
    if (enPlano) return;                                 // al salir de modoPlano() se vuelve a evaluar
    try {
      pmrem ||= new THREE.PMREMGenerator(renderer);
      if (!escenaEnt) {                                  // malla gemela (misma geometría y material) en una escena aparte, centrada en el origen
        escenaEnt = new THREE.Scene(); cieloEnt = new THREE.Mesh(cielo.geometry, cielo.material);
        cieloEnt.scale.setScalar(ESCALA_CIELO); cieloEnt.frustumCulled = false; escenaEnt.add(cieloEnt);
      }
      const g = U.uGanancia.value;
      U.uGanancia.value = g * ajustes.entorno.intensidad;
      let nuevo;
      try { nuevo = pmrem.fromScene(escenaEnt, 0, 0.1, 100); } finally { U.uGanancia.value = g; }
      rtEntorno?.dispose(); rtEntorno = nuevo; scene.environment = nuevo.texture;
      horaEnt = hora; nubEnt = nublado;
    } catch (e) { console.warn('efectos: no se pudo generar el entorno PMREM', e); }
  }

  // ── Postproceso: RenderPass → GTAO (AO) → Bloom → OutputPass (mapeo tonal + sRGB, una sola vez) → SMAA ──
  // El composer trabaja con tamaños enteros en píxeles de dispositivo (pixelRatio del composer = 1): evita texturas de tamaño fraccionario.
  function tamPost() {
    const s = renderer.getSize(new THREE.Vector2()), t = ultimo || {w: s.x, h: s.y, pr: renderer.getPixelRatio()}, pr = Math.min(t.pr, ajustes.pixelRatioMax || t.pr);
    return {w: Math.max(1, Math.floor(t.w * pr)), h: Math.max(1, Math.floor(t.h * pr)), pr};
  }
  function crearPost() {
    const {w, h, pr} = tamPost();
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1); composer.setSize(w, h);
    const cam = getCamera();
    const pasoRender = new RenderPass(scene, cam), ao = new GTAOPassCampus(scene, cam, w, h), brillo = new UnrealBloomPass(new THREE.Vector2(w, h), 1, 0.5, 0.9),
      salida = new OutputPass(), smaa = new SMAAPass(w, h);
    for (const p of [pasoRender, ao, brillo, salida, smaa]) composer.addPass(p);
    post = {composer, pasoRender, ao, brillo, salida, smaa, pr};
    claveAO = ''; aplicarAjustes();
  }
  function aplicarAjustes() {
    if (!post) return;
    const {ao, brillo, smaa} = post, a = ajustes;
    const clave = JSON.stringify(a.ao);
    if (clave !== claveAO) {                           // updateGtaoMaterial marca el material para recompilar; sólo si hubo cambios
      claveAO = clave;
      const {radius, thickness, distanceExponent, scale, samples, distanceFallOff} = a.ao;
      ao.updateGtaoMaterial({radius, thickness, distanceExponent, scale, samples, distanceFallOff});
      ao.updatePdMaterial(a.ao.denoise); ao.blendIntensity = a.ao.intensidad;
    }
    brillo.strength = a.brillo.strength; brillo.radius = a.brillo.radius; brillo.threshold = a.brillo.threshold;
    ao.enabled = a.activos.ao; brillo.enabled = a.activos.brillo; smaa.enabled = a.activos.smaa;
    if (ultimo && tamPost().pr !== post.pr) resize(ultimo.w, ultimo.h, ultimo.pr);
  }
  function resize(w, h, pixelRatio) {
    ultimo = {w, h, pr: pixelRatio || renderer.getPixelRatio()};
    if (!post) return;
    const t = tamPost(); post.pr = t.pr;
    post.composer.setSize(t.w, t.h);                   // reparte el tamaño efectivo a todas las pasadas
  }
  function ponerPost(v) {
    v = !!v;
    if (v === usarPost) return;
    if (v) {
      if (fallo) return;
      if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) { fallo = true; console.warn('efectos: sin buffers de media precisión; se usa el render directo.'); return; }
      try { if (!post) crearPost(); } catch (e) { fallo = true; post = null; console.error('efectos: no se pudo crear el postproceso; se usa el render directo.', e); return; }
    }
    usarPost = v; aplicarNiebla();
  }
  // (los render targets del composer se conservan mientras se alternan los efectos para no recompilar shaders cada vez)

  /** Reemplaza a renderer.render(scene,camera). Con efectos activos dibuja el resultado final en el canvas (válido para drawImage). */
  function render() {
    const cam = getCamera();
    if (!usarPost || !post) { renderer.render(scene, cam); return; }
    post.pasoRender.camera = cam; post.ao.camera = cam;  // el visor alterna cámara perspectiva/ortográfica
    const auto = renderer.autoClear;
    try { post.composer.render(); }
    catch (e) {                                          // ante cualquier fallo de GPU: vuelve al render directo y no insiste
      console.error('efectos: falló el postproceso; se desactiva.', e);
      renderer.setRenderTarget(null); renderer.autoClear = auto; fallo = true; ponerPost(false); renderer.render(scene, cam);
    }
  }

  // ── API de hora y nublado ──
  function aplicarTodo() {
    if (enPlano) return;                                 // hora y nublado quedan guardados; se aplican al salir de modoPlano()
    aplicarLuz();
    if (entornoSucio()) regenerarEntorno();
    api.onCambio?.(api.estado);
  }
  function setHora(h) { h = Number(h); if (!Number.isFinite(h)) return; hora = ((h % 24) + 24) % 24; aplicarTodo(); }
  function setNublado(n) { n = Number(n); if (!Number.isFinite(n)) return; nublado = Math.min(1, Math.max(0, n)); aplicarTodo(); }
  /** Norte geográfico en el plano XZ de la escena, p. ej. campusNorth(georeference); null restablece (0,-1). */
  function setNorte(n) { norteEscena = n && Number.isFinite(n.x) && Number.isFinite(n.z) && (n.x || n.z) ? {x: n.x, z: n.z} : {x: 0, z: -1}; aplicarTodo(); }
  /** Fuerza la regeneración del entorno (útil al soltar el control deslizante). */
  function actualizarEntorno() { regenerarEntorno(); }

  /**
   * Para exportar el plano 2D: luz original, sin cielo ni entorno. Devuelve la función que lo deshace (llamarla en `finally`).
   * Llamar ANTES de copiar renderer.toneMappingExposure al render del plano. Mientras dura, setHora/setNublado se aplazan.
   */
  function modoPlano() {
    if (enPlano) return () => {};
    enPlano = true;
    const visible = mat.visible;                         // material.visible (no object.visible): la lista `ocultos` del visor puede seguir incluyendo `sky`
    mat.visible = false; scene.environment = null; aplicarReferencia();
    api.onModoPlano?.(true);                             // p. ej. apagar luminarias nocturnas antes de exportar
    let listo = false;
    return () => {
      if (listo) return; listo = true; enPlano = false;
      mat.visible = visible; scene.environment = rtEntorno ? rtEntorno.texture : null;
      api.onModoPlano?.(false);
      aplicarTodo();
    };
  }

  function dispose() {
    post?.composer.dispose(); for (const p of post ? [post.pasoRender, post.ao, post.brillo, post.salida, post.smaa] : []) p.dispose?.();
    post = null; usarPost = false; rtEntorno?.dispose(); rtEntorno = null; scene.environment = null; pmrem?.dispose(); pmrem = null;
    scene.remove(cielo); cielo.geometry.dispose(); mat.dispose();
  }

  const api = {
    version: '1.0', sky: cielo, ajustes, onCambio: cfg.onCambio || null, onModoPlano: cfg.onModoPlano || null,
    setHora, getHora: () => hora, setNublado, getNublado: () => nublado, setNorte, actualizarEntorno,
    get usePost() { return usarPost; }, set usePost(v) { ponerPost(v); },
    aplicarAjustes, render, resize, modoPlano, dispose,
    /** {hora, elevacion, acimut, direccion, noche(0..1), luna, nublado, expo, params} de la última aplicación. */
    get estado() { return estadoActual && {...estadoActual}; },
  };

  aplicarTodo();
  return api;
}
