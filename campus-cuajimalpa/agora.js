// Ágora de la UAM Cuajimalpa. Diseño y propuesta original de Daniela Nava Martínez (issue #37, PR #45);
// reconstruido con fotos de campo (23 oct 2026) y Esri World Imagery z19. Medidas y alturas aproximadas.
// Coordenadas del grupo: x a lo largo del edificio (ESE, +u del marco CU_FRAME), z hacia el SSO (se aleja del edificio), y hacia arriba.
// El origen es el ancla medida (local CU (-16, 57)); el foro mira al edificio (−z) y las gradas suben hacia +z.
import * as THREE from 'three';

// ctx = {box(parent,name,x,y,z,w,h,d,color), material(color)} de app.js.
export function construirAgora(g, ctx) {
  ctx.box(g, 'Agora_provisional', 0, 4, 0, 30, 8, 24, '#f5f4ef');
}
