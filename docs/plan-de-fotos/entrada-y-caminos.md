# Plan de fotos · Entrada (portería) y caminos de acceso

Responsable: Bryan Tonatiuh Ochoa De La Cruz · Unidad Cuajimalpa · Práctica 3 · Mi parte del campus

Las fotos sirven para confirmar en campo la portería, los dos caminos vehiculares (poniente y oriente) y el andador que lleva de Av. Vasco de Quiroga a la sede principal (Torre III), y más adelante para entrenar el reconocimiento del lugar con la cámara. **Las fotos no se suben al repositorio**; se guardan en una carpeta compartida del equipo.

## Puntos de toma

![Puntos de toma sobre el plano del campus](entrada-y-caminos_puntos.png)

El círculo marca dónde se para quien toma la foto y la flecha, hacia dónde mira la toma de frente. El croquis es aproximado: en campo manda lo que se ve.

| Punto | Nombre en archivo | Dónde |
| --- | --- | --- |
| 1 | `porteria` | Arranque del camino de entrada, desde la banqueta de Av. Vasco de Quiroga, mirando hacia la portería |
| 2 | `torniquetes` | Lado interior de la portería, junto a los torniquetes |
| 3 | `camino-poniente` | Camino vehicular poniente, junto al muro, donde empieza la cubierta del andador |
| 4 | `camino-oriente` | Camino vehicular oriente, frente a las canchas |
| 5 | `quiebre-sede` | Donde termina la cubierta y el andador gira hacia la sede |
| 6 | `llegada-sede` | Llegada al acceso de la sede principal (Torre III) |

## Qué se fotografía en cada punto

Cinco fotos por punto:

| Toma | Nombre en archivo | Cómo |
| --- | --- | --- |
| Frente | `frente` | Hacia donde apunta la flecha del mapa |
| Izquierda | `izq` | Girando hacia la izquierda, para que entre la esquina o el costado |
| Derecha | `der` | Girando hacia la derecha |
| De lejos | `lejos` | De frente, unos pasos más atrás, para que se vea el contexto |
| Desde abajo | `abajo` | De frente, con el teléfono bajo e inclinado hacia arriba |

## Cuántas y cuándo

| Visita | Cuándo | Fotos |
| --- | --- | --- |
| 1 | Primera visita a la unidad a partir del lunes 26 de octubre de 2026 | 6 puntos × 5 tomas = 30 |
| 2 | Otra visita, en un día distinto, a más tardar el viernes 6 de noviembre de 2026 | 6 puntos × 5 tomas = 30 |
| | **Total** | **60** |

La hora, el clima y si hay gente o no quedan como toquen ese día; se usa el teléfono que se traiga.

## Por qué no se separan teléfono, hora, clima ni gente

El enunciado sugiere variar teléfono, hora, clima y gente. En este plan no se programan sesiones para cada condición, por estas razones:

- **La herramienta de reconocimiento todavía no se elige** (la práctica dice que se decidirá después). No sabemos cuántas fotos ni qué variaciones va a necesitar; cuando se elija, se agregan solo las que pida.
- **La variación de luz, color y encuadre se puede generar después** con aumento de datos (brillo, contraste, recorte y giro) a partir de las mismas fotos, sin volver al campus.
- **Dos visitas en días distintos ya dan variación natural** de luz, clima y gente sin fijar horarios.
- **Un segundo teléfono aporta poco en un prototipo**: las diferencias de color entre cámaras se pueden igualar al preparar las fotos.
- **La lluvia y la noche no se pueden programar**: esperar lluvia puede retrasar todo el plan, y de noche la entrada sobre la avenida es menos segura.
- **No se buscan fotos con gente**: si aparece alguien, se cuida que no se le reconozca el rostro.

Si la herramienta que se elija pide más variedad, se agrega una visita al plan.

## Nombres de archivo

```
<punto>_<toma>_<nn>.jpg
```

Ejemplos: `porteria_frente_01.jpg`, `camino-oriente_lejos_01.jpg`, `llegada-sede_abajo_02.jpg`.

Sin acentos, eñes ni espacios. Cada visita va en su carpeta: `visita1_2026-10-26/`, `visita2_<fecha>/`.

## Riesgos y respuesta

| Riesgo | Respuesta |
| --- | --- |
| Vigilancia no permite fotografiar el acceso | Se muestra la credencial UAM y se explica que es para una práctica; si no se autoriza, los puntos 1 y 2 se toman desde la banqueta exterior |
| Aparece un rostro o una placa reconocible | Se repite la toma cuando pase; la foto con rostro se borra |
| La unidad está cerrada o no se puede ir ese día | La visita se mueve al siguiente día hábil antes del 6 de noviembre |
| Se pierden las fotos | Se suben a la carpeta compartida el mismo día |
| La portería, los caminos o el andador reales no coinciden con el croquis | Se anota la diferencia con la foto que la muestra y se abre un issue para corregir el croquis |

## Uso de IA

Se usó Claude (Anthropic) para redactar un borrador de este plan y generar el mapa de puntos a partir del plano del croquis. Bryan revisó y ajustó los puntos, las tomas, las fechas y los riesgos.
