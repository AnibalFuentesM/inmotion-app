# Auditoría Técnica y UX: Catálogo de Videos In Motion Dance Academy

Fecha: 17 de septiembre de 2026  
Superficie auditada: Raíz del sitio (`/`, `index.html`, `assets/`)  
Objetivo: Evaluar el catálogo actual y proponer cómo transformarlo en una biblioteca útil para la práctica de los alumnos, respetando la arquitectura estática y sin inventar datos.

---

## 1. Contexto y Verificación de Entorno

- **Servidor activo**: `http://localhost:5500/` verificado mediante `lsof -nP -iTCP:5500 -sTCP:LISTEN` y `lsof -a -p 20756 -d cwd`, confirmando que el proceso Python sirve directamente desde `~/Documents/Inmotion`.
- **Arquitectura**: Sitio estático cliente (`index.html` + Tailwind CSS CDN + JS nativo con módulos ES) que consume metadatos desde Google Sheets vía endpoint GViz (`APP_CONFIG.gvizUrl`) y embebe un panel de staff mediante Apps Script.
- **Datos reales observados**: La Google Sheet configurada (`1F5vMhZXHYvsc179HOdRWyml1lqeN-uxiSQv_AwZVqvg`, gid=0) contiene actualmente 10 filas de registros de video.
- **Consola del navegador**: 0 errores de ejecución JavaScript; se reporta únicamente la advertencia estándar del CDN de desarrollo de Tailwind CSS.

---

## 2. Diagnóstico de los Cinco Ejes de la Experiencia

### 2.1. Acceso a los videos: Altura del hero y ubicación del panel de staff
- **Hero sobredimensionado**: El `<header>` ocupa `70vh` (mínimo 480px). En resolución móvil (375×812px), el usuario se enfrenta a una pantalla inicial con título y fondo decorativo sin ver una sola miniatura.
- **Panel interno en el flujo de práctica**: La sección `<details id="staffToolsSection">` ("Panel interno · Gestión del Catálogo") está posicionada inmediatamente después del formulario de filtros y antes de las tarjetas de video (`index.html:132`).
- **Impacto**: Un alumno en móvil debe desplazarse más de 800px hacia abajo antes de ver el primer video. Si además se despliega el panel de staff, se carga un `iframe` de 1050px de altura (`h-[1050px]`), desplazando la videoteca más de 1.100px adicionales.

### 2.2. Calidad de títulos, niveles, estilos y etiquetas
La inspección de los 10 registros servidos por GViz reveló inconsistencias severas generadas en la carga:
- **Títulos crudos de cámara**: Fila 9 (`step_name="WhatsApp Video 2026-05-05 at 20.00.35"`), Fila 10 (`step_name="WhatsApp Video 2026-05-04 at 10.44.29"`), Fila 6 (`step_name="240226"`), Fila 7 (`step_name="Carrousel2"`).
- **Nivel no técnico**: Fila 8 contiene `level="Domingo"` (un día de la semana ingresado en el campo de nivel técnico de baile). Esto ensucia el desplegable de niveles con la opción "Domingo".
- **Identificadores duplicados**: El ID `2026-01-29-extra` está asignado tanto a "Caminala" como a "La Vela". El ID `2026-01-29-carrousel` está asignado a "Carrousel" y a "Carrousel2".
- **Etiquetas heterogéneas**: Varias filas contienen nombres de parejas/profesores (`Majo/Rudy`, `Jose/Adriana`, `ElOzu/Geral`), otras el genérico `Varios`, y las filas 9 y 10 tienen etiquetas completamente vacías.

### 2.3. Búsqueda, filtros, orden y recuperación ante resultados vacíos
- **Búsqueda sensible a diacríticos**: `filters.js:41` utiliza `searchBlob(record).includes(searchText)` sin normalizar tildes.
  - *Evidencia empírica en navegador*: La búsqueda `"camínala"` devolvió **0 resultados** (mostrando el estado vacío), mientras que `"caminala"` devolvió **1 resultado**. En un entorno de habla hispana, los usuarios escriben indistintamente con o sin tilde.
- **Ordenamiento unidireccional rígido**: `video-model.js:161` ordena de forma fija por fecha descendente. No existe control para ordenar alfabéticamente (A-Z) ni de más antiguo a más reciente.
- **Filtros mudos**: Los selectores `<select>` de Estilo y Nivel no indican la cantidad de videos disponibles por categoría (ej: "Salsa On1" vs "Salsa On1 (7)").

### 2.4. Reproductor: Apertura, cierre, teclado, foco y uso móvil
- **Google Drive Preview en iframe**: Los videos alojados en Google Drive se reproducen mediante `https://drive.google.com/file/d/${fileId}/preview` (`ui-modal.js:42`).
  - En móvil, los controles del reproductor nativo de Drive son pequeños y difíciles de manipular con el pulgar.
  - El visor de Drive muestra botones de "Abrir en Drive" y descarga que desvían al alumno fuera de la sesión de práctica.
- **Deficiencias de accesibilidad y foco**:
  - `ui-modal.js:221` únicamente escucha la tecla `Escape`. No existe trampa de foco (`focus trap`): presionar `Tab` dentro del modal escapa hacia los enlaces y botones de la página de fondo.
  - No existen atajos de teclado para pausar o retroceder (cruciales para alumnos que practican frente al espejo).

### 2.5. Colecciones, favoritos y videos abiertos recientemente
- **Catálogo plano**: El catálogo carece de agrupación temática. No se diferencian los recaps de la semana en curso de videos de hace meses.
- **Ausencia de marcadores personales**: Un alumno que asiste a una clase intermedia no puede marcar sus pasos para repasar antes de la siguiente clase.
- **Diferenciación técnica indispensable**:
  - Es factible registrar en `localStorage` qué videos fueron **abiertos recientemente** (al hacer click en la tarjeta o abrir el modal).
  - **No es posible medir el progreso de reproducción ni marcar un video como "visto"** con los videos alojados en Google Drive: el `iframe` de Drive Preview se ejecuta bajo un origen cruzado restringido por la política de Same-Origin de Google, impidiendo que JavaScript en `index.html` escuche eventos `play`, `timeupdate`, o `ended`.

---

## 3. Las Cinco Mejoras de Mayor Impacto (Ordenadas)

### Mejora 1: Reorganización de Jerarquía Visual y Reubicación del Panel de Staff
- **Problema**: El hero masivo y la presencia del panel de Apps Script en medio del catálogo retrasan el acceso a los videos (>800px de scroll en móvil) y exponen herramientas internas a los alumnos.
- **Evidencia**: `index.html:66` define un hero de `70vh` (mínimo 480px) y `index.html:132-171` inserta el acordeón del staff con un iframe de 1050px entre los filtros y las tarjetas.
- **Solución propuesta**:
  1. Reducir el hero a una barra de cabecera compacta (máximo 160px en móvil, 220px en desktop) con el buscador integrado.
  2. Mover el acceso a Apps Script a un enlace discreto en la barra superior o en el pie de página ("Acceso Staff"), abriéndolo en un modal independiente o ruta dedicada.
- **Archivos afectados**: `index.html`, `assets/js/admin-panel.js`, `assets/css/app.css`.
- **Criterio de aceptación**: En resolución 375×812px, las primeras dos tarjetas de video son visibles en pantalla al terminar la carga sin necesidad de scroll. El panel interno de staff no interfiere con el flujo de videos del alumno.
- **Dependencias**: Ninguna (100% arquitectura estática actual).

### Mejora 2: Búsqueda con Normalización Diacrítica y Selector de Ordenamiento
- **Problema**: La búsqueda estricta falla cuando el alumno escribe con tildes o variaciones ortográficas, y no existe forma de ordenar los resultados.
- **Evidencia**: Comprobado en navegador: `"camínala"` arroja 0 resultados; `"caminala"` arroja 1 resultado. `filters.js:41` realiza comparación directa con `includes()`.
- **Solución propuesta**:
  1. Normalizar diacríticos en `filters.js` usando `String.prototype.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` tanto en el término de búsqueda como en los campos del video.
  2. Agregar un selector de orden (`#sortOrder`): "Más recientes", "Más antiguos", "Nombre (A-Z)".
- **Archivos afectados**: `assets/js/filters.js`, `assets/js/app.js`, `index.html`.
- **Criterio de aceptación**: Escribir `"camínala"` o `"caminala"` produce exactamente el mismo resultado. Cambiar el selector de orden reordena la grilla de videos de forma instantánea.
- **Dependencias**: Ninguna (100% arquitectura estática actual).

### Mejora 3: Saneamiento y Normalización Client-Side de Metadatos
- **Problema**: Videos con títulos de archivo crudos (`WhatsApp Video...`, `240226`) y valores no técnicos como "Domingo" en la columna de nivel deterioran la legibilidad y los filtros.
- **Evidencia**: Filas 6, 8, 9 y 10 del endpoint GViz. La etiqueta de nivel muestra "Domingo" en la tarjeta y en el filtro desplegable.
- **Solución propuesta**:
  - En `assets/js/video-model.js`, añadir una capa de normalización:
    1. Si `step_name` contiene patrones de archivo (ej. `WhatsApp Video...` o solo dígitos), transformar a un formato legible estructurado: `Recap [Estilo] · [Fecha formateada]`.
    2. Si `level` no coincide con la taxonomía técnica conocida (`Básico`, `Intermedio`, `Avanzado`, `Lvl1`-`Lvl5`), reclasificarlo automáticamente como `Taller / Especial` para no contaminar los filtros.
- **Archivos afectados**: `assets/js/video-model.js`, `assets/js/filters.js`.
- **Criterio de aceptación**: Ninguna tarjeta del catálogo muestra la palabra "WhatsApp" en su título ni "Domingo" en su etiqueta de nivel.
- **Dependencias**: Ninguna en código (se procesa en memoria del cliente). Se recomienda actualizar los valores en la Google Sheet en la próxima sesión de carga.

### Mejora 4: Accesibilidad, Foco y Atajos de Teclado en el Reproductor
- **Problema**: Al abrir el modal de video, el foco del teclado no queda contenido (se escapa con Tab a la página de fondo), y no hay controles de velocidad ni atajos para práctica física.
- **Evidencia**: `assets/js/ui-modal.js:212-226` no implementa focus trap ni atajos adicionales a Escape.
- **Solución propuesta**:
  1. Implementar trampa de foco (`focus trap`) que confine la tecla `Tab` dentro del modal mientras esté abierto y devuelva el foco a la tarjeta correspondiente al cerrar.
  2. Para videos directos (`<video>`), habilitar botón de velocidad reducida (`0.75x`) esencial para descomponer movimientos rápidos.
  3. Asegurar que el botón "Cerrar" permanezca fijo en la esquina superior derecha en dispositivos móviles.
- **Archivos afectados**: `assets/js/ui-modal.js`, `assets/css/app.css`.
- **Criterio de aceptación**: Navegando con teclado, es imposible que el foco salga del modal mientras esté abierto. Presionar Escape devuelve el foco exacto a la tarjeta disparadora.
- **Dependencias**: Ninguna (100% arquitectura estática actual).

### Mejora 5: Colecciones Locales: "Favoritos" y "Abiertos Recientemente"
- **Problema**: Los alumnos no pueden guardar pasos clave para repasar antes de clase ni retomar rápidamente los videos que consultaron en su última sesión.
- **Evidencia**: El catálogo actual no persiste ninguna interacción del usuario.
- **Solución propuesta**:
  1. Incorporar un botón de estrella/marcador en cada tarjeta y dentro del modal.
  2. Persistir los IDs seleccionados en `localStorage` bajo `inmotion-catalog-favorites-v1`.
  3. Registrar los últimos 5 videos cuyo modal fue abierto en `inmotion-catalog-recent-v1`.
  4. Agregar filtros rápidos en la barra superior: "Todos", "Mis Favoritos (★)", "Abiertos recientemente".
  - *Distinción técnica*: Se registra estrictamente el evento de **apertura de modal**. No se simula ni asume medición de progreso de reproducción para los iframes de Google Drive.
- **Archivos afectados**: `assets/js/app.js`, `assets/js/ui-cards.js`, `assets/js/ui-modal.js`, `assets/js/filters.js`, `index.html`.
- **Criterio de aceptación**: Marcar un video con estrella persiste tras recargar la página. Al seleccionar la pestaña "Mis Favoritos", se filtran únicamente los videos guardados.
- **Dependencias**: `localStorage` del navegador. Si en el futuro se requiriera sincronización entre el teléfono y la computadora del alumno, se necesitaría backend con identidad de usuario.

---

## 4. Propuesta de Primera Entrega Pequeña (Fase 1)

Para generar impacto inmediato sin riesgos ni cambios estructurales en los datos, se propone un primer paquete acotado:

1. **Jerarquía inmediata**: Reducir el hero a un formato compacto (banner de 160px en mobile) y mover el botón de staff al pie de página.
2. **Búsqueda tolerante a tildes**: Implementar `normalize("NFD")` en `filters.js` para resolver búsquedas como "camínala" vs "caminala".
3. **Saneamiento visual de títulos**: Limpieza en `video-model.js` para que los videos de WhatsApp y números de fecha se lean como "Recap [Estilo] · [Fecha]".
4. **Accesibilidad en modal**: Trampa de foco (`focus trap`) y botón de cierre sticky en mobile.

---

## 5. Separación Arquitectónica: Estático vs. Backend

| Característica | Factible con Arquitectura Actual (Estática + Local) | Requiere Backend / Identidad |
|---|---|---|
| Reducción de hero y reubicación de staff | ✅ Sí (HTML/CSS plano) | ❌ No |
| Búsqueda insensible a tildes y ordenamiento | ✅ Sí (JS nativo en cliente) | ❌ No |
| Saneamiento al vuelo de títulos y niveles | ✅ Sí (Regex en `video-model.js`) | ❌ No |
| Favoritos y videos abiertos recientemente | ✅ Sí (Vía `localStorage` por dispositivo) | ❌ No |
| Velocidad 0.75x para práctica | ✅ Sí (En fuentes `<video>` compatibles) | ❌ No |
| Sincronización de favoritos entre dispositivos | ❌ No | ✅ Requiere cuenta de usuario y base de datos |
| Medición de progreso de reproducción en Drive | ❌ No (Restricción técnica de Google Drive iframe) | ✅ Requiere hosting de video propio (ej. Cloudflare Stream / Mux / S3) |
| Panel de subida protegido con permisos de maestro | ❌ No (Iframe de Apps Script público en frontend) | ✅ Requiere autenticación Google OAuth o sesión staff |

---

## 6. Reporte de Verificación

### Lo que fue comprobado en el navegador
- Servidor Python 3 confirmado en puerto 5500 sirviendo desde `/Users/anibal/Documents/Inmotion`.
- Carga y parsing del endpoint GViz oficial de Google Sheets (10 filas validadas).
- Comportamiento y layout en viewports de escritorio (1440×900px) y móvil (375×812px).
- Fallo de búsqueda diacrítica comprobado en tiempo real ("camínala" = 0 resultados, "caminala" = 1 resultado).
- Renderizado real de títulos no formateados ("WhatsApp Video 2026-05-05 at 20.00.35") y nivel "Domingo".
- Despliegue del panel de staff en iframe de 1050px en medio de la pantalla.
- Modal de video con iframe de Drive Preview y comportamiento de cierre.
- Consola del navegador auditada (0 errores de JS).

### Lo que quedó sin comprobar / fuera de alcance
- Flujo completo de subida de archivo y escritura en el Google Sheet a través del formulario de Apps Script (requiere credenciales activas de Google Drive).
- Eventos de reproducción dentro del iframe de Google Drive (imposible de interceptar debido al sandbox cross-origin de Google).
- Comportamiento en navegadores legacy que no soporten módulos ES nativos o `Intl.DateTimeFormat`.
