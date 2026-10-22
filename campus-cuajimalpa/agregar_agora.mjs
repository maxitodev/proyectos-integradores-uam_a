
import fs from 'node:fs';

const archivo = new URL('./app.js', import.meta.url);
const original = fs.readFileSync(archivo, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let s = original.replace(/\r\n/g, '\n');

const funcion = `function cuajimalpaAgora() {
  const g = new THREE.Group();
  g.name = 'Agora_Cuajimalpa';
  g.position.set(-105, 0, 66);
  g.rotation.y = -Math.PI / 4;
  world.add(g);

  g.userData.approximate = true;
  g.userData.placementPending = true;

  const mat = (color, roughness = 0.82) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness
    });

  const white = mat('#f5f4ef');
  const steel = mat('#c6cdd0', 0.42);
  const dark = mat('#292d31');
  const concrete = mat('#cbc9c0');
  const grass = mat('#71985c');
  const orange = mat('#e98235');
  const skin = mat('#d5a17e');
  const hair = mat('#49352c');

  function part(
    name, geometry, material,
    x, y, z, sx = 1, sy = 1, sz = 1
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }

  function beam(name, a, b, radius, material = steel) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);

    const mesh = part(
      name,
      new THREE.CylinderGeometry(
        radius, radius, direction.length(), 8
      ),
      material,
      ...start.clone().add(end).multiplyScalar(0.5).toArray()
    );

    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return mesh;
  }

  // --------------------------------------------------
  // 1. PLAZA Y ÁREA VERDE
  // --------------------------------------------------

  part(
    'Pavimento_general',
    new THREE.BoxGeometry(34, 0.24, 25),
    concrete,
    0, 0.12, 1
  );

  part(
    'Jardin_central',
    new THREE.BoxGeometry(32, 0.18, 12),
    grass,
    0, 0.22, 16
  );

  // Sendero central de circulación.
  part(
    'Sendero_central',
    new THREE.BoxGeometry(2.4, 0.07, 18),
    mat('#dedbd1'),
    0, 0.34, 7
  );

  // --------------------------------------------------
  // 2. ESCENARIO PRINCIPAL
  // --------------------------------------------------

  part(
    'Escenario_principal',
    new THREE.BoxGeometry(13, 0.72, 5.5),
    dark,
    0, 0.62, -7.1
  );

  part(
    'Frente_escenario',
    new THREE.BoxGeometry(12.8, 0.12, 0.18),
    steel,
    0, 0.98, -9.85
  );

  // Dos pantallas laterales.
  for (const x of [-10.2, 10.2]) {
    part(
      'Marco_pantalla',
      new THREE.BoxGeometry(4.5, 3.5, 0.28),
      dark,
      x, 3.25, -8.9
    );

    part(
      'Pantalla_digital',
      new THREE.BoxGeometry(4.12, 3.12, 0.06),
      mat('#304954', 0.35),
      x, 3.28, -8.72
    );

    part(
      'Base_pantalla',
      new THREE.BoxGeometry(0.22, 2.2, 0.22),
      steel,
      x, 1.55, -8.9
    );
  }

  // --------------------------------------------------
  // 3. GRADAS FRONTALES
  // --------------------------------------------------

  for (let row = 0; row < 5; row++) {
    const z = -2.2 + row * 1.45;
    const height = 0.28 + row * 0.2;
    const width = 20 - row * 0.6;

    part(
      'Grada_frontal',
      new THREE.BoxGeometry(width, height, 1.05),
      mat(row % 2 ? '#c8c6bd' : '#b8b6ad'),
      0, 0.25 + height / 2, z
    );

    // Personas sentadas en las gradas.
    for (let col = -4; col <= 4; col += 2) {
      const x = col * 1.65 + (row % 2 ? 0.5 : 0);
      const shirtColors = [
        '#477ca6', '#b45e48', '#d6b44b', '#566d57'
      ];
      const shirt = mat(
        shirtColors[Math.abs(row + col + 8) % shirtColors.length]
      );

      part(
        'Persona_sentada_cuerpo',
        new THREE.BoxGeometry(0.34, 0.52, 0.3),
        shirt,
        x, 0.48 + height / 2, z + 0.05,
        0.9, 0.9, 0.9
      );

      part(
        'Persona_sentada_cabeza',
        new THREE.SphereGeometry(0.16, 8, 7),
        skin,
        x, 0.83 + height / 2, z + 0.02,
        0.9, 0.9, 0.9
      );
    }
  }

  // --------------------------------------------------
  // 4. CUBIERTA BLANCA CON ELEVACIÓN CENTRAL
  // --------------------------------------------------

  const vertices = [];
  const indices = [];
  const nx = 12;
  const nz = 10;

  for (let iz = 0; iz <= nz; iz++) {
    const v = iz / nz;
    const z = -12 + v * 23;

    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx;
      const x = -14 + u * 28;

      const edge = Math.max(
        Math.abs(x) / 14,
        Math.abs(z) / 12
      );

      const y =
        10.1 +
        2.15 * (1 - Math.min(edge, 1)) +
        0.25 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);

      vertices.push(x, y, z);
    }
  }

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;

      indices.push(a, c, b, b, c, d);
    }
  }

  const roofGeometry = new THREE.BufferGeometry();

  roofGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  roofGeometry.setIndex(indices);
  roofGeometry.computeVertexNormals();

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: '#f7f6f0',
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0
  });

  part(
    'Cubierta_tensada_blanca',
    roofGeometry,
    roofMaterial,
    0, 0, 0
  );

  // Mástiles y tensores metálicos.
  for (const x of [-13.3, 13.3]) {
    for (const z of [-10.5, 9.5]) {
      beam(
        'Mastil_perimetral',
        [x, 0.3, z],
        [x, 10.2, z],
        0.14
      );

      beam(
        'Tirante_cubierta',
        [x, 9.8, z],
        [0, 12.25, -0.2],
        0.055
      );
    }
  }

  beam(
    'Viga_lateral_izquierda',
    [-13.2, 8.7, -10.5],
    [-13.2, 8.7, 9.5],
    0.09
  );

  beam(
    'Viga_lateral_derecha',
    [13.2, 8.7, -10.5],
    [13.2, 8.7, 9.5],
    0.09
  );

  // --------------------------------------------------
  // 5. MESAS NARANJAS Y SOMBRILLAS BLANCAS
  // --------------------------------------------------

  for (const [x, z] of [
    [-7, 14],
    [7, 14],
    [-7, 19],
    [7, 19]
  ]) {
    part(
      'Mesa_naranja',
      new THREE.CylinderGeometry(0.85, 0.85, 0.13, 12),
      orange,
      x, 0.95, z,
      1.15, 1, 0.78
    );

    beam(
      'Pata_mesa',
      [x, 0.3, z],
      [x, 0.9, z],
      0.07
    );

    beam(
      'Poste_sombrilla',
      [x, 1, z],
      [x, 3.15, z],
      0.045
    );

    const umbrella = part(
      'Sombrilla_blanca',
      new THREE.ConeGeometry(1.55, 0.55, 8),
      white,
      x, 3.15, z,
      1.05, 0.7, 0.85
    );

    umbrella.rotation.y = Math.PI / 8;

    for (const [dx, dz] of [
      [-1.25, 0],
      [1.25, 0],
      [0, -0.9],
      [0, 0.9]
    ]) {
      part(
        'Banco_mesa',
        new THREE.BoxGeometry(0.72, 0.12, 0.32),
        mat('#d9d5ca'),
        x + dx, 0.48, z + dz
      );
    }
  }

  // --------------------------------------------------
  // 6. ÁRBOLES DE DIFERENTES TIPOS Y TAMAÑOS
  // --------------------------------------------------

  const treeTypes = [
    { x: -12, z: 15, h: 3.8, r: 1.35, color: '#477849' },
    { x: 12, z: 15, h: 3.2, r: 1.05, color: '#689653' },
    { x: -12, z: 21, h: 4.4, r: 1.15, color: '#356c43' },
    { x: 12, z: 21, h: 3.5, r: 1.45, color: '#59864b' },
    { x: -15, z: 18, h: 3.0, r: 1.0, color: '#719c58' },
    { x: 15, z: 18, h: 4.0, r: 1.25, color: '#3d7448' }
  ];

  for (const tree of treeTypes) {
    beam(
      'Tronco_arbol',
      [tree.x, 0.25, tree.z],
      [tree.x, tree.h, tree.z],
      0.16,
      mat('#79563b')
    );

    // Ramas.
    for (const side of [-1, 1]) {
      beam(
        'Rama_arbol',
        [tree.x, tree.h * 0.55, tree.z],
        [
          tree.x + side * 0.65,
          tree.h * 0.78,
          tree.z + 0.12
        ],
        0.075,
        mat('#79563b')
      );
    }

    const crownMaterial = mat(tree.color);

    // Varias esferas para copas orgánicas.
    for (const [dx, dy, dz, sx, sy, sz] of [
      [0, 0, 0, 1.0, 1.0, 1.0],
      [-0.55, -0.25, 0.15, 0.72, 0.76, 0.75],
      [0.52, -0.18, -0.12, 0.78, 0.82, 0.8],
      [0, 0.55, -0.08, 0.72, 0.8, 0.72]
    ]) {
      part(
        'Copa_arbol_variada',
        new THREE.SphereGeometry(1, 12, 10),
        crownMaterial,
        tree.x + dx * tree.r,
        tree.h + dy * tree.r,
        tree.z + dz * tree.r,
        tree.r * sx,
        tree.r * sy,
        tree.r * sz
      );
    }
  }

  // --------------------------------------------------
  // 7. ARBUSTOS Y SETOS ORNAMENTALES
  // --------------------------------------------------

  const bushes = [
    [-13.3, 13.2], [-14.2, 15.0],
    [-13.5, 17.2], [-14.1, 20.0],
    [-13.2, 22.4], [13.3, 13.2],
    [14.2, 15.0], [13.5, 17.2],
    [14.1, 20.0], [13.2, 22.4],
    [-9.8, 22.5], [-6.5, 22.7],
    [6.5, 22.7], [9.8, 22.5]
  ];

  const bushColors = [
    '#477c45',
    '#5e914d',
    '#709e55',
    '#386b3e'
  ];

  bushes.forEach(([x, z], i) => {
    const size = 0.42 + (i % 3) * 0.12;

    part(
      'Arbusto_ornamental',
      new THREE.SphereGeometry(1, 10, 8),
      mat(bushColors[i % bushColors.length]),
      x, 0.48, z,
      size * 1.3, size, size
    );

    part(
      'Follaje_superior',
      new THREE.SphereGeometry(1, 9, 7),
      mat(bushColors[(i + 1) % bushColors.length]),
      x + 0.12, 0.65, z - 0.08,
      size * 0.78, size * 0.8, size * 0.8
    );
  });

  // --------------------------------------------------
  // 8. PLANTAS ORNAMENTALES DE HOJAS ALARGADAS
  // --------------------------------------------------

  const ornamentalPlants = [
    [-13, 14], [-13.7, 18.5], [-13.4, 22],
    [13, 14], [13.7, 18.5], [13.4, 22],
    [-10, 12], [10, 12], [-10, 23], [10, 23]
  ];

  ornamentalPlants.forEach(([x, z], i) => {
    const leafColors = [
      '#638f4d',
      '#86a95b',
      '#477746'
    ];

    for (let k = 0; k < 5; k++) {
      const angle = k * Math.PI * 2 / 5;
      const height = 0.45 + (k % 3) * 0.12;

      const leaf = part(
        'Hoja_ornamental',
        new THREE.ConeGeometry(0.13, height, 5),
        mat(leafColors[(i + k) % leafColors.length]),
        x + Math.cos(angle) * 0.16,
        0.38 + height * 0.45,
        z + Math.sin(angle) * 0.16,
        0.75, 1, 0.75
      );

      leaf.rotation.z = Math.cos(angle) * 0.28;
      leaf.rotation.x = Math.sin(angle) * 0.28;
    }
  });

  // --------------------------------------------------
  // 9. PEQUEÑOS GRUPOS DE FLORES
  // --------------------------------------------------

  const flowerBeds = [
    [-14.4, 16.2],
    [-14.3, 21.2],
    [14.4, 16.2],
    [14.3, 21.2]
  ];

  flowerBeds.forEach(([x, z], i) => {
    const flowerColors = [
      '#e5c3d5',
      '#f0d18a',
      '#d8b5e8'
    ];

    for (let k = 0; k < 5; k++) {
      const fx = x + (k - 2) * 0.18;
      const fz = z + (k % 2) * 0.15;

      part(
        'Flor_ornamental',
        new THREE.SphereGeometry(0.11, 8, 6),
        mat(flowerColors[(i + k) % flowerColors.length]),
        fx, 0.48 + (k % 2) * 0.04, fz,
        1, 0.8, 1
      );
    }
  });

  // --------------------------------------------------
  // 10. PERSONAS A ESCALA HUMANA
  // --------------------------------------------------

  function person(x, z, scale = 1, shirt = '#477ca6') {
    const y = 0.25;

    part(
      'Persona_cuerpo',
      new THREE.CylinderGeometry(0.18, 0.23, 0.72, 8),
      mat(shirt),
      x, y + 0.62 * scale, z,
      scale, scale, scale
    );

    part(
      'Persona_cabeza',
      new THREE.SphereGeometry(0.19, 10, 8),
      skin,
      x, y + 1.12 * scale, z,
      scale, scale, scale
    );

    part(
      'Cabello_persona',
      new THREE.SphereGeometry(0.195, 10, 7),
      hair,
      x, y + 1.22 * scale, z,
      scale, 0.62 * scale, scale
    );

    for (const dx of [-0.105, 0.105]) {
      beam(
        'Pierna_persona',
        [x + dx * scale, y + 0.34 * scale, z],
        [x + dx * scale * 1.2, y + 0.05, z + 0.04],
        0.055,
        dark
      );

      beam(
        'Brazo_persona',
        [x + dx * scale * 1.6, y + 0.83 * scale, z],
        [x + dx * scale * 2.1, y + 0.48 * scale, z + 0.04],
        0.045,
        skin
      );
    }
  }

  const crowd = [
    [-8, 4, 0.95, '#547fa2'],
    [-5, 5, 1, '#c46b52'],
    [-1, 6, 0.95, '#d6b64b'],
    [4, 5, 1, '#5a8260'],
    [8, 3, 0.9, '#8a6a9d'],
    [-10, 11, 0.9, '#b65c4c'],
    [-3, 12, 0.92, '#477ca6'],
    [3, 13, 1, '#bd8051'],
    [10, 11, 0.95, '#526f8d'],
    [-5, 17, 0.9, '#a85b51'],
    [5, 18, 0.9, '#477b63']
  ];

  for (const p of crowd) {
    person(...p);
  }

  // --------------------------------------------------
  // 11. REGISTRO EN EL EDITOR DEL CAMPUS
  // --------------------------------------------------

  registerEditable(
    'agora_cuajimalpa',
    'Ágora de Cuajimalpa · posición aproximada',
    'landmark',
    g
  );

  if (g.parent) {
    label(
      'Ágora de Cuajimalpa',
      g.position.x,
      15,
      g.position.z,
      'place'
    );
  }
}
`;


const inicioAgora = s.indexOf('function cuajimalpaAgora(');
const inicioFacades = s.indexOf('function cuajimalpaFacades(');

if (inicioFacades === -1) {
  console.error('No se encontró function cuajimalpaFacades() en app.js.');
  process.exit(1);
}

// Sustituye la función existente o la inserta antes de cuajimalpaFacades().
if (inicioAgora !== -1 && inicioAgora < inicioFacades) {
  const siguienteFuncion = s.indexOf('\nfunction ', inicioAgora + 1);

  if (siguienteFuncion !== -1 && siguienteFuncion < inicioFacades) {
    s =
      s.slice(0, inicioAgora) +
      funcion +
      '\n\n' +
      s.slice(siguienteFuncion + 1);
  } else {
    s =
      s.slice(0, inicioAgora) +
      funcion +
      '\n\n' +
      s.slice(inicioFacades);
  }
} else {
  s =
    s.slice(0, inicioFacades) +
    funcion +
    '\n\n' +
    s.slice(inicioFacades);
}

// Agrega la llamada solamente si todavía no existe.
if (!/^\s*cuajimalpaAgora\(\);\s*$/m.test(s)) {
  const reLlamada =
    /^([ \t]*)(cuajimalpaAccessPath\(\);)[ \t]*$/m;

  if (!reLlamada.test(s)) {
    console.error('No se encontró la llamada a cuajimalpaAccessPath() en app.js.');
    process.exit(1);
  }

  s = s.replace(
    reLlamada,
    (m, sangria) => m + '\n' + sangria + 'cuajimalpaAgora();'
  );
}

fs.writeFileSync(archivo, s.replace(/\n/g, eol));

console.log('Ágora actualizado correctamente en app.js.');
console.log('Ahora ejecuta: node build.mjs');

