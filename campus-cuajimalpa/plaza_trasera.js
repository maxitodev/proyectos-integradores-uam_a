// Plaza trasera, letras «soy uam» y franja del costado de la unidad (Práctica 3, parte de Daniela Nava Martínez).
// Reconstruidos con fotos de campo (23 oct 2026) y Esri World Imagery z19; posiciones y medidas aproximadas.
// construirPlazaTrasera y construirCostado reciben el grupo del marco CU_FRAME (x = u local, z = v local, en metros);
// construirLetrero recibe su propio grupo editable con origen en el centro de la base de las letras.
import * as THREE from 'three';

export function construirPlazaTrasera(sector, ctx) {}
export function construirCostado(sector, ctx) {}
export function construirLetrero(g, ctx) {
  ctx.box(g, 'Letrero_provisional', 0, 1.2, 0, 11, 2.4, .6, '#f4f3ee');
}
