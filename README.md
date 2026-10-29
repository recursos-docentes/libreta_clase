# Libreta de Clase

Página web para llevar la libreta del docente por día de clase: asistencia, actividades y notas de cada estudiante, con un resumen del grupo y descarga a Excel.

Es un solo archivo (`index.html`), sin servidor ni instalación.

## Qué hace

- **Varios grupos**, cada uno con su lista de estudiantes y sus columnas.
- **Clase del día:** elegís la fecha, creás la clase y marcás cada celda:
  - Presente: `P` presente · `A` ausente · `T` tarde · `J` falta justificada
  - Actividad: `✓` hecho · `½` parcial · `✗` no hecho
  - Nota: de 1 a 10 (verde si es 5 o más, ámbar si es de 1 a 4)
  - Conducta: `MB` muy buena · `B` buena · `R` regular · `M` mala
  - Observación: texto libre
- **Resumen del grupo:** % de asistencia (en rojo si es menos de 75 %), faltas, entregas, promedio, situación (**Aprobado** con 5 o más, **APE** de 1 a 4) y conducta (cantidad de MB/B/R/M y la última registrada).
- **Excel:** descarga una planilla con tres hojas (Planilla, Resumen, Detalle).
- **Estudiantes:** se agregan de a uno, pegando una lista o importando la plantilla de Excel (lee la fila con `fecha | presente | actividad | nota | nombres…`).
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
3. Cambiá `CAMBIAR-ESTA-CLAVE` por una clave tuya y guardá (💾).
4. **Implementar → Nueva implementación**, tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Autorizá los permisos (Google avisa que la app no está verificada: **Configuración avanzada → Ir a…**, porque el script es tuyo).
6. Copiá la URL que termina en `/exec`.
7. En la libreta: **Estudiantes y columnas → Google Sheets**, pegá la URL y la clave, y tocá **Conectar**.
8. Si ya tenías datos en el navegador, tocá **Copiar a Sheets lo guardado en este navegador**.

La planilla queda así:

- **`_datos`**: un registro por grupo y por clase. Es lo que lee la libreta; no lo edites a mano.
- **Una hoja por grupo** con la libreta armada (fecha, tema, dato y una columna por estudiante, con colores). Se rehace sola en cada cambio, así que lo que escribas a mano ahí se pierde.

Notas:

- La URL y la clave quedan guardadas en ese navegador. En otro equipo, conectala una vez más con los mismos datos.
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
