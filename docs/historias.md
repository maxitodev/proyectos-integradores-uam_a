# Historias de usuario: app de salones

Cada una va como issue en el tablero. Los números (5 s, 20°, 8 m) son propuestos y se ajustan en la prueba de campo.

## HU-01 · Buscar mi salón

**Como** alumno de nuevo ingreso, **quiero** escribir mi salón como viene en mi horario **para** saber en qué edificio y piso queda.

**Criterio:** **Dado** que mi salón existe en el catálogo, **cuando** lo escribo (con o sin guion, en mayúsculas o minúsculas) y toco «Buscar», **entonces** la app muestra su edificio y su piso.

**Si no existe:** la app dice que no lo encontró en el catálogo y no muestra ruta.

## HU-02 · Ruta más corta

**Como** alumno de nuevo ingreso, **quiero** que la app calcule la ruta más corta hasta mi salón **para** no llegar tarde.

**Criterio:** **Dado** que hay dos caminos entre mi punto de partida y mi salón, uno de 120 m y otro de 80 m, **cuando** pido la ruta, **entonces** la app muestra el de 80 m, con su distancia y los lugares por los que paso, en orden.

**Si no hay camino:** la app dice que no hay ruta y no muestra flechas.

## HU-03 · Saber dónde estoy

**Como** alumno de nuevo ingreso, **quiero** que la app reconozca dónde estoy con la cámara **para** no tener que explicarle mi ubicación.

**Criterio:** **Dado** que apunto la cámara a un lugar del catálogo, **cuando** toco «¿Dónde estoy?», **entonces** en menos de 5 segundos la app muestra el nombre del lugar como mi punto de partida.

**Si no lo reconoce:** la app avisa y me deja elegir el punto de partida de una lista.

## HU-04 · Seguir flechas

**Como** alumno de nuevo ingreso, **quiero** ver flechas sobre la cámara **para** llegar sin tener que preguntar.

**Criterio:** **Dado** que tengo una ruta y la cámara está activa, **cuando** giro el celular, **entonces** la flecha sigue apuntando al siguiente punto con menos de 20° de diferencia y la app no se cierra en 2 minutos de uso.

**Si se pierde el seguimiento:** la app oculta la flecha y pide mover el celular despacio.

## HU-05 · Aviso de llegada

**Como** alumno de nuevo ingreso, **quiero** que la app me avise cuando llegué **para** saber que ya puedo entrar a clase.

**Criterio:** **Dado** que sigo una ruta, **cuando** estoy a menos de 8 m del último punto, **entonces** la app muestra «Llegaste» y deja de mostrar flechas.
