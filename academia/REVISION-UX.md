# Revisión de producto y experiencia · 17 de septiembre de 2026

Se revisaron el catálogo público y la academia en el servidor local de este repositorio. Los cambios de esta revisión se limitan a `academia/`, como establece AGENTS.md. El catálogo de producción fue revisado, sin modificar sus archivos ni los datos de Sheets.

## Implementado

- Unificación de clases a un único "Salón" físico en los datos (`classData`).
- Limpieza de CSS residual sin uso del carnet 3D animado (`.member-card-3d-scene`, flipper, etc.), conservando el carnet estático accesible con QR.
- Retiro de "Simular lectura en puerta" en el portal del alumno, reafirmando que el alumno porta su credencial pero es el personal (maestros y recepción) quien valida la entrada.
- Desacoplamiento de la credencial permanente del alumno frente al estado de cobro de mensualidades.
- Comparador de los tres planes ficticios existentes: 4 clases / Q300, 8 clases / Q450 e ilimitado / Q625.
- Sugerencia según frecuencia semanal, explicación de la regla de cuatro semanas y detalle de cada opción. No cambia membresías ni registra cobros.
- Acceso al comparador desde la bienvenida, la navegación de alumnos y tutores, y el inicio del alumno.
- Accesos claros a planes y al catálogo de práctica desde el inicio del alumno.
- Progreso visual de asistencia, filtro de nivel intermedio, estados seleccionados accesibles y estado vacío de clases con recuperación.
- Preservación de valores originales de planes no tipificados o desconocidos en la vista administrativa para revisión humana sin coerciones automáticas.
- Indicador accesible de página actual, foco visible y espacio inferior para dispositivos con área segura.
- Corrección de la sombra del menú móvil: antes, el panel cerrado oscurecía el borde izquierdo del contenido.

## Definiciones de negocio y arquitectura operativa

### 1. Un solo salón físico y revisión de horarios
La academia física dispone de un único salón de baile ("Salón"). Todas las clases se imparten en este espacio.
- **Revisión de solapamientos en `classData`:**
  - *Miércoles:* Bachata Intermedio (18:00) y Salsa Básica (19:15). Margen de 75 minutos entre inicios: si Bachata dura 60 min hay 15 min de margen; si dura 75 min, hay empalme directo.
  - *Jueves:* K-Pop Teens (17:00) y Baile Latino (19:00). Margen de 120 minutos, sin conflicto ordinario.
  - *Sábado:* Baile Latino Kids (10:00) y Salsa On2 (11:30). Margen de 90 minutos entre inicios.
- **Discrepancia entre `classData` (agenda demo) y `SCHEDULE_CLASSES` (referencia de selector de planes):**
  - En un único salón no pueden coexistir ambas grillas:
    - Miércoles: `SCHEDULE_CLASSES` contempla Latin Dance (18:00–19:00), Nivel 1 (19:00–20:00) y Nivel 2 (20:00–21:00), mientras que `classData` tiene Bachata (18:00) y Salsa (19:15).
    - Jueves: `SCHEDULE_CLASSES` programa Nivel 4 (19:00–20:00), mientras que `classData` programa Baile Latino a las 19:00.
    - Sábado: `SCHEDULE_CLASSES` contempla K-Pop Teens (10:00–11:00) y Latino Teens (11:00–12:00), mientras que `classData` tiene Baile Latino Kids (10:00) y Salsa On2 (11:30).
  - *Criterio:* No se inventan horarios artificiales ni se descartan clases; se deja constancia documentada para que In Motion defina el cronograma maestro definitivo.

### 2. Carnet permanente y mensualidad separada
- La credencial del alumno es estática y permanente (número de carnet y código QR fijo). No caduca al término del mes ni se desactiva si hay mensualidades pendientes.
- La cobranza y la identificación son procesos desacoplados: el carnet identifica al alumno de forma confiable (incluso impreso o desde el portal del tutor para niños), mientras que el estado de cobro se gestiona en administración.
- El alumno no registra su propia asistencia (se retiró la simulación de lectura en puerta del portal del alumno); la asistencia es tomada en puerta o en clase por el personal de la academia.

### 3. Comparador de consulta, sin cambio de membresía
- El comparador de planes y horarios es una herramienta de consulta y cálculo orientativo para alumnos y tutores. No altera la membresía guardada en `localStorage`, no simula cobros ni muta las inscripciones existentes.

### 4. Tarifas de referencia pendientes de confirmación
- Los planes observados en material audiovisual (`Dancer Pass Q395`, `Night Pass Q595`, `Weekend Pass Q300`, `Teens In Motion Q495`, `Full In Motion Q750`, `Registration Q150`, `Membership Q125`) constituyen referencias de demostración externa y no tarifas comerciales formalmente confirmadas. El prototipo mantiene los tres planes demo (4 clases / Q300, 8 clases / Q450, ilimitado / Q625) hasta acordar el catálogo arancelario oficial.

### 5. Preservación de planes desconocidos para revisión administrativa
- Cuando un alumno registrado posee un plan fuera del catálogo tipificado o una asignación especial, la plataforma mantiene intacto el valor original en memoria y en las vistas de administración, sin forzar conversiones a valores por defecto, facilitando la auditoría humana.

## Material encontrado

- `/Users/anibal/Downloads/Videos/Selector de planes.mp4`: demostración de un selector de planes de In Motion. En el fotograma de 00:05 se ven Dancer Pass Q395, Night Pass Q595, Weekend Pass Q300, Teens In Motion Q495 y Full In Motion Q750, además de Registration Q150 y Membership Q125. Son referencias del video, no tarifas verificadas ni incorporadas como ofertas vigentes.
- `/Users/anibal/Desktop/Projects/GravityClaw/memory/markdown/InMotion_PRD.md`: requisitos originales sobre asistencia, pagos, estadísticas y promociones.
- `/Users/anibal/Desktop/Projects/Cotizaciones/quote-inmotion.json`: propuesta por fases con autenticación, inscripciones, pagos, QR, reportes y notificaciones. Describe alcance propuesto, no funcionalidades entregadas.

## Mejoras prioritarias

| Prioridad | Hallazgo | Mejora propuesta | Resultado buscado |
| --- | --- | --- | --- |
| Alta | El catálogo muestra nombres como “WhatsApp Video 2026-05-05 at 20.00.35”; “Domingo” aparece en Nivel. | Normalizar títulos y separar nivel, día, estilo e instructor en los datos. | Encontrar una lección sin conocer el archivo original. |
| Alta | El hero y el panel interno preceden a las lecciones. | Reducir el hero y trasladar la gestión fuera del recorrido principal del alumno. | Llegar antes al contenido útil. |
| Alta | El catálogo permite buscar, pero no ofrece un recorrido de aprendizaje. | Añadir orden por fecha, colecciones por nivel, favoritos y “seguir practicando”. | Convertir un archivo de videos en una biblioteca de práctica. |
| Alta | El modelo de planes del video difiere del modelo ficticio de clases mensuales. | Confirmar catálogo actual, inclusiones, inscripción, cargos, restricciones y relación entre planes y horarios. | Un selector confiable que explique tanto el costo mensual como el costo inicial. |
| Alta | La clase muestra cupos, pero no se puede reservar. | Definir reserva, cancelación, lista de espera y consumo de créditos; después implementar el flujo. | Conectar la elección de plan con una clase concreta. |
| Media | La bienvenida se centra en elegir un rol de demo. | Para el lanzamiento público, dar prioridad a explorar horarios, elegir plan y consultar una clase inicial. | Ayudar al nuevo cliente sin exigirle entender la administración. |
| Media | No hay seguimiento del aprendizaje en el catálogo. | Asociar recaps a clases y añadir progreso cuando exista identidad real de alumno. | Dar un motivo para volver entre clases. |

## Límites antes de usar datos reales

La academia guarda información localmente. El selector de roles no es autenticación; la credencial QR es una ilustración de demostración y no un QR operativo. Los pagos son registros simulados, no procesamiento de tarjetas. Antes de operar se necesitan identidad y permisos reales, almacenamiento compartido con respaldo, reservas consistentes y un flujo definido de pagos y asistencia. No se agregaron servicios ni dependencias en esta revisión.

El catálogo utiliza Tailwind desde CDN y el navegador muestra su advertencia de uso en producción. Conviene acordar una estrategia de CSS estático para resolverla respetando la restricción actual de no agregar un build.

## Validación

- Puerto 5500 confirmado con `lsof`: sirve `/Users/anibal/Documents/Inmotion`.
- Sintaxis de JavaScript validada con `node --check`.
- Tres recomendaciones y tres diálogos probados; cierre con Escape y navegación a clases.
- Comparar planes no altera el estado persistido de la membresía.
- Filtros: intermedio devuelve una clase y “Todas” devuelve seis en los datos demo.
- Inicio de los cuatro roles y comparador probados a 375px sin desbordamiento horizontal.
- Catálogo abierto en escritorio y móvil; búsqueda sin resultados y recuperación de sus diez videos mediante limpiar filtros.
- Sin errores de consola en ambas superficies durante estas comprobaciones. La advertencia de Tailwind del catálogo permanece.
