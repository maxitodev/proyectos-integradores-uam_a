# UAM Cuajimalpa · Croquis inicial de Práctica 3

2 volúmenes aproximados; revisar huellas, nombres y niveles con el alumnado. No topográfico.
Torre III es un conjunto integrado (ocho niveles según informe UAM). Auxiliar norte es de uso por confirmar. Los controles exteriores no son instalaciones del campus.

## Fachadas · revisión 18 octubre

El conjunto principal tiene un generador propio en `cuajimalpaFacades()` de app.js: terracota, gran celosía oscura con pliegues claros, atrio de vidrio, bandas de corredores y dos lucernarios. Los detalles se exportan como parte de Edificio_TORRE_III, sin dividirlo en edificios separados. «Fachada · celosía» y «Fachada de vidrio» acercan la cámara; «Campus completo» recupera el contexto del predio.

La revisión del 23 de octubre (más abajo) movió la celosía al remetimiento trasero y quitó la plaza y la rampa esquemáticas del costado.

Referencia: tres fotografías aportadas por Gabriel en la conversación (acceso con «Soy UAM», frente acristalado, entrada desde portería). Son una interpretación visual: dimensiones de fachadas, reparto interior, posición de rampa y orientación de cada frente deben confirmarse en campo. Las fotos no mejoran la precisión geográfica. Se conservan exactamente los polígonos originales, la georreferencia y el encuadre del PNG. Las alturas siguen suponiendo 3.3 m por nivel. `architecture` en los JSON documenta esta revisión; el detalle geométrico se regenera desde app.js.

Segunda revisión, con foto frontal de la entrada y toma aérea: cubierta roja con dos estructuras longitudinales elevadas (función y dimensiones sin confirmar), ventanas laterales modulares, jardineras circulares y portería con torre, marquesina, tirantes, caseta y portones. No se copió el logotipo superpuesto a la foto aérea como elemento arquitectónico. El rótulo «UAM» de la portería es tipográfico simplificado.

«Portería» acerca la cámara. Para ajustar su posición provisional: Activar modo edición → Mostrar elementos: Portería → Elemento: Portería · posición aproximada → arrastrar o cambiar X/Z/giro → Guardar cambios. Es un solo grupo independiente, ID estable `porteria_cuajimalpa`; sus cambios viajan en `elementEdits`, GLB y PNG. No cambia el conteo de edificios. Se puede deshacer. La foto frontal no fija su posición geográfica: el anclaje provisional `architecture.entrance.localPosition` está expresado en el marco local `CU_FRAME`. Confirmar posición y orientación con referencia cenital antes de usarla para navegación precisa.

### Corrección del acceso con referencia cenital

La portería anterior en [-20,82] era incorrecta y queda sustituida por [-23,-173], al extremo de Vasco de Quiroga, con las canchas entre la entrada y la sede. Se gira 180° para mirar hacia la calle. Referencias nuevas de Gabriel: captura de Maps y foto aérea del edificio con canchas, tomadas desde ángulos diferentes. Se contrastó el orden relativo de los elementos; el punto exacto de la portería sigue siendo aproximado. No se giró el campus ni se alteró la georreferencia.

«Acceso y canchas» muestra la relación completa. Un andador esquemático recorre el lateral de las canchas hacia el edificio; su primer tramo sigue la portería si se mueve/gira y desaparece si se retira. No representa un itinerario medido. `architecture.accessOrder` y `accessPath` documentan el orden y el trazo aproximado. Las dos huellas de canchas previas se conservan; su detalle sigue pendiente. El plano 2D se vuelve a exportar con el nuevo acceso y conserva su encuadre.

### Canchas, camino de en medio y calle frente a la sede · revisión 22 octubre

Esta revisión sustituye las dos huellas previas de canchas (`courts` queda vacío). La geometría se midió sobre Esri World Imagery rectificada al marco local `CU_FRAME` y se contrastó con dos fotos aéreas del conjunto tomadas desde la entrada; cada medida es la mediana de tres mediciones independientes y coincide con la imagen dentro de ±0.5 m (la georreferencia sigue en RMS 2.5 m). Cancha de fútbol de 31.4×51.5 m, de fútbol rápido de 22.8×49.9 m con esquinas redondeadas y de básquetbol en una losa de 16.4×29.5 m; camino de en medio de 6.5 m entre las dos de fútbol; explanada al sur de las canchas y calle frente a la sede, que rodea la jardinera larga y la jardinera de remate y se une al camino poniente.

Los datos están en `architecture.sportsFields`, `walkways`, `planters`, `canopies`, `shelters` y `terrain` (marco local, metros); la calle es una entrada más de `architecture.roads`. `cuajimalpaCourts()` en app.js los dibuja: pasto sintético en franjas, líneas reglamentarias ajustadas al tamaño medido, porterías con red, torres de luz, tableros, postes de voleibol y el punto de reunión pintado en la de básquetbol; muro blanco de tableros con red alta alrededor de la de fútbol rápido; red alta detrás de la portería norte y gradas en la de fútbol; árboles, luminarias, seto, banca techada y otro punto de reunión en el camino de en medio; techumbre con frontón al sur de la cancha de fútbol.

Con fotos posteriores (desde el camino poniente, desde la sede y desde el lado del muro) se agregaron:
- La carpa del andador junto al camino de los coches: una fila de columnas blancas al centro y membrana en «ala» con arcos entre columnas, más una carpa ancha junto al estacionamiento.
- El montecito al oriente: muro de contención inclinado, meseta con el andador sobre el muro y sus lámparas tipo hongo, ladera con árboles y escaleras que suben desde la cancha de básquetbol. Es el único volumen con relieve del croquis; el muro y la meseta llegan a 6.2 m y la ladera sube hasta unos 9 m en la orilla del predio (estimaciones de las fotos). Se sube por las escaleras o por la rampa natural del extremo sur. El tramo del camino oriente (#35) que pasa por ahí queda dentro del montecito y lo representa el andador de arriba; su arranque queda bajo la losa de la cancha de básquetbol, que en la imagen satelital y en las fotos ocupa ese lugar. Los datos de #35 no se modificaron.

Líneas, porterías, redes, luminarias, árboles, carpas y alturas son interpretativos (fotos); confirmar en campo con `docs/plan-de-fotos/canchas.md`.

«Canchas» acerca la cámara desde la entrada hacia la sede, como las fotos aéreas. En el modo edición, «Mostrar elementos: Canchas» lista las tres canchas (`cancha_futbol_grande`, `cancha_futbol_rapido`, `cancha_basquetbol`): se mueven, giran o quitan, sus cambios viajan en `elementEdits`/`removedElements` y se pueden deshacer. Los árboles aleatorios no caen sobre canchas, andadores ni la calle.

### Parte de atrás y costado · revisión 23 octubre

Parte de Daniela Nava Martínez (issue #37, PR #45). Evidencia: cinco fotos de campo del 23 oct 2026 (letras y celosía; Ágora desde la plaza y bajo la membrana; costado con andador, talud y torre de escaleras; plaza con el Ágora) y Esri World Imagery z19 rectificada con `georreferencia.json`. Las fotos no se suben al repositorio.

- **Ágora** (`agora.js`, elemento editable `agora_cuajimalpa`). La idea y el programa son de la propuesta original de Daniela: cubierta blanca, dos pantallas, gradas y mesas en el pasto. La forma y el lugar se rehicieron con las fotos y el satélite. La membrana medida tiene 654 m² y su centro en el marco local está en (−15.7, 57); el ancla `architecture.agora.localPosition = [−16, 57]` gira con el edificio, así se ve en su lugar aun sin `campus_editado.json`.
  - Membrana tensada bajo dos arcos de armadura (clave ≈12.5 y 9 m), tres mástiles con luminaria de anillo, anclas laterales con puntales y cables.
  - Bocinas line-array colgadas del arco frontal y dos pantallas LED sobre andamio.
  - Foro de piso oscuro con tope amarillo; seis gradas curvas de concreto café con dos pasillos de narices amarillas.
  - Terraza de pasto a 2.9 m con muro y barandal, escalera lateral y bajada; seis mesas con techito naranja (posiciones medidas), árboles y personas.
- **Plaza trasera** (`plaza_trasera.js`): pavimento del remetimiento y andador sur, jardineras-banca circulares con agaves en las posiciones medidas, botes y barandal. Las **letras «soy uam»** (3D, base naranja «Unidad Cuajimalpa») son el elemento editable `letrero_soy_uam`, con ancla `architecture.letrero.localPosition = [2, 37]`. La plaza y la franja del costado copian las caras de la huella, así que siguen el desplazamiento editable de la Torre III; las letras y el Ágora conservan su ancla.
- **Celosía**: pasa de la cara +u al remetimiento trasero, frente a la plaza y las letras (fotos 1 y 5), y baja hasta el piso de la plaza con un marco delgado. El patrón de la foto 1 (retícula de rombos y cadenas blancas de eslabones huecos que se cruzan en «X») es una textura de repetición sobre un plano. La cámara «Fachada · celosía» la mira desde la plaza.
- **Costado +u** (foto 4): ahí no hay estacionamiento. Se quitaron la plaza con rayas naranjas, la rampa, las jardineras y el letrero plano que había; queda la franja con setos, mesas y malla, el **andador lateral** de asfalto (`walkways.andador_lateral`) que sigue hasta el andador sur, y un **talud de pasto** con arboleda arriba (`terrain.talud_costado`, `face: 'pasto'`, 27 árboles con `treeSize` 1.05; la ortofoto muestra copa continua). El andador lateral se dibuja como una sola franja con uniones a inglete. La cara +u lleva ventanas verticales en los niveles bajos y vidrio con parasoles en los altos; las dos **torres de escaleras** tienen balcones abiertos con barandal y tramos de escalera visibles en las caras que dan a la franja (en la foto 4 se ve la de la torre E) y, en la torre S, también hacia la plaza trasera. El `camino_oriente` termina para autos hacia z −45, como en el satélite.

Cámara «Ágora»: desde el oriente, por fuera de la cara trasera, con la celosía y las letras a la derecha (el foro está pegado al muro del bloque poniente, así que desde atrás del edificio no se ve); si se quita el Ágora apunta a su ancla. Filtro «Portería, Ágora y letras» en el modo edición. La casilla «Árboles» también oculta los árboles del Ágora y de la plaza. El GLB pasa de 0.81 a 1.29 MB (el Ágora suma unos 240 KB porque comparte geometrías y materiales). Huellas, IDs, georreferencia y plano de 1040×1000 sin cambios. Para el verificador del profesor: `Rampa_acceso_aproximada` ya no existe (era la rampa del costado) y `elementEdits` no está vacío.

Estimaciones por confirmar en campo: alturas de arcos, mástiles y membrana, altura del talud (5–8 m), posición exacta de las letras y de la malla, y la escalera de la esquina sur, que los árboles tapan en el satélite.

## Abrir (sin Node.js)
Doble clic en `Visor_UAM_autonomo.html` (o `Abrir_visor.cmd`, que lo abre en Edge). El HTML lleva dentro el diseño del equipo
(`campus_editado.json`), `georreferencia.json` y las texturas, así que se ve igual que con servidor.

Guardar cambios en Chrome o Edge: la primera vez pide la carpeta **campus-cuajimalpa** (la que contiene este HTML) y el permiso
«Permitir editar archivos». Ahí escribe `campus_editado.json`, `UAM_Cuajimalpa.glb`, `plano_2d.png`, sus variantes `_sin_marca` y actualiza el bloque de datos de
`Visor_UAM_autonomo.html`; al volver a abrirlo con doble clic se ven los cambios. La carpeta se recuerda (IndexedDB); tras cerrar el
navegador sólo se vuelve a pedir el permiso. Si `campus_editado.json` de la carpeta no es el que se abrió (p. ej. llegó otro con git),
pregunta antes de sobrescribirlo. Firefox y Safari no permiten escribir en carpetas: descargan los tres archivos (muévelos a la carpeta;
si la marca está apagada, cópialos también como `_sin_marca`) y con «Abrir datos guardados» se recuperan.

Node.js sólo hace falta para desarrollar: tras cambiar `app.js`, `index.html`, algún módulo (`vegetacion.js`, `agora.js`,
`plaza_trasera.js`, `geometria.js`, `efectos*.js`, `incrustar.js`), `vendor/` o `texturas/`, ejecutar `node build.mjs` (también incrusta el `campus_editado.json` actual). `node server.mjs` sigue
funcionando (http://127.0.0.1:8769/Visor_UAM_autonomo.html o `index.html` para probar sin compilar) y también actualiza el HTML al guardar.
Las bibliotecas locales están en vendor/; no se requiere instalar paquetes.

## Contrato de archivos
- campus_editado.json: estado editable que se carga primero.
- model-data.js: base alternativa; campus_base.json es su copia generada.
- UAM_Cuajimalpa.glb: geometría 3D, sin marca ni herramientas.
- plano_2d.png: transparente, 1040×1000, marca temporal copyright @gabrielhuav en esquina.
- georreferencia.json: tres esquinas lat/lon, RMS y procedencia.
- index.html/app.js: interfaz y generador. node build.mjs recompone el HTML autónomo; no exporta GLB/PNG.

Guardar cambios exporta JSON, GLB y PNG. Hay edición de niveles/desplazamiento de edificios y herramientas para árboles/estacionamientos, con deshacer/rehacer.
Sin servidor, en Chrome/Edge se guarda en la carpeta elegida (ver «Abrir»); en otros navegadores se descargan los archivos y se recuperan con Abrir datos guardados.
Los polígonos usan buildings[].polygons; rects conserva las envolventes. Suelo X/Z, altura Y; X=px-895, Z=py-390 (metersPerPixel=1).
La vegetación es ilustrativa. Las alturas suponen 3.3 m por nivel; no resuelven sótanos ni topografía.

## Calibración
8 puntos en 5 volúmenes observados: RMS interno 2.55 m; máximo 4.14 m.
No es exactitud absoluta: algunas huellas y controles proceden de la misma imagen. Sin GNSS; incertidumbre visual orientativa 5–15 m.
Ver calibracion/puntos.json y FUENTES.md. node calibracion/recalcular.mjs comprueba el ajuste; --write actualiza georreferencia tras corregir puntos.
Conservar tamaño, encuadre y orientación del PNG o recalibrar deliberadamente.

## Mejorar y entregar
Corregir fuentes/datos, ejecutar node build.mjs, recargar y Guardar cambios. El JSON guardado tiene prioridad: no perder las correcciones del alumnado al cambiar la base.
Copiar esta carpeta completa al repositorio del equipo. campus/ sigue siendo Azcapotzalco y las apps aún copian solo esa ruta; aquí no se modificó su integración.
Datos derivados de © OpenStreetMap contributors, ODbL 1.0 (conservar atribución y licencia). Código según licencia del repositorio; bibliotecas según vendor.


## Copyright integrado y bandera

La marca «copyright @gabrielhuav» ahora pertenece a la maqueta: tres franjas grandes semitransparentes sobre el campus, exportadas dentro del GLB como grupo `Marca_copyright_modelo`. Se mantiene también el rótulo de esquina. Esta revisión sustituye las notas anteriores que excluían la marca del GLB.

En Capas, «Copyright en la maqueta» activa o quita todas las marcas. Pulsa Guardar cambios para actualizar JSON, GLB y PNG. La bandera persistente es `showCopyright`: `true` muestra la marca; `false` la retira, también de las imágenes y del GLB exportado. Si falta la propiedad en datos antiguos, se activa por defecto. Cambiar solo el JSON no modifica un GLB ya exportado: vuelve a abrir el visor y guarda. Deshacer/rehacer también conserva esta opción.

Para Claude: las apps pueden usar el GLB con el grupo integrado o regenerarlo con la bandera desactivada. Ocultar el grupo en un visor GLB requiere controlar el nodo `Marca_copyright_modelo`; este trabajo no modifica las apps. Huellas, niveles y georreferencia conservados; encuadre/tamaño de PNG sin cambios.

## Marca de agua repetida · cinco unidades

El checkpoint del 18 octubre 2026 combina tres bandas grandes con repeticiones distribuidas por la maqueta, en el color oficial de esta unidad y con opacidad 0,84. Se conserva la casilla `showCopyright`; Guardar cambios actualiza GLB, PNG y JSON. Configuración en `copyrightStyle`; distribución en `copyright-layout.js`. Detalles, colores, pruebas e instrucciones para móvil en `../COPYRIGHT_CAMPUS.md`. No cambia la georreferencia, escala ni encuadre del plano.

## Gráficos del visor

El visor suma cielo con degradado, niebla, sol más bajo con sombras de 4096 px y texturas CC0 de ambientCG (pasto, concreto, asfalto) proyectadas en coordenadas del mundo dentro del shader (`detail()` y `addDetail()` en app.js). No son `material.map`: el GLB y la app móvil conservan colores planos y el mismo peso (≈0.65 MB). Si las imágenes de `texturas/` no cargan (por ejemplo, el visor autónomo abierto como archivo), se ve el color liso. El cielo no entra al GLB ni al plano 2D.

Segunda tanda de texturas: la proyección es triplanar (sirve en suelos y paredes). Muro de contención (Concrete035), estacionamiento (Asfalto033), plazas de ladrillo (Bricks060) y paneles de terracota del edificio (concreto suave). Todas CC0 de ambientCG; ver `texturas/LICENCIA.txt`.

## Realismo del visor (cielo físico, efectos, vegetación y vida)

Todo esto sólo cambia la vista: el GLB y el plano 2D no dependen de la hora ni de los efectos (el GLB sólo suma los árboles de varias capas, autos y personas; el bosque lejano, el cielo y los efectos no se exportan).
- **Cielo físico y hora del día** (`efectos.js`, `efectos-solar.js`, `vendor/Sky.js`): sol calculado para Cuajimalpa el 22 de octubre; el control «Hora del día» (5:00–19:30) mueve sol, luces, niebla y exposición, y «Nublado» apaga el sol directo.
- **Efectos** («Efectos (AO y brillo)», apagados por omisión): oclusión ambiental GTAO, brillo y suavizado SMAA (add-ons de three r160 en `vendor/`). Si la GPU no los soporta, el visor sigue con el render directo.
- **Vegetación y vida** (`vegetacion.js`): árboles de seis especies (fresno, jacaranda, pino, cedro, arbusto, palmera), autos y personas colocados donde las fotos los muestran, y relieve en pasto, muro y asfalto con mapas de normales (`texturas/*_n.jpg`).
