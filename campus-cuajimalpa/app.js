import * as THREE from 'three';
import {OrbitControls} from 'orbit';
import {GLTFExporter} from 'exporter';
import {ORIGINAL} from 'model-data';
import {copyrightPanelsForSite} from 'copyright-layout';

const UNIT=ORIGINAL.unit;
const $=id=>document.getElementById(id);
const editables=new Map();
let editMode=false,editSelected='',undoHistory=[],redoHistory=[],savedData='',isSaving=false,drawStart=null,drawPreview=null,dragEdit=null;
let georeference=null,focusSpan=65,minFocusDistance=175;
let data=structuredClone(ORIGINAL), world, vegetation, buildingGroups=new Map(), labels=[], selected='', topMode=false,focusMode=false;
const mount=$('viewport'), labelLayer=$('labels');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#edf1ed');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
mount.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#dce6ea',900,2400);
// Cielo con degradado (sólo vista; no entra al GLB ni al plano 2D).
const sky=new THREE.Mesh(new THREE.SphereGeometry(2600,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color('#5f97d2')},mid:{value:new THREE.Color('#a9c8e2')},low:{value:new THREE.Color('#dce6ea')}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top,mid,low;varying vec3 vP;void main(){float h=normalize(vP).y;vec3 c=h<0.0?low:mix(low,mix(mid,top,smoothstep(.25,.9,h)),smoothstep(0.,.3,h));gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));sky.name='Cielo';sky.renderOrder=-1;scene.add(sky);
scene.add(new THREE.HemisphereLight('#fff6e6','#4b6750',2.3));
const sun=new THREE.DirectionalLight('#ffeccb',3.3);sun.position.set(-330,430,300);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-330,right:330,top:330,bottom:-330,near:1,far:1100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.5;scene.add(sun);
const perspective=new THREE.PerspectiveCamera(42,1,1,3000), ortho=new THREE.OrthographicCamera(-460,460,270,-270,1,2500);let camera=perspective;
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=30;controls.maxDistance=1500;controls.maxPolarAngle=THREE.MathUtils.degToRad(78);controls.target.set(0,0,10);
const grid=new THREE.GridHelper(1000,100,'#6f8f80','#b9c9bc');grid.position.y=.3;grid.visible=false;scene.add(grid);
const matCache=new Map();
// Detalle fotográfico (texturas CC0 de ambientCG en texturas/): se proyecta en coordenadas del mundo dentro del shader y no es material.map,
// así el GLB y el plano 2D conservan colores planos y livianos. Si la imagen no carga (p. ej. visor autónomo abierto como archivo) no pasa nada.
const detailCache={},white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
function detail(name){if(detailCache[name])return detailCache[name];const e=detailCache[name]={u:{tex:{value:white},avg:{value:new THREE.Vector3(1,1,1)},k:{value:0}}};
 new THREE.TextureLoader().load('./texturas/'+name+'.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.drawImage(t.image,0,0,8,8);const d=x.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4*255;e.u.avg.value.set(...[r,g,b].map(v=>Math.pow(v/n,2.2)));e.u.tex.value=t;e.u.k.value=.8;},undefined,()=>{});return e;}
const DETAIL={'#90aa81':['pasto',9],'#8f918b':['asfalto',7],'#c8c3b5':['concreto',6],'#cdc6b8':['concreto',6],'#c9c8bf':['concreto',6],'#c0b9a6':['concreto',6],'#d5cbb1':['concreto',6],'#3f8048':['pasto',3.5],'#6a9a46':['pasto',3.5],'#b47e63':['concreto',3],'#777f78':['asfalto2',6],'#a5a69b':['concreto',6],'#b87861':['ladrillo',2],'#d6d3c5':['concreto',5],'#d3cfc4':['concreto',3]};
function addDetail(m,name,scale){const e=detail(name);m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{dTex:e.u.tex,dAvg:e.u.avg,dK:e.u.k,dS:{value:scale}});
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp,vWn;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;vWn=normalize(mat3(modelMatrix)*objectNormal);');
 // Proyección triplanar: la misma textura sirve en suelos y en paredes, sin estirarse.
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWp,vWn;uniform sampler2D dTex;uniform vec3 dAvg;uniform float dK,dS;').replace('#include <map_fragment>','#include <map_fragment>\nvec3 tn=pow(abs(normalize(vWn)),vec3(4.0));tn/=tn.x+tn.y+tn.z;vec3 tc=texture2D(dTex,vWp.zy/dS).rgb*tn.x+texture2D(dTex,vWp.xz/dS).rgb*tn.y+texture2D(dTex,vWp.xy/dS).rgb*tn.z;diffuseColor.rgb*=mix(vec3(1.0),clamp(tc/dAvg,.35,1.9),dK);');};m.customProgramCacheKey=()=>'detalle';}
function material(color){if(!matCache.has(color)){const m=new THREE.MeshStandardMaterial({color,roughness:.88});if(DETAIL[color])addDetail(m,...DETAIL[color]);matCache.set(color,m);}return matCache.get(color);}
const cube=new THREE.BoxGeometry(1,1,1), cylinder=new THREE.CylinderGeometry(1,1,1,7), crown=new THREE.IcosahedronGeometry(1,1);
const translucentRoof=new THREE.MeshPhysicalMaterial({color:'#ede6c1',transparent:true,opacity:.32,roughness:.25,metalness:0,side:THREE.DoubleSide,depthWrite:false});
function box(parent,name,x,y,z,w,h,d,color){const o=new THREE.Mesh(cube,material(color));o.name=name;o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=h>1;o.receiveShadow=true;parent.add(o);return o;}
const S=()=>data.metersPerPixel;
const X=px=>(px-895)*S(),Z=py=>(py-390)*S();
function slab(parent,r,color,y=.18,height=.25,name='Superficie'){return box(parent,name,X((r[0]+r[2])/2),y,Z((r[1]+r[3])/2),(r[2]-r[0])*S(),height,(r[3]-r[1])*S(),color);}
function meshPoly(parent,points,y,color,name){const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(X(p[0]),-Z(p[1])):shape.moveTo(X(p[0]),-Z(p[1])));shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(color));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;mesh.name=name;parent.add(mesh);return mesh;}
function line(parent,points,color='#eeeee0',width=.22,y=.5){for(let i=1;i<points.length;i++){let a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];let o=box(parent,'Línea', (a[0]+b[0])/2,y,(a[1]+b[1])/2,width,.04,Math.hypot(dx,dz),color);o.rotation.y=Math.atan2(dx,dz);}}
function label(text,x,y,z,cls=''){const el=document.createElement('div');el.className='label '+cls;el.textContent=text;labelLayer.append(el);labels.push({el,p:new THREE.Vector3(x,y,z)});}
function textPanel(parent,name,text,width,height,x,y,z,vertical=false){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e4e6e0';ctx.font='bold 105px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,132,1000);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,transparent:true,side:THREE.DoubleSide,roughness:.8}));
 mesh.name=name;mesh.userData.disposeMaterial=true;mesh.position.set(x,y,z);if(vertical)mesh.rotation.z=Math.PI/2;parent.add(mesh);return mesh;
}
// Detalle interpretativo sobre la huella existente: las fotos no son un levantamiento.
const CU_FRAME={x:863,z:423,angle:-Math.atan2(.553,.833)};
let roadCorridors=[];
function nearRoad(x,z){return roadCorridors.some(([ax,az,bx,bz,r])=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-t*dx,z-az-t*dz)<r;});}
function cuajimalpaEntrance(){
 const g=new THREE.Group();g.name='Porteria_Cuajimalpa_aproximada';
 const candidate=data.architecture?.entrance?.localPosition,anchor=Array.isArray(candidate)&&candidate.length===2&&candidate.every(n=>Number.isFinite(n)&&Math.abs(n)<250)?candidate:[-23,-173],p=new THREE.Vector3(anchor[0],0,anchor[1]).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);
 g.position.set(X(CU_FRAME.x)+p.x,0,Z(CU_FRAME.z)+p.z);g.rotation.y=CU_FRAME.angle+Math.PI;world.add(g);
 g.userData.approximate=true;g.userData.placementPending=true;
 box(g,'Explanada_porteria',2,.18,0,32,.24,13,'#a5a69b');
 box(g,'Torre_porteria_terracota',-11,7,0,2.3,14,1.7,'#a47c66');
 box(g,'Ala_gris_porteria_izquierda',-13,5.7,-.2,1.7,11.4,1.6,'#93958f');
 box(g,'Ala_gris_porteria_derecha',-9.1,5.2,-.2,1.5,10.4,1.6,'#93958f');
 textPanel(g,'Rotulo_Unidad_Cuajimalpa','Unidad Cuajimalpa',9.4,1.3,-11,6.1,.87,true);
 textPanel(g,'Rotulo_UAM_porteria','UAM',2.05,.72,-11,12.1,.87);
 box(g,'Marquesina_porteria',-1,4.5,0,18,.55,7,'#92958f');
 function beam(name,a,b,width,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=box(g,name,0,0,0,width,delta.length(),width,color);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
 beam('Tirante_marquesina_superior',[-9,11,-1],[7,4.85,-1],.12,'#c8cac1');
 beam('Tirante_marquesina_inferior',[-9,8,-1],[0,4.85,-1],.12,'#c8cac1');
 box(g,'Cubierta_filtro_peatonal',7,3.25,4.6,19,.22,5,'#b9beb8');
 for(const x of [-2,5,13,16])box(g,'Columna_porteria',x,1.65,4.6,.18,3.3,.18,'#454d49');
 for(const [left,right]of [[-9,-2],[1.5,9],[11,17]]){
  for(let x=left;x<=right;x+=.45)box(g,'Barrote_porton',x,1.5,5.6,.16,3,.16,'#3b4440');
  for(const y of [.4,2.6])box(g,'Travesano_porton',(left+right)/2,y,5.6,right-left,.12,.14,'#3b4440');
 }
 for(const x of [-.7,.5,10]){box(g,'Torniquete_pedestal',x,.8,4.8,.18,1.6,.22,'#606761');box(g,'Torniquete_brazo',x,1.1,4.8,1,.08,.08,'#a7aca7');}
 box(g,'Caseta_porteria',14,1.5,-1.5,5,3,4,'#b78e77');
 box(g,'Ventana_caseta',14,1.8,.55,3,1.1,.08,'#637d7c');
 registerEditable('porteria_cuajimalpa','Portería · posición aproximada','landmark',g);
 if(g.parent)label('Acceso · aproximado',g.position.x,16,g.position.z,'place');
}
function cuajimalpaAccessPath(){
 // Orden contrastado con la referencia: Vasco de Quiroga → acceso → canchas → sede.
 // Andador esquemático junto a las canchas; no es una ruta accesible certificada.
 // Si se quita la portería desaparece el andador, pero los caminos vehiculares (y la calle frente a la sede) siguen.
 const entrance=editables.get('porteria_cuajimalpa');
 const route=new THREE.Group();route.name='Andador_acceso_lado_canchas';route.position.set(X(CU_FRAME.x),0,Z(CU_FRAME.z));route.rotation.y=CU_FRAME.angle;route.userData.approximate=true;world.add(route);
 const candidate=data.architecture?.accessPath,points=structuredClone(Array.isArray(candidate)&&candidate.length>=2&&candidate.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<250))?candidate:[[-23,-167],[-43,-155],[-43,-72],[-20,-55],[0,-44]]);
 if(entrance){const start=entrance.node.localToWorld(new THREE.Vector3(0,0,-6)).sub(route.position).applyAxisAngle(new THREE.Vector3(0,1,0),-CU_FRAME.angle);points[0]=[start.x,start.z];
 for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],dx=bx-ax,dz=bz-az;const m=box(route,'Andador_peatonal_aproximado',(ax+bx)/2,.25,(az+bz)/2,3,.24,Math.hypot(dx,dz),'#c0b9a6');m.rotation.y=Math.atan2(dx,dz);}}
 // Caminos vehiculares trazados sobre imagen satelital (aproximados): architecture.roads = [{id,name,width,points:[[x,z],…]}] en el marco local.
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<250);
 for(const road of Array.isArray(data.architecture?.roads)?data.architecture.roads:[]){const pts=road?.points;if(!Array.isArray(pts)||pts.length<2||!pts.every(validPoint))continue;const width=Number.isFinite(road.width)&&road.width>=2&&road.width<=20?road.width:6;
  for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.1)continue;const m=box(route,'Camino_vehicular_aproximado',(ax+bx)/2,.21,(az+bz)/2,width,.2,len+width*.5,'#8f918b');m.rotation.y=Math.atan2(dx,dz);m.castShadow=false;const wa=new THREE.Vector3(ax,0,az).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle).add(route.position),wb=new THREE.Vector3(bx,0,bz).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle).add(route.position);roadCorridors.push([wa.x,wa.z,wb.x,wb.z,width/2+3]);}}
 const north=new THREE.Vector3(-23,0,-222).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);label('Vasco de Quiroga',X(CU_FRAME.x)+north.x,2,Z(CU_FRAME.z)+north.z,'place');
}
function cuajimalpaAgora() {
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


function cuajimalpaFacades(parent,height){
 const g=new THREE.Group();g.name='Fachadas_integradas_Cuajimalpa';
 g.position.set(X(CU_FRAME.x),.25,Z(CU_FRAME.z));g.rotation.y=CU_FRAME.angle;parent.add(g);
 g.userData={reference:'Fotografías aportadas por Gabriel, 2026-10-18',approximate:true,orientationPending:true};
 const terra='#b47e63',seam='#926651',glass='#668b91',dark='#303c3c',concrete='#bfc3b9';
 // Despiece sobrio de los paneles terracota; una sola masa, sin torres independientes.
 for(const side of [-1,1]){
  for(let y=0;y<height;y+=3.3)for(let x=-35;x<31;x+=5.5)
   box(g,'Junta_panel_terracota',x,y,side<0?-39.85:41.45,.045,3.2,.035,seam);
  for(let y=3.3;y<height;y+=3.3)box(g,'Junta_horizontal',-2,y,side<0?-39.85:41.45,70,.045,.035,seam);
 }
 // Fachada acristalada opuesta: bandas de corredores retranqueados y atrio central.
 for(let f=0;f<data.buildings.find(b=>b.id==='TORRE_III').floors;f++){
  const y=f*data.storeyHeight;
  box(g,'Corredor_acristalado_nivel_'+f,-2,y+1.7,-40,47,2.15,.2,dark);
  box(g,'Vidrio_corredores_nivel_'+f,-2,y+1.8,-40.15,43,1.55,.12,glass);
  box(g,'Borde_losa_nivel_'+f,-2,y+.45,-40.45,47,.42,.9,concrete);
  for(let x=-24;x<23;x+=3.8)box(g,'Barandal_montante',x,y+1,-40.6,.055,1.1,.06,'#c3cdca');
  box(g,'Barandal_horizontal',-2,y+1.45,-40.6,47,.065,.06,'#c3cdca');
 }
 box(g,'Atrio_central_vidrio',-2,height/2,-40.8,15,height-.6,.16,'#6b939b');
 for(let x=-9.5;x<6;x+=2.5)box(g,'Montante_atrio',x,height/2,-40.94,.09,height,.1,'#bccbc8');
 for(let y=0;y<height;y+=1.65)box(g,'Travesano_atrio',-2,y,-40.94,15,.09,.1,'#bac7c3');
 for(let f=0;f<data.buildings.find(b=>b.id==='TORRE_III').floors;f++){
  const y=f*data.storeyHeight+1.85;
  // La toma aérea muestra huecos separados, no franjas continuas en estos lados.
  for(let z=-23;z<29;z+=5.3){box(g,'Ventana_modular_lateral_nivel_'+f,-38.9,y,z,.12,1.3,2.7,glass);box(g,'Parteluz_lateral',-39,y,z,.13,1.3,.07,'#d0c4b2');}
  for(let x=-13;x<15;x+=4.5){box(g,'Ventana_modular_patio_nivel_'+f,x,y,33.75,2.5,1.3,.12,glass);box(g,'Parteluz_patio',x,y,33.84,.08,1.3,.13,'#d0c4b2');}
  for(const x of [-30,-24,21,27])box(g,'Ventana_modular_extremo_nivel_'+f,x,y,41.55,2.8,1.3,.12,glass);
 }
 // Celosía en la cara lateral del acceso: paño oscuro continuo con pliegues claros.
 const screenBottom=Math.min(2.8,height*.15),screenHeight=Math.max(.8,height-screenBottom-1.6);
 box(g,'Celosia_fondo_oscuro',35.18,screenBottom+screenHeight/2,0,.18,screenHeight,45,dark);
 const vertices=[];
 function ribbon(a,b,width){const dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dy,dz),oy=-dz/len*width/2,oz=dy/len*width/2;
  const p=[[a[0],a[1]+oy,a[2]+oz],[a[0],a[1]-oy,a[2]-oz],[b[0],b[1]-oy,b[2]-oz],[b[0],b[1]+oy,b[2]+oz]];
  for(const i of [0,1,2,0,2,3])vertices.push(...p[i]);
 }
 for(let z=-21.8;z<22;z+=1.15)for(let y=screenBottom+.6;y<screenBottom+screenHeight-.7;y+=1.55){
  ribbon([35.35,y-.55,z-.34],[35.35,y,z+.32],.22);
  ribbon([35.35,y,z+.32],[35.35,y+.55,z-.2],.22);
 }
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();
 const screenMat=new THREE.MeshStandardMaterial({color:'#d9d8cc',roughness:.7,side:THREE.DoubleSide});
 const screen=new THREE.Mesh(geom,screenMat);screen.name='Celosia_pliegues_claros';screen.userData.disposeMaterial=true;g.add(screen);
 // Torres de circulación y zócalo sostienen visualmente el gran paño.
 for(const z of [-31,31]){
  box(g,'Macizo_terracota_acceso',38,height/2,z,8,height,11,terra);
  for(let y=2;y<height;y+=3.3)for(let t=0;t<3;t++){
   const hole=new THREE.Mesh(new THREE.CircleGeometry(.14,8),material('#3e3d36'));hole.rotation.y=Math.PI/2;hole.position.set(42.05,y,z-1+t*.7);hole.name='Perforacion_circulacion';g.add(hole);
  }
 }
 box(g,'Portico_acceso',37,2,-27,10,4,7,'#454945');
 // Cubierta roja con dos estructuras longitudinales elevadas, según la vista aérea.
 for(const z of [-36,35])box(g,'Pretil_azotea',0,height+1,z,70,.9,.3,terra);
 for(const x of [-16,15]){
  box(g,'Lucernario_zocalo',x,height+.55,0,8,.55,46,'#5d6260');
  box(g,'Lucernario_vidrio',x,height+.92,0,6.7,.18,44,'#89a5a3');
  for(let z=-21;z<=21;z+=3.5)box(g,'Lucernario_travesano',x,height+1.04,z,6.9,.07,.08,'#d3d8cf');
  for(let z=-21;z<=21;z+=7){box(g,'Soporte_cubierta_elevada',x-3.3,height+1.6,z,.14,2,.14,'#c0b995');box(g,'Soporte_cubierta_elevada',x+3.3,height+1.6,z,.14,2,.14,'#c0b995');}
  box(g,'Cubierta_elevada_verde',x,height+2.65,0,8.3,.16,46,'#8c9675');
  for(let z=-21;z<=21;z+=3.5)box(g,'Costilla_cubierta_elevada',x,height+2.76,z,8.4,.05,.07,'#bcb699');
 }
 // Plaza y rampas son esquemáticas; no alteran la georreferencia ni la huella.
 box(g,'Plaza_acceso',51,.08,0,18,.16,61,'#b8ada0');
 const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;
 const signCtx=signCanvas.getContext('2d');signCtx.font='bold 83px sans-serif';signCtx.fillStyle='#fffdf3';signCtx.textAlign='center';signCtx.fillText('SOY UAM',256,96);
 const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(13,3.25),new THREE.MeshStandardMaterial({map:signTexture,transparent:true,side:THREE.DoubleSide,roughness:.8}));
 sign.name='Rotulo_SOY_UAM_interpretativo';sign.userData.disposeMaterial=true;sign.position.set(46,1.9,4);sign.rotation.y=Math.PI/2;g.add(sign);
 box(g,'Base_rotulo_SOY_UAM',46,.42,4,.9,.55,13.5,'#c37943');
 for(let z=-20;z<22;z+=4){box(g,'Pavimento_naranja',51,.18,z,14,.04,.18,'#c17743');box(g,'Pavimento_naranja',47,.18,z, .18,.04,3.8,'#c17743');}
 const ramp=box(g,'Rampa_acceso_aproximada',62,.95,12,5,.25,30,'#989b93');ramp.rotation.x=.045;
 for(const x of [59.4,64.6])box(g,'Pretil_rampa',x,.6,12,.25,1.2,30,'#c9cbc1');
 for(const z of [-15,0,15]){const planter=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.35,.6,16),material('#a8a18f'));planter.name='Jardinera_circular_acceso';planter.position.set(53,.5,z);g.add(planter);const soil=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.08,16),material('#677c4e'));soil.position.set(53,.84,z);g.add(soil);}
 // Cubiertas y alturas editables siguen perteneciendo al mismo edificio.
 g.userData.details=['terracota','celosia','atrio_acristalado','corredores','lucernarios'];
}
// Canchas, camino de en medio y calle frente a la sede: trazo sobre Esri World Imagery y fotos aéreas; aproximado.
// architecture.sportsFields/walkways/planters en el marco local CU_FRAME (m); la calle es una entrada más de architecture.roads.
const courtLineMat=new THREE.MeshStandardMaterial({color:'#f2f2ea',roughness:.7,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const courtNetMat=new THREE.MeshStandardMaterial({color:'#eeeeea',transparent:true,opacity:.35,roughness:.9,side:THREE.DoubleSide,depthWrite:false});
function courtPiece(parent,name,mat,x,y,z,w,h,d){const o=new THREE.Mesh(cube,mat);o.name=name;o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o;}
// Líneas pintadas: una sola malla de cintas planas por elemento (pocas mallas en el GLB y nítidas en el plano 2D).
function courtLines(parent,name,paths,y,w,mat=courtLineMat){const v=[];for(const pts of paths)for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],len=Math.hypot(bx-ax,bz-az);if(len<.001)continue;const ux=(bx-ax)/len*w/2,uz=(bz-az)/len*w/2,p=[[ax-ux-uz,az-uz+ux],[bx+ux-uz,bz+uz+ux],[bx+ux+uz,bz+uz-ux],[ax-ux+uz,az-uz-ux]];for(const k of [0,1,2,0,2,3])v.push(p[k][0],y,p[k][1]);}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.computeVertexNormals();const m=new THREE.Mesh(geom,mat);m.name=name;m.receiveShadow=true;parent.add(m);return m;}
// Reserva sin árboles aleatorios: franjas de cápsulas (radio ≤ 2 m) que cubren el rectángulo con 2 m de holgura; reutiliza nearRoad().
function keepTreesOff(cx,cz,rot,w,l){const W=w+4,L=l+4,n=Math.ceil(W/4),r=W/(2*n),h=Math.max(0,L/2-r),c=Math.cos(rot),s=Math.sin(rot);for(let i=0;i<n;i++){const x=-W/2+r*(2*i+1);roadCorridors.push([cx+x*c-h*s,cz-x*s-h*c,cx+x*c+h*s,cz-x*s+h*c,r+.05]);}}
function courtGoal(g,s,z,w,h,depth,base){for(const x of [-w/2,w/2])box(g,'Poste_porteria',x,base+h/2,z,.12,h,.12,'#f4f4ee');box(g,'Travesano_porteria',0,base+h-.06,z,w+.12,.12,.12,'#f4f4ee');
 courtPiece(g,'Red_porteria',courtNetMat,0,base+h/2,z+s*depth,w,h,.02);courtPiece(g,'Red_porteria',courtNetMat,0,base+h,z+s*depth/2,w,.02,depth);for(const x of [-w/2,w/2])courtPiece(g,'Red_porteria',courtNetMat,x,base+h/2,z+s*depth/2,.02,h,depth);}
function courtHoop(g,s,hl,base){const z=s*hl;box(g,'Poste_canasta',0,base+1.7,z+s,.2,3.4,.2,'#f1f1ea');box(g,'Brazo_canasta',0,base+3.35,z-s*.1,.12,.12,2.2,'#f1f1ea');box(g,'Tablero_canasta',0,base+3.42,z-s*1.2,1.8,1.05,.05,'#f4f4ee');
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.225,.02,6,18),material('#d9572b'));rim.name='Aro_canasta';rim.rotation.x=Math.PI/2;rim.position.set(0,base+3.05,z-s*1.575);g.add(rim);}
// Carpa del andador junto al camino de los coches: una fila de columnas blancas al centro y membrana en «ala»,
// con los bordes más altos que el centro y arcos entre columnas (foto desde el camino poniente).
const canopyMat=new THREE.MeshStandardMaterial({color:'#f6f4ee',emissive:'#55534e',roughness:.6,side:THREE.DoubleSide});
function canopy(parent,name,ax,az,bx,bz,w,h,bay){const dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz),n=Math.max(1,Math.round(L/bay)),step=L/n,g=new THREE.Group();g.name=name;g.position.set((ax+bx)/2,0,(az+bz)/2);g.rotation.y=Math.atan2(dx,dz);parent.add(g);
 const nz=n*8,nx=8,v=[],idx=[];for(let i=0;i<=nz;i++)for(let j=0;j<=nx;j++){const s=-L/2+L*i/nz,u=-1+2*j/nx;v.push(u*w/2,h+(.95-.6*Math.sin(Math.PI*(s+L/2)/step)**2)*u*u,s);}
 for(let i=0;i<nz;i++)for(let j=0;j<nx;j++){const a=i*(nx+1)+j,b=a+nx+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.setIndex(idx);geom.computeVertexNormals();const m=new THREE.Mesh(geom,canopyMat);m.name='Membrana_carpa';m.castShadow=true;m.receiveShadow=true;g.add(m);
 for(let i=0;i<=n;i++){const z=-L/2+step*i;box(g,'Columna_carpa',0,h/2,z,.26,h,.26,'#f1f1ec');box(g,'Brazo_carpa',0,h+.25,z,w*.7,.16,.16,'#f1f1ec');}return g;}
// Punto de reunión pintado en el piso: cuadro verde con cuatro flechas blancas hacia el centro.
function assemblyMark(g,x,z,y){box(g,'Punto_de_reunion',x,y-.035,z,3,.03,3,'#2f8a55');const marks=[arc2(x,z,.12)];for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const t=[x+.42*sx,z+.42*sz];marks.push([[x+1.2*sx,z+1.2*sz],t],[[t[0]+.42*sx,t[1]],t,[t[0],t[1]+.42*sz]]);}courtLines(g,'Flechas_punto_de_reunion',marks,y,.2);}
function arc2(cx,cz,r){return Array.from({length:11},(_,i)=>[cx+r*Math.cos(i*Math.PI/5),cz+r*Math.sin(i*Math.PI/5)]);}
// Techumbre ligera: losa de cubierta sobre columnas, con muro opcional en un lado (frontón o banca techada).
function shelter(parent,name,x,z,w,l,h,wall,bench){const g=new THREE.Group();g.name=name;g.position.set(x,0,z);parent.add(g);box(g,'Cubierta_techumbre',0,h,0,w+.4,.22,l+.4,'#e9e8e2');
 const nx=Math.max(1,Math.ceil(w/6)),nz=Math.max(1,Math.ceil(l/6));for(let i=0;i<=nx;i++)for(let k=0;k<=nz;k++)if(i===0||i===nx||k===0||k===nz)box(g,'Columna_techumbre',-w/2+w*i/nx,h/2,-l/2+l*k/nz,.18,h,.18,'#8f9692');
 const walls={n:[0,-l/2,w,.25],s:[0,l/2,w,.25],e:[w/2,0,.25,l],o:[-w/2,0,.25,l]};if(walls[wall]){const [wx,wz,ww,wd]=walls[wall];box(g,'Muro_techumbre',wx,h/2,wz,ww,h,wd,'#8a8d8a');}
 if(bench)box(g,'Banca_techada',0,.45,0,Math.min(w,.5),.45,l-.6,'#b9b4a8');return g;}
// Gradas de tres escalones; la fila alta queda del lado contrario a la cancha.
function grada(g,x,z,len,rot){const s=new THREE.Group();s.name='Gradas';s.position.set(x,0,z);s.rotation.y=rot;g.add(s);for(let k=0;k<3;k++){const y=.45+k*.4;box(s,'Asiento_grada',0,y,(k-1)*.7,len,.06,.6,'#e9e9e3');box(s,'Base_grada',0,y/2,(k-1)*.7-.25,len,y-.03,.08,'#a7aca7');}}
// Montecito: terreno elevado por estaciones [z, pie del muro x, altura, orilla x]; cara de muro de concreto,
// meseta con andador y ladera hacia la orilla del predio. El croquis sigue siendo plano fuera de este volumen.
function hillSection(st,slope,plateau,rise){const [z,foot,h,edge]=st,top=foot+Math.max(.6,h*slope),plat=Math.min(edge-.5,top+plateau);return {z,h,top,plat,pts:[[foot,0],[top,h],[plat,h],[edge,h*(1+rise)],[edge,0]]};}
function hill(parent,name,stations,slope,plateau,rise){const secs=stations.map(s=>hillSection(s,slope,plateau,rise)),wall=[],earth=[];
 const quad=(arr,a,b,c,d)=>arr.push(...a,...b,...c,...a,...c,...d),P=(s,k)=>[s.pts[k][0],s.pts[k][1],s.z];
 for(let i=1;i<secs.length;i++)for(let k=0;k<4;k++)quad(k?earth:wall,P(secs[i-1],k),P(secs[i],k),P(secs[i],k+1),P(secs[i-1],k+1));
 for(const s of [secs[0],secs[secs.length-1]])for(let k=1;k<4;k++)earth.push(...P(s,0),...P(s,k),...P(s,k+1));
 const g=new THREE.Group();g.name=name;parent.add(g);
 for(const [arr,color,part] of [[wall,'#8e8f89','Muro_contencion'],[earth,'#93a873','Ladera_montecito']]){const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));geom.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide});if(part==='Ladera_montecito')addDetail(mat,'pasto',9);else addDetail(mat,'muro',5);const m=new THREE.Mesh(geom,mat);m.name=part;m.userData.disposeMaterial=true;m.castShadow=true;m.receiveShadow=true;g.add(m);}
 // at(z): sección interpolada; y(x) da la altura del terreno en esa sección (0 fuera del montecito).
 return {g,at:z=>{const j=secs.findIndex(s=>s.z>=z),b=secs[j<1?(j<0?secs.length-1:1):j],a=secs[secs.indexOf(b)-1],t=Math.max(0,Math.min(1,(z-a.z)/((b.z-a.z)||1))),pts=a.pts.map((p,k)=>[p[0]+(b.pts[k][0]-p[0])*t,p[1]+(b.pts[k][1]-p[1])*t]);
  return {h:pts[1][1],top:pts[1][0],plat:pts[2][0],y:x=>{for(let k=0;k<3;k++){const [x0,y0]=pts[k],[x1,y1]=pts[k+1];if(x>=x0&&x<=x1)return y0+(y1-y0)*(x-x0)/((x1-x0)||1);}return 0;}};}};}
function courtLight(g,x,z,h,base,head){box(g,'Poste_luminaria',x,base+h/2,z,head>1?.26:.14,h,head>1?.26:.14,'#6f7671');box(g,'Lampara_luminaria',x,base+h+.2,z,head,.35,head>1?.7:.35,'#ecebdf');}
function cuajimalpaCourts(){
 const arch=data.architecture||{},UP=new THREE.Vector3(0,1,0),list=v=>Array.isArray(v)?v:[],num=(n,min,max,fallback)=>Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<250),validId=id=>typeof id==='string'&&/^[a-z0-9_]{3,40}$/.test(id);
 const arc=(cx,cz,r,a0,a1,n=24)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return [cx+r*Math.cos(a),cz+r*Math.sin(a)];});
 const rrect=(hw,hl,r)=>(r=Math.min(r,hw,hl))>0?[...arc(hw-r,hl-r,r,0,Math.PI/2,6),...arc(-hw+r,hl-r,r,Math.PI/2,Math.PI,6),...arc(-hw+r,-hl+r,r,Math.PI,1.5*Math.PI,6),...arc(hw-r,-hl+r,r,1.5*Math.PI,2*Math.PI,6),[hw,hl-r]]:[[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl],[-hw,-hl]];
 const sector=new THREE.Group();sector.name='Canchas_y_caminos_aproximados';sector.position.set(X(CU_FRAME.x),0,Z(CU_FRAME.z));sector.rotation.y=CU_FRAME.angle;sector.userData.approximate=true;world.add(sector);
 const toWorld=(x,z)=>new THREE.Vector3(x,0,z).applyAxisAngle(UP,CU_FRAME.angle).add(sector.position),toPx=(x,z)=>{const p=toWorld(x,z);return [+(p.x/S()+895).toFixed(2),+(p.z/S()+390).toFixed(2)];};
 const lamp=(x,z)=>courtLight(sector,x,z,7,.35,.8),center=pts=>toWorld(pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length);
 // Andadores y explanadas: polilíneas con ancho (como los caminos), un poco más altas que el asfalto.
 for(const w of list(arch.walkways)){const pts=w?.points;if(!validId(w?.id)||!Array.isArray(pts)||pts.length<2||!pts.every(validPoint))continue;const width=num(w.width,1,30,4),color=/^#[0-9a-f]{6}$/i.test(w.color)?w.color:'#c8c3b5';
  for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.1)continue;const e0=i>1?width/2:0,e1=i<pts.length-1?width/2:0;const m=box(sector,'Andador_'+w.id,(ax+bx)/2+dx/len*(e1-e0)/2,.25,(az+bz)/2+dz/len*(e1-e0)/2,width,.2,len+e0+e1,color);m.rotation.y=Math.atan2(dx,dz);const wa=toWorld(ax,az),wb=toWorld(bx,bz);roadCorridors.push([wa.x,wa.z,wb.x,wb.z,width/2+2]);}
  for(const t of list(w.trees))if(validPoint(t))tree(...toPx(...t),.55);for(const l of list(w.lamps))if(validPoint(l))lamp(...l);for(const a of list(w.assemblyPoints))if(validPoint(a))assemblyMark(sector,a[0],a[1],.38);
  if(typeof w.label==='string'){const c=center(pts);label(w.label.slice(0,40),c.x,3,c.z,'place');}}
 // Techumbres: frontón al sur de la cancha de fútbol y banca techada del camino de en medio.
 for(const t of list(arch.shelters)){if(!validId(t?.id)||!validPoint(t.center))continue;const w=num(t.width,1,40,0),l=num(t.length,1,60,0),h=num(t.height,2,8,3);if(!w||!l)continue;shelter(sector,'Techumbre_'+t.id.replace(/^techumbre_/,''),t.center[0],t.center[1],w,l,h,t.wall,t.bench===true);const a=toWorld(t.center[0],t.center[1]-l/2),b=toWorld(t.center[0],t.center[1]+l/2);roadCorridors.push([a.x,a.z,b.x,b.z,w/2+1]);}
 // Carpas de los andadores: membrana blanca sobre postes; debajo no caen árboles aleatorios.
 for(const k of list(arch.canopies)){const pts=k?.points;if(!validId(k?.id)||!Array.isArray(pts)||pts.length<2||!pts.every(validPoint))continue;const w=num(k.width,2,20,4.6),h=num(k.height,2.5,8,3.6),bay=num(k.bay,2,15,5.5);
  for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i];if(Math.hypot(bx-ax,bz-az)<1)continue;canopy(sector,'Carpa_'+k.id.replace(/^carpa_/,''),ax,az,bx,bz,w,h,bay);const wa=toWorld(ax,az),wb=toWorld(bx,bz);roadCorridors.push([wa.x,wa.z,wb.x,wb.z,w/2]);}}
 // Montecito al oriente: muro de contención, andador elevado con lámparas tipo hongo y escaleras desde la cancha de básquetbol.
 for(const t of list(arch.terrain)){const st=list(t?.stations).filter(s=>Array.isArray(s)&&s.length===4&&s.every(n=>Number.isFinite(n)&&Math.abs(n)<250)&&s[1]<s[3]&&s[2]>=0&&s[2]<=20).sort((a,b)=>a[0]-b[0]);if(!validId(t?.id)||st.length<2)continue;
  const hl=hill(sector,'Montecito_'+t.id.replace(/^montecito_/,''),st,num(t.wallSlope,.2,3,.9),num(t.plateau,1,30,10),num(t.rise,0,2,.4)),z0=st[0][0],z1=st[st.length-1][0];
  for(let x=Math.min(...st.map(s=>s[1]));x<Math.max(...st.map(s=>s[3]));x+=8){const a=toWorld(x+4,z0),b=toWorld(x+4,z1);roadCorridors.push([a.x,a.z,b.x,b.z,6]);}
  const path=t.path,pw=num(path?.width,1,8,3),off=num(path?.offset,0,30,6);
  if(path){let prev=null,i=0;for(let z=z0;z<=z1+.01;z+=4,i++){const s=hl.at(z),p=new THREE.Vector3(Math.min(s.top+off,s.plat-pw/2),s.h+.08,z);if(prev){const d=p.clone().sub(prev),m=box(sector,'Andador_montecito',0,0,0,pw,.12,d.length()+.3,'#cfc4ab');m.position.copy(prev).add(p).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize());}
   if(i%3===1&&s.h>.5){box(sector,'Lampara_hongo',p.x+pw/2+.4,p.y+.45,p.z,.25,.9,.25,'#f3f2ec');box(sector,'Lampara_hongo_sombrero',p.x+pw/2+.4,p.y+.95,p.z,.6,.14,.6,'#f3f2ec');}prev=p;}
   if(typeof path.label==='string'){const c=toWorld(off+st[0][1],(z0+z1)/2);label(path.label.slice(0,40),c.x,8,c.z,'place');}}
  // Escaleras [x0,z0,x1,z1,ancho]: de (x0,z0) a nivel de cancha hasta (x1,z1) sobre el montecito.
  for(const s of list(t.stairs))if(Array.isArray(s)&&s.length===5&&s.every(n=>Number.isFinite(n)&&Math.abs(n)<250)){const [xa,za,xb,zb,w]=s,h=hl.at(zb).y(xb),len=Math.hypot(xb-xa,zb-za),n=Math.max(2,Math.ceil(h/.18)),rot=Math.atan2(xb-xa,zb-za);if(h<.3||len<1)continue;
   // Cada escalón queda por encima del muro en su borde alto, para que no se entierre donde el muro es más empinado.
   for(let k=0;k<n;k++){const f=(k+.5)/n,e=(k+1)/n,top=Math.max((k+1)*h/n,hl.at(za+(zb-za)*e).y(xa+(xb-xa)*e)+.05)+(k===n-1?.04:0),m=box(sector,'Escalon_montecito',xa+(xb-xa)*f,top/2,za+(zb-za)*f,Math.min(6,Math.max(1,w)),top,len/n+.02,'#c8c4b8');m.rotation.y=rot;}}
  for(const p of list(t.trees))if(validPoint(p))tree(...toPx(...p),.7,false,hl.at(p[1]).y(p[0]));}
 // Jardineras: polígono con guarnición, arbustos, rótulo, árboles y luminarias opcionales.
 for(const p of list(arch.planters)){const pts=p?.points;if(!validId(p?.id)||!Array.isArray(pts)||pts.length<3||pts.length>64||!pts.every(validPoint))continue;
  const m=new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z))),{depth:.3,bevelEnabled:false}),material('#7f9b58'));m.name='Jardinera_'+p.id.replace(/^jardinera_/,'');m.rotation.x=-Math.PI/2;m.position.y=.31;m.castShadow=true;m.receiveShadow=true;sector.add(m);
  courtLines(sector,'Guarnicion_jardinera',[[...pts,pts[0]]],.64,.3,material('#d3cfc4'));
  for(const s of list(p.shrubs))if(Array.isArray(s)&&s.length===4&&validPoint(s.slice(0,2))&&s.slice(2).every(n=>Number.isFinite(n)&&n>=.3&&n<=12)){const b=new THREE.Mesh(crown,material('#3e6b3a'));b.name='Arbusto_jardinera';b.scale.set(s[2],.9,s[3]);b.position.set(s[0],1.05,s[1]);b.castShadow=true;sector.add(b);}
  if(Array.isArray(p.sign)&&p.sign.length===3&&validPoint(p.sign.slice(0,2))&&p.sign[2]>=1&&p.sign[2]<=10)box(sector,'Rotulo_jardinera',p.sign[0],1.4,p.sign[1],p.sign[2],1.6,.35,'#8d867c');
  for(const t of list(p.trees))if(validPoint(t))tree(...toPx(...t),.6,false,.61);for(const l of list(p.lamps))if(validPoint(l))lamp(...l);
  if(typeof p.label==='string'){const c=center(pts);label(p.label.slice(0,40),c.x,3,c.z,'place');}}
 // Canchas: un grupo editable por cancha (mover, girar, quitar); marcas reglamentarias ajustadas al tamaño medido.
 const seen=new Set();
 for(const f of list(arch.sportsFields)){
  if(!validId(f?.id)||seen.has(f.id)||!['futbol','futbol_rapido','basquetbol'].includes(f.kind)||!validPoint(f.center)||![f.width,f.length].every(n=>Number.isFinite(n)&&n>=8&&n<=150))continue;seen.add(f.id);
  const W=f.width,L=f.length,basket=f.kind==='basquetbol',big=f.kind==='futbol',name=typeof f.name==='string'&&f.name.trim()?f.name.trim().slice(0,60):f.id;
  const g=new THREE.Group();g.name='Cancha_'+f.id.replace(/^cancha_/,'');const c=toWorld(...f.center);g.position.set(c.x,0,c.z);g.rotation.y=CU_FRAME.angle+THREE.MathUtils.degToRad(num(f.angle,-180,180,0));g.userData={approximate:true,kind:f.kind};world.add(g);
  registerEditable(f.id,name+' · aproximada','court',g);if(!g.parent)continue;
  keepTreesOff(g.position.x,g.position.z,g.rotation.y,W,L);label(name,g.position.x,4,g.position.z,'place');
  const paths=[],r=num(f.cornerRadius,0,Math.min(W,L)/4,0),mg=num(f.margin,0,5,basket?0:big?1.2:.5);
  if(basket){
   box(g,'Losa_concreto_cancha',0,.25,0,W,.2,L,'#c9c8bf');
   const hw=Math.min(15,W-1.6)/2,hl=Math.min(28,L-2)/2,phi=Math.acos(Math.min(1,(hw-.9)/6.75));
   paths.push(rrect(hw,hl,0),[[-hw,0],[hw,0]],arc(0,0,1.8,0,2*Math.PI,32));
   for(const s of [-1,1]){const e=s*hl,b=e-s*1.575,k=e-s*5.8;paths.push([[-2.45,e],[-2.45,k],[2.45,k],[2.45,e]],arc(0,k,1.8,0,2*Math.PI,24),[[-(hw-.9),e],...arc(0,b,6.75,s<0?Math.PI-phi:Math.PI+phi,s<0?phi:2*Math.PI-phi,28),[hw-.9,e]]);courtHoop(g,s,hl,.35);}
   if(f.assemblyPoint===true)assemblyMark(g,0,0,.4);
   if(f.volleyball===true)for(const x of [-5.6,5.6])box(g,'Poste_voleibol',x,1.6,0,.14,2.5,.14,'#c0392b');
   courtLines(g,'Lineas_cancha',paths,.4,.18);
  }else{
   const turf=new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(rrect(W/2,L/2,r).slice(0,-1).map(([x,z])=>new THREE.Vector2(x,-z))),{depth:.2,bevelEnabled:false}),material(big?'#3f8048':'#6a9a46'));turf.name='Pasto_sintetico';turf.rotation.x=-Math.PI/2;turf.position.y=.22;turf.receiveShadow=true;g.add(turf);
   const hw=W/2-mg,hl=L/2-mg,n=2*Math.round((2*hl/5-1)/2)+1,band=2*hl/n;
   for(let i=1;i<n;i+=2)box(g,'Franja_pasto',0,.435,-hl+band*(i+.5),2*hw,.03,band,big?'#4a9152':'#74a64f');
   paths.push(rrect(hw,hl,Math.max(0,r-mg)),[[-hw,0],[hw,0]],[[-.15,0],[.15,0]]);
   if(big){paths.push(arc(0,0,Math.min(6,hw*.4),0,2*Math.PI,48));
    for(const s of [-1,1]){const e=s*hl,pa=Math.min(19.5,hw*1.3),pd=Math.min(8,hl*.33),ga=Math.min(10.5,hw*.7),spot=e-s*6,k=Math.asin(Math.max(-1,Math.min(1,(pd-6)/5.5)));
     paths.push([[-pa/2,e],[-pa/2,e-s*pd],[pa/2,e-s*pd],[pa/2,e]],[[-ga/2,e],[-ga/2,e-s*3],[ga/2,e-s*3],[ga/2,e]],[[-.15,spot],[.15,spot]],arc(0,spot,5.5,s<0?k:Math.PI+k,s<0?Math.PI-k:2*Math.PI-k,14));}
    for(const sx of [-1,1])for(const sz of [-1,1]){const a=Math.atan2(-sz,-sx);paths.push(arc(sx*hw,sz*hl,1,a-Math.PI/4,a+Math.PI/4,6));}
   }else{paths.push(arc(0,0,Math.min(5.2,hw*.45),0,2*Math.PI,48),arc(-hw,0,3.5,-Math.PI/2,Math.PI/2,16));
    for(const s of [-1,1]){const e=s*hl,aw=Math.min(10.4,hw*.9),q=e-s*Math.min(5.6,hl*.25);paths.push([[-aw/2,e],...arc(0,q,aw/2,Math.PI,s<0?0:2*Math.PI,20),[aw/2,e]],[[-.15,e-s*6],[.15,e-s*6]]);}}
   courtLines(g,'Lineas_cancha',paths,.47,.25);
   const goal=Array.isArray(f.goal)&&f.goal.length===2&&f.goal.every(n=>Number.isFinite(n)&&n>=1&&n<=8)?f.goal:big?[6,2]:[5,2.1],boards=num(f.boards,0,3.5,0),net=num(f.netHeight,0,12,0);for(const s of [-1,1])courtGoal(g,s,s*hl,goal[0],goal[1],big?1.2:boards?.45:1,.42);
   // Muro blanco de tableros alrededor del pasto (fútbol rápido) y red sobre postes altos, siguiendo las esquinas redondeadas.
   if(boards){const ring=rrect(W/2+.08,L/2+.08,r?r+.08:0);let run=0;for(let i=1;i<ring.length;i++){const [ax,az]=ring[i-1],[bx,bz]=ring[i],len=Math.hypot(bx-ax,bz-az);if(len<.01)continue;const rot=Math.atan2(bx-ax,bz-az),m=box(g,'Muro_tableros',(ax+bx)/2,.42+boards/2,(az+bz)/2,.12,boards,len+.1,'#efeee8');m.rotation.y=rot;
     if(net>boards){const p=courtPiece(g,'Red_perimetral',courtNetMat,(ax+bx)/2,.42+(boards+net)/2,(az+bz)/2,.03,net-boards,len+.05);p.rotation.y=rot;if((run+=len)>=6||i===1){run=0;box(g,'Poste_red',ax,.42+net/2,az,.12,net,.12,'#8f9692');}}}}
   // Red alta detrás de la portería (fútbol grande: lado de la cancha de básquetbol).
   if(!boards&&net)for(const s of list(f.endNets))if(s===1||s===-1){const z=s*(L/2+.4),k=Math.ceil(W/6);courtPiece(g,'Red_fondo',courtNetMat,0,.42+net/2,z,W,net,.03);for(let i=0;i<=k;i++)box(g,'Poste_red',-W/2+W*i/k,.42+net/2,z,.12,net,.12,'#8f9692');}
  }
  for(const b of list(f.bleachers))if(Array.isArray(b)&&b.length===3&&validPoint(b.slice(0,2))&&b[2]>=1&&b[2]<=30)grada(g,b[0],b[1],b[2],Math.abs(b[0])/W>Math.abs(b[1])/L?Math.sign(b[0])*Math.PI/2:b[1]>0?0:Math.PI);
  for(const p of list(f.lights))if(validPoint(p))courtLight(g,p[0],p[1],basket?9:10,basket?.35:.1,basket?.9:2);
 }
}

// Marca que pertenece a la maqueta y viaja en GLB; bandera persistente en JSON.
function copyrightStyle(){return data.copyrightStyle||ORIGINAL.copyrightStyle;}
function copyrightEnabled(){return data.showCopyright!==false;}
function syncCopyright(){const enabled=copyrightEnabled();const node=world?.getObjectByName('Marca_copyright_modelo');if(node)node.visible=enabled;$('copyrightToggle').checked=enabled;$('watermark').hidden=!enabled;$('watermark').style.color=copyrightStyle().color;}
function addCopyrightToModel(){
 const group=new THREE.Group();group.name='Marca_copyright_modelo';group.userData={presentation:true,flag:'showCopyright',text:'copyright @gabrielhuav'};world.add(group);
 const style=copyrightStyle();group.userData.color=style.color;group.userData.pattern='tiled-site';
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=192;const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px sans-serif';ctx.lineWidth=9;ctx.strokeStyle='#fff8e9';ctx.strokeText('copyright @gabrielhuav',768,96,1470);ctx.fillStyle=style.color;ctx.fillText('copyright @gabrielhuav',768,96,1470);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:style.opacity,fog:false,toneMapped:false,side:THREE.DoubleSide,depthWrite:false});
 const height=Math.max(...data.buildings.map(b=>b.floors*data.storeyHeight))+4;
 const panels=copyrightPanelsForSite(data.site,data.metersPerPixel,style);
 group.userData.panelCount=panels.length;
 for(const [i,p]of panels.entries()){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(p.width,p.width/8),mat);mesh.name='Copyright_integrado_'+i;mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,height,p.z);mesh.renderOrder=5;mesh.userData.disposeCopyrightMaterial=i===0;group.add(mesh);}
 syncCopyright();
}
$('copyrightToggle').onchange=()=>{if(isSaving)return;rememberEdit();data.showCopyright=$('copyrightToggle').checked;syncCopyright();updateSaveState();message(copyrightEnabled()?'Marca integrada activada. Guarda cambios para actualizar GLB y PNG.':'Marca desactivada. Guarda cambios para exportar sin ella.');};

function building(b){
 const g=new THREE.Group();g.name='Edificio_'+b.id;g.userData={id:b.id,name:b.name||b.id,floors:b.floors,approximate:true,source:b.source};g.position.set(b.offsetX||0,0,b.offsetZ||0);world.add(g);buildingGroups.set(b.id,g);const height=b.floors*data.storeyHeight;
 const polys=b.polygons||b.rects.map(r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]]);
 for(const poly of polys){const shape=new THREE.Shape();poly.forEach((p,i)=>i?shape.lineTo(X(p[0]),-Z(p[1])):shape.moveTo(X(p[0]),-Z(p[1])));shape.closePath();
  function volume(name,y,h,color){const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}),material(color));m.rotation.x=-Math.PI/2;m.position.y=y;m.name=name;m.castShadow=true;m.receiveShadow=true;g.add(m);}
  const main=b.id==='TORRE_III';
  volume('Cuerpo_aproximado',.25,height,main?'#b47e63':'#d6d3c5');volume('Azotea',height+.25,.35,main?'#b14937':b.roof||'#b8c0b6');
  if(!main)for(let f=0;f<b.floors;f++)for(let i=0;i<poly.length;i++){const a=poly[i],q=poly[(i+1)%poly.length],dx=X(q[0])-X(a[0]),dz=Z(q[1])-Z(a[1]),length=Math.hypot(dx,dz);if(length<1)continue;const pane=box(g,'Ventana_nivel_'+f,(X(a[0])+X(q[0]))/2,f*data.storeyHeight+2,(Z(a[1])+Z(q[1]))/2,.14,1.1,length,'#526d70');pane.rotation.y=Math.atan2(dx,dz);}
 }
 if(b.id==='TORRE_III')cuajimalpaFacades(g,height);
 const points=polys.flat(),cx=points.reduce((a,p)=>a+X(p[0]),0)/points.length,cz=points.reduce((a,p)=>a+Z(p[1]),0)/points.length;label(b.id,cx+g.position.x,height+4,cz+g.position.z);return g;
}
function tree(px,py,size=1,palm=false,elevation=0){
 const group=new THREE.Group();group.name=palm?'Palmera_editable':'Árbol_editable';group.position.set(X(px),0,Z(py));vegetation.add(group);
 registerEditable('tree_'+px+'_'+py,(palm?'Palmera':'Árbol')+' · '+Math.round(X(px))+', '+Math.round(Z(py))+' m','tree',group);
 const x=0,z=0,trunk=new THREE.Mesh(cylinder,material('#75654c'));trunk.name=palm?'Palmera_tronco':'Árbol_tronco';trunk.scale.set(palm?.3:.4,palm?12:4,.4);trunk.position.set(x,(palm?6:2)+elevation,z);trunk.castShadow=true;group.add(trunk);
 if(palm){for(let a=0;a<8;a++){const leaf=new THREE.Mesh(crown,material('#567d3d'));leaf.scale.set(3.5,.4,.8);leaf.rotation.y=a*Math.PI/4;leaf.position.set(x+1.2*Math.cos(a*Math.PI/4),12+elevation,z+1.2*Math.sin(a*Math.PI/4));group.add(leaf);}}
 else {const c=new THREE.Mesh(crown,material(['#47774e','#5b8557','#689460'][Math.floor(px+py)%3]));c.scale.set(2.9*size,3.3*size,2.9*size);c.position.set(x,5*size+elevation,z);c.castShadow=true;group.add(c);}
}
function inside(px,py,poly){let v=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>py)!=(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
function excluded(x,y){const rects=[...data.buildings.flatMap(b=>b.rects),...data.plazas.map(p=>p.rect),...data.parking,...data.paths];return rects.some(r=>x>r[0]-10&&x<r[2]+10&&y>r[1]-10&&y<r[3]+10);}
function generate(){
 if(world){scene.remove(world);world.traverse(o=>{if(o.geometry&&![cube,cylinder,crown].includes(o.geometry))o.geometry.dispose();if(o.userData.disposeCopyrightMaterial){o.material.map?.dispose();o.material.dispose();}if(o.userData.disposeMaterial){o.material.map?.dispose();o.material.dispose();}});}
 clearEditSelection();labelLayer.replaceChildren();labels=[];buildingGroups.clear();editables.clear();world=new THREE.Group();world.name='UAM_'+UNIT.name;world.userData={units:'meters',approximate:true,reference:data.reference,unit:UNIT.name,dataLicense:data.license};scene.add(world);
 vegetation=new THREE.Group();vegetation.name='Vegetación';world.add(vegetation);const p=UNIT.plan;
 box(world,'Base maqueta',(p.xMin+p.xMax)/2,-2,(p.zMin+p.zMax)/2,p.xMax-p.xMin,4,p.zMax-p.zMin,'#bbc3b5');meshPoly(world,data.site,.1,'#90aa81','Predio_aproximado');
 for(const [i,poly]of(data.courts||[]).entries())meshPoly(world,poly,.31,'#4f906c','Cancha_aproximada_'+i);
 for(const r of data.paths)slab(world,r,'#d5cbb1');for(const plaza of data.plazas)slab(world,plaza.rect,'#b87861');
 for(const [i,r]of data.parking.entries())parkingArea(r,'parking_'+i,'Estacionamiento '+(i+1));for(const [i,p]of(data.extraParking||[]).entries())parkingArea(p.rect,p.id,'Estacionamiento nuevo '+(i+1));
 for(const b of data.buildings)building(b);
 cuajimalpaEntrance();
 roadCorridors=[];
 cuajimalpaCourts();
 cuajimalpaAccessPath();
 cuajimalpaAgora();
 let seed=1729;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<120;n++){const px=895+p.xMin+rand()*(p.xMax-p.xMin),py=390+p.zMin+rand()*(p.zMax-p.zMin);if(inside(px,py,data.site)&&!excluded(px,py)&&!nearRoad(X(px),Z(py)))tree(px,py,.6);}
 vegetation.visible=$('trees').checked;labelLayer.hidden=!$('names').checked;addCopyrightToModel();world.updateMatrixWorld(true);selectBuilding(selected);refreshEditor();
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{if(editMode)return;if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...buildingGroups.values()],true);if(hits.length){let o=hits[0].object;while(o.parent&&o.userData.id===undefined)o=o.parent;selectBuilding(o.userData.id);}});
let highlight;
function selectBuilding(id){selected=id||'';$('building').value=selected;if(highlight){scene.remove(highlight);highlight.geometry.dispose();highlight.material.dispose();highlight=null;}
 const b=data.buildings.find(b=>b.id===selected);$('editor').hidden=!b;
 if(!b){$('info').textContent='Haz clic en un edificio o selecciónalo en la lista.';return;}
 $('info').textContent=(b.name||b.id)+' · '+b.floors+' niveles aproximados · Validar con observación del alumnado.';
 for(const key of ['floors','offsetX','offsetZ'])$(key).value=b[key]||0;
 highlight=new THREE.BoxHelper(buildingGroups.get(b.id),'#ffb02e');scene.add(highlight);
}
for(const b of data.buildings){const option=document.createElement('option');option.value=b.id;option.textContent=b.name||'Edificio '+b.id;$('building').append(option);}
$('building').onchange=e=>selectBuilding(e.target.value);
$('apply').onclick=()=>{const b=data.buildings.find(b=>b.id===selected);if(!b)return;const n=Number($('floors').value),ox=Number($('offsetX').value),oz=Number($('offsetZ').value);if(!Number.isInteger(n)||n<1||n>8||![ox,oz].every(Number.isFinite)){message('Introduce niveles entre 1 y 8 y desplazamientos válidos.');return;}rememberEdit();b.floors=n;delete b.height;b.offsetX=ox;b.offsetZ=oz;generate();updateSaveState();message('Edificio actualizado. Guarda datos y GLB para conservar el cambio.');};
function resize(){const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);perspective.aspect=w/h;perspective.updateProjectionMatrix();const span=Math.max((UNIT.plan.xMax-UNIT.plan.xMin)/2,(UNIT.plan.zMax-UNIT.plan.zMin)/2*w/h)*1.1;ortho.left=-span;ortho.right=span;ortho.top=span*h/w;ortho.bottom=-span*h/w;ortho.updateProjectionMatrix();if(!topMode){const distance=focusMode?Math.max(minFocusDistance,focusSpan/(Math.tan(THREE.MathUtils.degToRad(perspective.fov/2))*perspective.aspect)):Math.max((UNIT.plan.zMax-UNIT.plan.zMin)*.9,(UNIT.plan.xMax-UNIT.plan.xMin)*.6/(Math.tan(THREE.MathUtils.degToRad(perspective.fov/2))*perspective.aspect));perspective.position.sub(controls.target).normalize().multiplyScalar(distance).add(controls.target);controls.update();}}
window.addEventListener('resize',resize);
$('expand').onclick=()=>{const panel=document.querySelector('aside');panel.hidden=!panel.hidden;mount.style.left=panel.hidden?'0px':'';$('expand').textContent=panel.hidden?'Mostrar controles':'Ampliar vista';resize();};
// Misma transformación de norte que Campus.kt; no escala la geometría ni aplica dos veces la calibración.
function campusNorth(geo){
 if(!geo)return null;
 const ul=geo.superiorIzquierda,ur=geo.superiorDerecha,ll=geo.inferiorIzquierda;
 if(![ul,ur,ll].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||!(geo.ancho>0&&geo.alto>0))return null;
 const cosLat=Math.cos(ul[0]*Math.PI/180),ax=(ur[1]-ul[1])*cosLat/geo.ancho,ay=(ur[0]-ul[0])/geo.ancho,bx=(ll[1]-ul[1])*cosLat/geo.alto,by=(ll[0]-ul[0])/geo.alto,det=ax*by-ay*bx;
 if(Math.abs(det)<1e-18)return null;
 const x=-bx/det,z=ax/det,length=Math.hypot(x,z);return {x:x/length,z:z/length};
}
function view(mode){topMode=mode==='top';focusMode=['approved','glass','entrance','access'].includes(mode);focusSpan=65;minFocusDistance=175;camera=topMode?ortho:perspective;controls.object=camera;controls.enableRotate=!topMode;controls.target.set(0,0,0);camera.zoom=1;camera.up.set(0,1,0);const north=campusNorth(georeference)||{x:0,z:-1};
 if(topMode){camera.position.set(0,1000,0);camera.up.set(north.x,0,north.z);}else camera.position.set(-north.x*630,580,-north.z*630);
 if(focusMode){const b=data.buildings.find(b=>b.id==='TORRE_III'),center=new THREE.Vector3(X(CU_FRAME.x)+(b.offsetX||0),10,Z(CU_FRAME.z)+(b.offsetZ||0));controls.target.copy(center);const delta=mode==='glass'?new THREE.Vector3(65,55,-150):new THREE.Vector3(155,58,65);delta.applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);camera.position.copy(center).add(delta);}
 if(mode==='entrance'){focusSpan=20;minFocusDistance=48;const entrance=editables.get('porteria_cuajimalpa');controls.target.copy(entrance?.node.position||new THREE.Vector3());controls.target.y=5;const delta=new THREE.Vector3(20,12,48).applyAxisAngle(new THREE.Vector3(0,1,0),entrance?.node.rotation.y??CU_FRAME.angle);camera.position.copy(controls.target).add(delta);}
 // Canchas: desde la entrada hacia la sede, como las fotos aéreas de referencia.
 $('courts').classList.toggle('active',mode==='courts');if(mode==='courts'){focusMode=true;focusSpan=60;minFocusDistance=215;const target=new THREE.Vector3(-3,0,-110).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);controls.target.set(X(CU_FRAME.x)+target.x,2,Z(CU_FRAME.z)+target.z);const delta=new THREE.Vector3(10,160,-125).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);camera.position.copy(controls.target).add(delta);}
 if(mode==='access'){focusSpan=135;minFocusDistance=350;const target=new THREE.Vector3(0,0,-65).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);controls.target.set(X(CU_FRAME.x)+target.x,3,Z(CU_FRAME.z)+target.z);const delta=new THREE.Vector3(150,290,100).applyAxisAngle(new THREE.Vector3(0,1,0),CU_FRAME.angle);camera.position.copy(controls.target).add(delta);}
 camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();for(const id of ['approved','glass','entrance','access','maps','top'])$(id).classList.toggle('active',id===mode);resize();}
for(const mode of ['approved','glass','entrance','access','maps','top'])$(mode).onclick=()=>view(mode);
$('courts').onclick=()=>view('courts');
$('spin').onclick=()=>{if(topMode)view('maps');controls.autoRotate=!controls.autoRotate;$('spin').classList.toggle('active',controls.autoRotate);};
$('trees').onchange=()=>vegetation.visible=$('trees').checked;$('names').onchange=()=>labelLayer.hidden=!$('names').checked;$('grid').onchange=()=>grid.visible=$('grid').checked;
function message(text){$('status').textContent=text;clearTimeout(message.timer);message.timer=setTimeout(()=>$('status').textContent='',6500);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),6000);}
async function save(blob,kind,name){if(location.protocol==='http:'&&['localhost','127.0.0.1'].includes(location.hostname)){const res=await fetch('/guardar/'+kind,{method:'POST',body:blob});if(!res.ok)throw Error('No se pudo guardar');const r=await res.json();message('Guardado en la carpeta del modelo: '+r.saved);}else{download(blob,name);message('Archivo preparado para descargar.');}}
$('saveglb').onclick=async()=>{if(isSaving)return;const btn=$('saveglb');btn.disabled=true;message('Preparando modelo GLB…');const was=vegetation.visible;try{vegetation.visible=true;const result=await new GLTFExporter().parseAsync(world,{binary:true,onlyVisible:true});await save(new Blob([result],{type:'model/gltf-binary'}),'glb',UNIT.glb);}catch(e){$('error').textContent=e.message;}finally{vegetation.visible=was;btn.disabled=false;}};
$('savejson').onclick=()=>saveEditorChanges(false);
$('savepng').onclick=async()=>{renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);const factor=canvas.width/mount.clientWidth;if($('names').checked)for(const l of labels){if(l.el.style.display==='none')continue;const x=parseFloat(l.el.style.left)*factor,y=parseFloat(l.el.style.top)*factor;ctx.font=`600 ${12*factor}px sans-serif`;const w=ctx.measureText(l.el.textContent).width+12*factor;ctx.fillStyle=l.el.classList.contains('vehicle')?'#bc3535':l.el.classList.contains('pedestrian')?'#1d72b6':'#fffdf0';ctx.fillRect(x-w/2,y-10*factor,w,20*factor);ctx.fillStyle=['vehicle','pedestrian'].some(c=>l.el.classList.contains(c))?'white':'#243b2e';ctx.textAlign='center';ctx.fillText(l.el.textContent,x,y+4*factor);}
 ctx.textAlign='left';ctx.font=`${12*factor}px sans-serif`;ctx.fillStyle='#344d3f';ctx.fillText('UAM Cuajimalpa · Croquis inicial aproximado',18*factor,canvas.height-18*factor);drawWatermark(ctx);canvas.toBlob(async b=>{try{await save(b,'png','Vista_UAM.png');}catch(e){message(e.message);}},'image/png');};
$('loadjson').onclick=()=>$('filejson').click();
$('filejson').onchange=async e=>{try{if(!e.target.files[0])return;const loaded=validateCampus(JSON.parse(await e.target.files[0].text()));rememberEdit();data=loaded;selected='';editSelected='';generate();updateSaveState();message('Datos cargados. Usa Guardar cambios para conservarlos.');}catch(e){message('No se pudo abrir: '+e.message);}finally{e.target.value='';}};
// Editor ligero: los cambios son datos; los controles no forman parte del GLB.
let editHelper=null;
function clearEditSelection(){if(editHelper){scene.remove(editHelper);editHelper.geometry.dispose();editHelper.material.dispose();editHelper=null;}}
function registerEditable(id,title,kind,node,size){
 if((data.removedElements||[]).includes(id)){node.removeFromParent();return;}
 const entry={id,title,kind,node,basePosition:node.position.clone(),baseAngle:node.rotation.y,size};editables.set(id,entry);node.userData.editableId=id;
 const change=data.elementEdits?.[id]||{};node.position.x+=change.offsetX||0;node.position.z+=change.offsetZ||0;node.rotation.y+=change.rotation||0;
 if(size){node.scale.x=(change.width||size.width)/size.width;node.scale.z=(change.depth||size.depth)/size.depth;}
}
function parkingArea(r,id,title){
 const w=(r[2]-r[0])*S(),d=(r[3]-r[1])*S(),group=new THREE.Group();group.name='Estacionamiento_editable_'+id;group.position.set(X((r[0]+r[2])/2),0,Z((r[1]+r[3])/2));world.add(group);registerEditable(id,title,'parking',group,{width:w,depth:d});
 box(group,'Asfalto',0,.16,0,w,.25,d,'#777f78');
 // Los cajones no sobrepasan la superficie y dejan pasillos de circulación.
 for(let x=-w/2+3;x<w/2-1;x+=2.5)for(let z=-d/2+1;z+5<d/2-1;z+=10)box(group,'Cajón',x,.32,z+2.5,.055,.025,5,'#dfd4a0');
}
function editSnapshot(){return structuredClone(data);}
function rememberEdit(snapshot=editSnapshot()){undoHistory.push(snapshot);if(undoHistory.length>40)undoHistory.shift();redoHistory=[];}
function updateSaveState(){const dirty=JSON.stringify(data)!==savedData;$('saveState').textContent=isSaving?'Guardando…':dirty?'Hay cambios sin guardar.':'Sin cambios pendientes.';$('editUndo').disabled=!undoHistory.length;$('editRedo').disabled=!redoHistory.length;}
function rebuildAfterEdit(){generate();updateSaveState();}
function editorOptions(){
 const selector=$('editObject'),kind=$('editFilter').value;selector.replaceChildren(new Option('Selecciona en el mapa o en esta lista',''));
 for(const e of editables.values())if(kind==='all'||e.kind===kind)selector.add(new Option(e.title,e.id));
 selector.value=editSelected;
}
function refreshEditor(){editorOptions();showObjectFields();}
function showObjectFields(){
 clearEditSelection();const e=editables.get(editSelected);$('objectFields').hidden=!e;if(!e)return;
 $('editObject').value=e.id;$('objectX').value=e.node.position.x.toFixed(2);$('objectZ').value=e.node.position.z.toFixed(2);$('objectAngle').value=THREE.MathUtils.radToDeg(e.node.rotation.y).toFixed(1);
 $('parkingFields').hidden=e.kind!=='parking';if(e.size){$('parkingWidth').value=(e.size.width*e.node.scale.x).toFixed(2);$('parkingDepth').value=(e.size.depth*e.node.scale.z).toFixed(2);}
 if(editMode){editHelper=new THREE.BoxHelper(e.node,'#f4a622');editHelper.name='Selección_editor';scene.add(editHelper);}
}
function chooseEditable(id){editSelected=id||'';const e=editables.get(id);if(e&&$('editFilter').value!=='all'&&$('editFilter').value!==e.kind)$('editFilter').value='all';refreshEditor();}
function resetDraw(){drawStart=null;if(drawPreview){scene.remove(drawPreview);drawPreview.geometry.dispose();drawPreview.material.dispose();drawPreview=null;}}
function setEditing(value){
 editMode=value;resetDraw();controls.autoRotate=false;$('spin').classList.remove('active');controls.enabled=true;$('sceneEditor').hidden=!value;$('toggleEdit').textContent=value?'Cerrar modo edición':'Activar modo edición';$('toggleEdit').setAttribute('aria-expanded',String(value));mount.classList.toggle('editing',value);refreshEditor();
 if(value)message('Selecciona y arrastra un elemento. Los cambios se conservan con Guardar cambios.');
}
$('toggleEdit').onclick=()=>setEditing(!editMode);
$('editObject').onchange=e=>chooseEditable(e.target.value);
$('editFilter').onchange=()=>{editSelected='';refreshEditor();};
$('editTop').onclick=()=>view('top');
$('editTool').onchange=()=>{resetDraw();message($('editTool').value==='parking'?'Marca dos esquinas del estacionamiento. Esc cancela.':$('editTool').value==='place'?'Selecciona un elemento en la lista y haz clic en su nueva ubicación.':'Selecciona un elemento y arrástralo.');};
$('editUndo').onclick=()=>{if(isSaving||!undoHistory.length)return;resetDraw();redoHistory.push(editSnapshot());data=undoHistory.pop();rebuildAfterEdit();message('Cambio deshecho.');};
$('editRedo').onclick=()=>{if(isSaving||!redoHistory.length)return;resetDraw();undoHistory.push(editSnapshot());data=redoHistory.pop();rebuildAfterEdit();message('Cambio recuperado.');};
function writeTransform(e,x,z,angle,width,depth){
 data.elementEdits??={};data.elementEdits[e.id]={offsetX:x-e.basePosition.x,offsetZ:z-e.basePosition.z,rotation:angle-e.baseAngle,...(e.size?{width:width??e.size.width*e.node.scale.x,depth:depth??e.size.depth*e.node.scale.z}:{})};
}
$('applyObject').onclick=()=>{
 const e=editables.get(editSelected);if(!e)return;const x=Number($('objectX').value),z=Number($('objectZ').value),angle=Number($('objectAngle').value),w=Number($('parkingWidth').value),d=Number($('parkingDepth').value);
 if(![x,z,angle].every(Number.isFinite)||Math.abs(x)>1000||Math.abs(z)>1000||(e.size&&(![w,d].every(Number.isFinite)||w<2||w>750||d<2||d>310))){message('Revisa las medidas. Estacionamientos: ancho de 2 a 750 m y fondo de 2 a 310 m.');return;}
 rememberEdit();writeTransform(e,x,z,THREE.MathUtils.degToRad(angle),w,d);rebuildAfterEdit();message('Elemento actualizado.');
};
$('resetObject').onclick=()=>{if(!editables.has(editSelected))return;rememberEdit();delete data.elementEdits?.[editSelected];rebuildAfterEdit();message('Elemento restablecido.');};
$('deleteObject').onclick=()=>{if(!editables.has(editSelected))return;rememberEdit();data.removedElements??=[];data.removedElements.push(editSelected);editSelected='';rebuildAfterEdit();message('Elemento quitado. Puedes recuperarlo con Deshacer.');};
function canvasRay(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function groundPoint(e){canvasRay(e);const p=new THREE.Vector3();return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p);}
function snapped(p){if($('editSnap').checked){p.x=Math.round(p.x*2)/2;p.z=Math.round(p.z*2)/2;}return p;}
function editableAt(e){canvasRay(e);const hits=raycaster.intersectObjects([...editables.values()].filter(e=>e.kind!=='tree'||vegetation.visible).map(e=>e.node),true);const selected=editables.get(editSelected);if(selected&&hits.length){const selectedHits=raycaster.intersectObject(selected.node,true);if(selectedHits.length&&selectedHits[0].distance<=hits[0].distance+.3)return selected;}for(const hit of hits){let node=hit.object;while(node&&!node.userData.editableId)node=node.parent;if(node)return editables.get(node.userData.editableId);}return null;}
function consumePointer(e){e.preventDefault();e.stopImmediatePropagation();}
function validParkingPoint(p){return inside(p.x/S()+895,p.z/S()+390,data.site);}
function finishParking(p){
 const a=drawStart,w=Math.abs(p.x-a.x),d=Math.abs(p.z-a.z);if(w<2||d<2){message('Marca una segunda esquina a más de 2 m de la primera.');return;}
 const points=[[Math.min(a.x,p.x),Math.min(a.z,p.z)],[Math.max(a.x,p.x),Math.min(a.z,p.z)],[Math.max(a.x,p.x),Math.max(a.z,p.z)],[Math.min(a.x,p.x),Math.max(a.z,p.z)]];
 if(!points.every(([x,z])=>validParkingPoint(new THREE.Vector3(x,0,z)))){message('Las cuatro esquinas deben quedar dentro del campus.');return;}
 rememberEdit();data.extraParking??=[];const id='parking_new_'+Date.now().toString(36)+'_'+data.extraParking.length;
 data.extraParking.push({id,rect:[points[0][0]/S()+895,points[0][1]/S()+390,points[2][0]/S()+895,points[2][1]/S()+390]});resetDraw();editSelected=id;$('editFilter').value='parking';rebuildAfterEdit();$('editTool').value='move';message('Estacionamiento creado. Puedes moverlo, girarlo y ajustar sus medidas.');
}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(!editMode||e.button!==0||isSaving)return;const tool=$('editTool').value;
 if(tool==='parking'){consumePointer(e);const p=groundPoint(e);if(!p)return;snapped(p);if(!drawStart){if(!validParkingPoint(p)){message('Marca la primera esquina dentro del campus.');return;}drawStart=p;message('Ahora marca la esquina opuesta.');}else finishParking(p);return;}
 if(tool==='place'){consumePointer(e);const entry=editables.get(editSelected),p=groundPoint(e);if(!entry){message('Elige primero un elemento en la lista.');return;}if(!p)return;snapped(p);rememberEdit();writeTransform(entry,p.x,p.z,entry.node.rotation.y);rebuildAfterEdit();message('Elemento colocado.');return;}
 const entry=editableAt(e);if(!entry)return;consumePointer(e);const p=groundPoint(e);if(!p)return;chooseEditable(entry.id);controls.enabled=false;dragEdit={entry,start:p,position:entry.node.position.clone(),snapshot:editSnapshot(),pointerId:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);
},true);
renderer.domElement.addEventListener('pointermove',e=>{
 if(!editMode)return;
 if(dragEdit){consumePointer(e);const p=groundPoint(e);if(!p)return;const target=dragEdit.position.clone().add(p.sub(dragEdit.start));snapped(target);dragEdit.entry.node.position.x=target.x;dragEdit.entry.node.position.z=target.z;editHelper?.update();return;}
 if(drawStart){const p=groundPoint(e);if(!p)return;snapped(p);if(!drawPreview){drawPreview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#efb542',transparent:true,opacity:.55,depthTest:false}));drawPreview.name='Vista_previa_estacionamiento';drawPreview.renderOrder=10;scene.add(drawPreview);}drawPreview.position.set((drawStart.x+p.x)/2,.5,(drawStart.z+p.z)/2);drawPreview.scale.set(Math.max(.05,Math.abs(p.x-drawStart.x)),.15,Math.max(.05,Math.abs(p.z-drawStart.z)));}
},true);
function endEditDrag(e,cancel=false){if(!dragEdit)return;consumePointer(e);const drag=dragEdit;dragEdit=null;controls.enabled=true;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
 const moved=drag.entry.node.position.distanceTo(drag.position)>.01;if(cancel){drag.entry.node.position.copy(drag.position);showObjectFields();return;}if(moved){rememberEdit(drag.snapshot);writeTransform(drag.entry,drag.entry.node.position.x,drag.entry.node.position.z,drag.entry.node.rotation.y);rebuildAfterEdit();}else showObjectFields();
}
renderer.domElement.addEventListener('pointerup',e=>endEditDrag(e),true);
renderer.domElement.addEventListener('pointercancel',e=>endEditDrag(e,true),true);
document.addEventListener('keydown',e=>{if(!editMode||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){resetDraw();message('Dibujo cancelado.');}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'editRedo':'editUndo').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('editRedo').click();}});
window.addEventListener('beforeunload',e=>{if(savedData&&JSON.stringify(data)!==savedData){e.preventDefault();e.returnValue='';}});
function validateCampus(d){
 if(d?.showCopyright!==undefined&&typeof d.showCopyright!=='boolean')throw Error('showCopyright debe ser true o false');
 const rect=r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>r[0]&&r[3]>r[1];
 if(d?.unit?.slug!==UNIT.slug)throw Error('Este archivo pertenece a otra unidad.');
 if(!d||!Array.isArray(d.buildings)||!Array.isArray(d.site)||!(d.metersPerPixel>0)||!Number.isFinite(d.storeyHeight)||!d.buildings.every(b=>typeof b.id==='string'&&Number.isInteger(b.floors)&&b.floors>=1&&b.floors<=8&&Array.isArray(b.rects)&&b.rects.every(rect))||!['plazas','paths','parking','gates'].every(k=>Array.isArray(d[k]))||!d.parking.every(rect)||!d.paths.every(rect)||!d.plazas.every(p=>rect(p.rect)))throw Error('Datos de campus inválidos');
 if(d.extraParking!==undefined&&(!Array.isArray(d.extraParking)||d.extraParking.length>500||!d.extraParking.every(p=>typeof p.id==='string'&&/^parking_new_[a-z0-9_]+$/.test(p.id)&&rect(p.rect))))throw Error('Estacionamientos inválidos');
 if(d.removedElements!==undefined&&(!Array.isArray(d.removedElements)||!d.removedElements.every(id=>typeof id==='string')))throw Error('Elementos retirados inválidos');
 if(d.elementEdits!==undefined&&(!d.elementEdits||Array.isArray(d.elementEdits)||typeof d.elementEdits!=='object'||!Object.values(d.elementEdits).every(v=>v&&typeof v==='object'&&Object.entries(v).every(([key,n])=>['offsetX','offsetZ','rotation','width','depth'].includes(key)&&Number.isFinite(n)&&Math.abs(n)<10000)&&(!('width'in v)||v.width>=2)&&(!('depth'in v)||v.depth>=2))))throw Error('Posiciones de elementos inválidas');
 if(!d.buildings.every(b=>!b.polygons||Array.isArray(b.polygons)&&b.polygons.every(poly=>Array.isArray(poly)&&poly.length>=3&&poly.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))))throw Error('Huellas inválidas');
 return {...d,unit:UNIT,version:8};
}
// Plano 2D para la app móvil: vista ortográfica desde arriba, fondo transparente, +X a la derecha y -Z arriba.
// La app lo coloca sobre el mapa real con georreferencia.json; estos límites (m) deben coincidir con los de ahí.
// Marca temporal sobre la imagen, nunca sobre la geometría exportada.
function drawWatermark(ctx){
 if(!copyrightEnabled())return;
 const text='copyright @gabrielhuav',margin=12,size=14;ctx.save();ctx.font='500 '+size+'px system-ui, sans-serif';ctx.textAlign='right';ctx.textBaseline='bottom';const width=ctx.measureText(text).width;
 ctx.fillStyle='rgba(255,255,255,.78)';ctx.fillRect(ctx.canvas.width-margin-width-8,ctx.canvas.height-margin-size-6,width+16,size+12);ctx.fillStyle=copyrightStyle().color;ctx.fillText(text,ctx.canvas.width-margin,ctx.canvas.height-margin);ctx.restore();
}
async function watermarkedPlan(source){
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);drawWatermark(ctx);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo crear el plano PNG.')),'image/png'));
}
const PLANO=UNIT.plan;
async function planoBlob(){
 const w=(PLANO.xMax-PLANO.xMin)*PLANO.pxPorMetro,h=(PLANO.zMax-PLANO.zMin)*PLANO.pxPorMetro;
 const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(w,h,false);r.setClearColor(0,0);
 r.outputColorSpace=renderer.outputColorSpace;r.toneMapping=renderer.toneMapping;r.toneMappingExposure=renderer.toneMappingExposure;
 const cam=new THREE.OrthographicCamera(PLANO.xMin,PLANO.xMax,-PLANO.zMin,-PLANO.zMax,1,2500);cam.position.set(0,1000,0);cam.up.set(0,0,-1);cam.lookAt(0,0,0);
 const ocultos=[...['Base maqueta','Eje_5_Norte_Montevideo','Av_San_Pablo'].map(n=>world.getObjectByName(n)),sky,editHelper,highlight].filter(Boolean).map(node=>({node,visible:node.visible})),was=vegetation.visible,fog=scene.fog,g=grid.visible;
 for(const o of ocultos)o.node.visible=false;vegetation.visible=true;scene.fog=null;grid.visible=false;
 try{r.render(scene,cam);return await watermarkedPlan(r.domElement);}
 finally{for(const o of ocultos)o.node.visible=o.visible;vegetation.visible=was;scene.fog=fog;grid.visible=g;r.dispose();}
}
async function saveEditorChanges(withModel=true){
 if(isSaving)return;isSaving=true;resetDraw();updateSaveState();const buttons=['copyrightToggle','saveChanges','saveglb','savejson','apply','applyObject','deleteObject','resetObject','loadjson','toggleEdit','editUndo','editRedo'];for(const id of buttons)$(id).disabled=true;
 const snapshot=JSON.stringify(data);try{
  if(withModel){const was=vegetation.visible;vegetation.visible=true;try{const result=await new GLTFExporter().parseAsync(world,{binary:true,onlyVisible:true});await save(new Blob([result],{type:'model/gltf-binary'}),'glb',UNIT.glb);}finally{vegetation.visible=was;}await save(await planoBlob(),'plano','plano_2d.png');}
  await save(new Blob([JSON.stringify(JSON.parse(snapshot),null,2)],{type:'application/json'}),'json','campus_editado.json');savedData=snapshot;message(withModel?'Cambios y modelo 3D guardados. Puedes avisarme para crear el checkpoint.':'Datos guardados. El botón Guardar cambios también actualiza el modelo 3D.');
 }catch(e){message('No se pudo completar el guardado: '+e.message);}finally{isSaving=false;for(const id of buttons)$(id).disabled=false;updateSaveState();}
}
$('saveChanges').onclick=()=>saveEditorChanges(true);

async function startCampus(){
 if(location.protocol==='http:'){try{const geo=await fetch('./georreferencia.json',{cache:'no-store'});if(geo.ok){const candidate=await geo.json();if(campusNorth(candidate))georeference=candidate;}}catch{ /* El visor portátil mantiene su orientación de reserva. */ }}
 let notice='Listo: gira el modelo con el ratón.';
 if(location.protocol==='http:'&&['localhost','127.0.0.1'].includes(location.hostname)){
  try{const response=await fetch('./campus_editado.json',{cache:'no-store'});if(response.ok){data=validateCampus(await response.json());notice='Se cargaron tus últimos cambios guardados.';}}
  catch(e){notice='No se pudieron cargar los datos guardados. Se muestra la base; revisa el archivo antes de guardar.';}
 }
 data.version=8;savedData=JSON.stringify(data);generate();view('approved');resize();updateSaveState();message(notice);
}
startCampus();
const v=new THREE.Vector3();function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);const w=mount.clientWidth,h=mount.clientHeight;for(const l of labels){v.copy(l.p).project(camera);l.el.style.display=v.z<1&&v.z>-1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1?'':'none';l.el.style.left=((v.x+1)*w/2)+'px';l.el.style.top=((-v.y+1)*h/2)+'px';}
 // Escala local en el plano del suelo: varía con cámara y perspectiva.
 const a=new THREE.Vector3(0,0,0).project(camera),b=new THREE.Vector3(50,0,0).project(camera);const px=Math.abs(b.x-a.x)*w/2;mount.querySelector('.scale').style.width=Math.max(2,px)+'px';$('scaleText').textContent='50 m aprox. · Referencia local en el centro del terreno';}
animate();
