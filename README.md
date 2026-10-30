# Libreta de Clase

Página web para llevar la libreta del docente por día de clase: asistencia, actividades y notas de cada estudiante, con un resumen del grupo y descarga a Excel.

Es un solo archivo (`index.html`), sin servidor ni instalación.

## Qué hace

- **Varios grupos**, cada uno con su lista de estudiantes y sus columnas.
- **Clase del día:** elegís la fecha, creás la clase y marcás cada celda:
  - Presente: `P` presente · `A` ausente · `T` tarde · `J` falta justificada (`A2` / `J2`: faltó 2 horas de esa clase)
  - Actividad: `✓` hecho · `½` parcial · `✗` no hecho
  - Nota: de 1 a 10 (verde si es 5 o más, ámbar si es de 1 a 4)
  - Conducta: `MB` muy buena · `B` buena · `R` regular · `M` mala
  - Observación: texto libre
- **Tema con formato y dictado:** el tema de cada clase se escribe en un cuadro de varias líneas con negrita, cursiva, subrayado, listas y links. El botón 🎤 dicta por voz (Chrome y Edge; el audio lo procesa el servicio de voz del navegador). En Windows también funciona el dictado del sistema con **Windows + H**. En Google Sheets el tema va en una celda combinada a lo alto de la clase, con su formato y links.
- **Resumen del grupo:** % de asistencia (en rojo si es menos de 75 %), faltas, entregas, promedio, situación (**Aprobado** con 5 o más, **APE** de 1 a 4) y conducta (cantidad de MB/B/R/M y la última registrada).
- **Faltas por horas y fictas:** cada clase tiene su cantidad de horas (el grupo trae un valor por defecto, por ejemplo 2 o 3, y en cada día se puede cambiar). Un ausente en una clase de 3 horas cuenta 3 faltas. Si faltó solo una parte (se retiró antes o llegó a otra hora), al marcar `A` o `J` aparece un chip con las horas (`3h`): tocándolo baja a `2h`, `1h` y vuelve a `3h`; la celda queda como `A2` o `J2`. Fictas = `horas A + horas J/2 + tardes/2` (cada llegada tarde es media falta). Se ven al lado de cada nombre en la clase del día, en el resumen, en el Excel y en la hoja del grupo en Google Sheets. En *Estudiantes y columnas → Grupo* se configuran las horas por clase, y el porcentaje límite (por defecto 25 %), que se calcula sobre las horas dictadas (las clases registradas). Ámbar al llegar al 80 % del límite, rojo al pasarlo.
- **Excel:** descarga una planilla con tres hojas (Planilla, Resumen, Detalle).
- **Estudiantes:** se agregan de a uno, pegando una lista o importando la plantilla de Excel (lee la fila con `fecha | presente | actividad | nota | nombres…`).
- **Columnas de un solo día:** en la clase del día, abajo de la tabla, se agregan columnas solo para esa clase (botones rápidos **+ Escrito**, **+ Oral**, o una con el nombre y tipo que quieras: nota, entrega o texto). En el resumen se juntan por nombre: todos los "Escrito" dan un promedio de escritos, todos los "Oral" un promedio de orales, y además aparece un **promedio ponderado**. El peso de cada tipo de nota se configura en *Estudiantes y columnas → Ponderación de notas* (por ejemplo Escrito 60, Oral 40); sin configurar, todos pesan igual. Se quitan con la ✕ del encabezado.
- **Columnas configurables:** por ejemplo "Ejercicio 2" o "Tarea domiciliaria".

## Dónde se guardan los datos

Hay tres modos, y la página muestra arriba a la derecha cuál está usando:

| Modo | Cuándo | Dónde quedan los datos |
|---|---|---|
| **Google Sheets** | Fuera de claude.ai, con una planilla conectada | En tu planilla de Google. Se ven desde cualquier equipo. |
| **Navegador** | Fuera de claude.ai, sin planilla conectada | Solo en ese navegador (`localStorage`). Si borrás los datos del navegador, se pierden. |
| **Nube de claude.ai** | Abriendo la libreta como artifact en claude.ai | En claude.ai, automático. |

En cualquier modo podés usar **Estudiantes y columnas → Respaldo** para exportar un `.json` y restaurarlo después.

### Conectar Google Sheets (una sola vez)

1. Creá una planilla nueva en Google Sheets.
2. Abrí **Extensiones → Apps Script**, borrá lo que haya y pegá el contenido de [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs).
3. Guardá (💾). Después, en la planilla, recargá la página y usá el menú **Libreta → Configurar clave** para poner tu clave. Queda guardada aparte, así que al pegar una versión nueva del código no hay que volver a escribirla.
4. **Implementar → Nueva implementación**, tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Autorizá los permisos (Google avisa que la app no está verificada: **Configuración avanzada → Ir a…**, porque el script es tuyo).
6. Copiá la URL que termina en `/exec`.
7. En la libreta: **Estudiantes y columnas → Google Sheets**, pegá la URL y la clave, y tocá **Conectar**.
8. Si ya tenías datos en el navegador, tocá **Copiar a Sheets lo guardado en este navegador**.

La planilla queda así:

- **`_datos`**: un registro por grupo y por clase. Es lo que lee la libreta; no lo edites a mano.
- **Una hoja "Resumen" por grupo**: una fila por estudiante con % de asistencia, horas de falta, tardes, fictas, límite, promedio de cada tipo de nota, promedio ponderado y situación.
- **Una hoja por grupo** con la libreta armada (fecha, tema, dato y una columna por estudiante, con colores). Se rehace sola en cada cambio, así que lo que escribas a mano ahí se pierde.

Notas:

- La URL y la clave quedan guardadas en ese navegador. En otro equipo, conectala una vez más con los mismos datos.
- Para rehacer a mano las hojas de todos los grupos: en la planilla, menú **Libreta → Rehacer hojas de los grupos** (aparece al recargar la planilla).
- Si la libreta muestra un aviso amarillo de script desactualizado, pegá el `Codigo.gs` nuevo y creá una nueva versión de la implementación.
- Si cambiás el código del script: **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión**. Así la URL sigue siendo la misma.
- Cualquiera que tenga la URL **y** la clave puede leer y modificar los datos. No publiques la clave.

## Publicarla con GitHub Pages

1. Subí la carpeta a un repositorio.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En un par de minutos queda en `https://<tu-usuario>.github.io/<repositorio>/`.

## Configuración

Al principio del script de `index.html`:

```js
const NOTA_MAX = 10, APRUEBA = 5; // 5 o más aprueba; de 1 a 4 va al APE de diciembre
```

## Dependencias

Se cargan desde CDN, así que la página necesita internet la primera vez:

- [SheetJS (xlsx 0.18.5)](https://cdnjs.com/libraries/xlsx) para importar y exportar Excel.
- Google Fonts: Bricolage Grotesque, Atkinson Hyperlegible, IBM Plex Mono.

## Privacidad

Si el repositorio es público, el código queda a la vista de cualquiera, pero los datos de los estudiantes **no**. Viven en tu navegador, en tu planilla de Google o en tus archivos de respaldo. No subas los `.json` de respaldo ni los Excel exportados a un repositorio público.
