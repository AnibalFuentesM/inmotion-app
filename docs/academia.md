# App de la academia

Prototipo navegable de gestión para In Motion Dance Academy. Vive en `academia/`
y se sirve en `/academia/`.

## Qué incluye

- Acceso de demostración para alumno, maestro, administración y tutor.
- Alumno: inicio, calendario de clases, carnet QR.
- Maestro: agenda del día y control de asistencia.
- Administración: listado de alumnos, alta local, control de pagos y mora.
- Tutor: solo sus propios hijos — próxima clase, última asistencia, estado de
  mensualidad y carné — más la constancia de consentimiento de datos del menor.
  Es una vista de consulta: no paga, no marca asistencia ni justifica ausencias.
- Simulación del registro de asistencia por QR desde el dispositivo de recepción o maestro.
- Registro local de pagos hechos fuera de la plataforma.
- Navegación responsive: menú lateral en escritorio, barra inferior en móvil.

## Datos

Todo persiste en `localStorage` bajo la clave `inmotion-academy-demo-v1`.
Para reiniciar la demo, borrá esa clave desde las herramientas del navegador
o borrá los datos del sitio.

## Reglas de negocio y modelo operativo

- **Un solo salón físico:** La academia dispone de un único salón de baile ("Salón") para todas sus disciplinas y actividades. En los datos del prototipo se unificó la ubicación a `'Salón'`. Se identificaron posibles solapamientos de horario en la agenda demo y discrepancias frente al cronograma de referencia audiovisual (`SCHEDULE_CLASSES`); se documentan explícitamente sin inventar horarios artificiales, a la espera del calendario maestro oficial de In Motion.
- **Carné permanente y mensualidad desacoplada:** La credencial del alumno (código QR y número de carné) es estática y permanente. No caduca con el fin del ciclo de cobro ni queda inhabilitada si la mensualidad está pendiente. El cobro y la identificación operan por carriles separados: el carné permite identificar de forma continua al alumno (incluso impreso o desde el teléfono del tutor en el caso de menores) sin interrumpir el flujo en puerta. El alumno no registra su propia asistencia; el registro se realiza exclusivamente desde el dispositivo de recepción o del maestro.
- **Comparador de planes como herramienta de consulta:** El comparador accesible desde la bienvenida y los portales es un recurso meramente informativo y de orientación para alumnos y tutores. Recomienda opciones según frecuencia semanal y aclara la regla de 4 semanas, pero **no altera** la membresía actual del alumno, no simula cobros ni muta el estado persistido.
- **Tarifas de referencia pendientes de confirmación:** Los planes y aranceles presentes en el material audiovisual de referencia (p. ej. Dancer Pass Q395, Night Pass Q595, Weekend Pass Q300, Teens In Motion Q495, Full In Motion Q750, Registration Q150, Membership Q125) son valores de demostración externa pendientes de confirmación formal por la dirección de In Motion. En la demo se conservan los tres planes base (4 clases / Q300, 8 clases / Q450, ilimitado / Q625).
- **Preservación de planes desconocidos para revisión administrativa:** Si un alumno figura con un plan no catalogado o personalizado, la administración conserva íntegro el valor original en memoria y en las vistas de gestión, sin forzarlo a opciones predeterminadas ni descartarlo, permitiendo su revisión humana y conciliación manual.
- **Ciclo de cobros en modo Supabase y conciliación de obligaciones:**
  - En modo Supabase conectado, `fetchRemotePayments(students)` concilia en paralelo la tabla `payments` y la tabla `memberships`. Los pagos registrados se mapean a estado `Pagado` con su fecha y método devueltos por el servidor. Las membresías que no posean un pago confirmado para su respectivo período se incorporan a la tabla de control con estado `Pendiente`.
  - **Cuatro estados de pago:**
    - `Pagado`: existe un pago registrado que liquida la cuota del período.
    - `Pendiente`: existe una obligación (membresía) del período sin pagar, cuya fecha de vencimiento es futura o no está definida.
    - `En mora`: la obligación tiene una fecha de vencimiento explícita y dicha fecha ya caducó (`dueDate < TODAY`).
    - `Sin cuota definida`: el alumno no tiene membresía ni cuota asignada en Supabase para el período consultado, o su plan no posee precio numérico válido. No se inventan importes ni se asigna cuota por defecto.
  - **Ausencia de regla de corte/vencimiento en In Motion:** La tabla `public.memberships` almacena `start_date`, `end_date`, `period` y `status`, pero no posee una columna de día límite de pago (`due_date`) ni In Motion ha definido una regla corporativa de corte (p. ej. día 5 o 10 del mes, o días de gracia). En consecuencia, las membresías sin fecha de vencimiento explícita se muestran como "Sin fecha de vencimiento" y se mantienen en estado `Pendiente` (no `En mora`). La definición de la política de cortes y mora queda pendiente de confirmación formal con la dirección de In Motion (Majo Borrayo).
  - **Alta de alumno y cobro inmediato:** Al crear un alumno en modo Supabase mediante `create_student_transactional`, la respuesta vincula el perfil, carné y membresía inicial. El cliente inyecta inmediatamente la obligación pendiente en el estado de pagos (`state.payments`) y en las membresías del alumno, permitiendo registrar su pago de forma inmediata sin requerir recargar la página ni reiniciar la aplicación.
  - **Aislamiento de herramientas WebMCP:** Las herramientas `register_demo_attendance` y `register_demo_payment` operan exclusivamente sobre la maqueta en `localStorage`. Cuando la aplicación detecta una sesión conectada con Supabase (`isSupabaseConnected === true`), ambas herramientas quedan bloqueadas tanto al inicio de su invocación como tras el diálogo de confirmación en pantalla, arrojando un error explícito. Esto previene que un agente anuncie operaciones locales como si estuvieran sincronizadas o confirmadas en la nube.
  - **Confirmación remota y resiliencia ante errores locales:** En el registro de cobros y alta de alumnos, la confirmación remota en Supabase es mandatoria antes de actualizar el almacenamiento del navegador. Si la llamada RPC tiene éxito en la nube pero posteriormente falla `localStorage` o el renderizado del DOM en el navegador local, la aplicación no anuncia un error de servidor: preserva la entidad en la memoria de la sesión, notifica al usuario que el registro fue confirmado exitosamente en la nube y previene la duplicación de transacciones.

## Decisiones para una versión futura (no implementadas)

Estas definiciones orientan la evolución del producto, pero **todavía no forman
parte del prototipo actual**:

- La app usará una base de datos central para alumnos, inscripciones, estado y
  registro de pagos, y asistencia. El almacenamiento actual en `localStorage`
  existe únicamente para la demo y no es la arquitectura de producción.
- La prioridad operativa será la gestión de pagos. La asistencia será un
  servicio complementario y sus registros no modificarán automáticamente el
  estado de pago de un alumno.
- El modelo de asistencia será minimalista: cada sesión tendrá solamente los
  estados **presente** o **sin registro**. No habrá tardanzas, tolerancias ni
  justificaciones.
- La asistencia se registrará contra una sesión de clase concreta. **El contexto
  de la sesión vive en el dispositivo de la academia, no dentro del código QR:**
  el maestro o recepción abre la sesión de la clase y desde ahí escanea. El
  sistema valida contra esa sesión que el alumno esté inscrito, para evitar
  marcaciones cruzadas entre clases.
- **Escanea la academia, no el alumno.** Un solo dispositivo con la sesión
  abierta, no uno por alumno. Se descartó el QR temporal que muestra el maestro
  para que el alumno lo escanee: no aportaba nada que la sesión abierta no diera
  ya, y exigía que los 50 alumnos tuvieran teléfono, app, permiso de cámara y
  sesión propia. Además dejaba fuera a Baile Latino Kids, de 7 a 11 años.
- **El carné del alumno es estático y permanente:** su número de carné y nada
  más. Eso permite tarjetas impresas, que no tienen batería, no piden permisos y
  funcionan para los niños. El teléfono queda como respaldo, no como requisito;
  el tutor también puede mostrar el carné de su hijo desde su portal.
- **La lista manual va en la misma pantalla que el escáner**, no en un flujo
  aparte: quien olvidó la tarjeta se marca con un toque. El maestro siempre
  puede marcar o corregir a mano.
- La cámara y el HTTPS los necesita únicamente ese dispositivo de la academia,
  que pide permiso una vez, en lugar de 50 navegadores pidiéndolo cada mes.
- Queda pendiente decidir si alguna vez hará falta **auto check-in sin personal
  presente** (nadie en recepción, el maestro ocupado). Ese es el único escenario
  donde el QR rotativo en una pantalla del salón tendría sentido, y se evaluaría
  aparte. Un carné estático se puede fotografiar y compartir, pero el incentivo
  no existe: nadie falsifica presencia en una clase que está pagando. Importaría
  solo si la asistencia llegara a habilitar un beneficio, como un descuento por
  asistencia perfecta, que es Módulo 1 y no está cotizado.

## Capa de tema (In Motion 2026)

La apariencia sale de `academia/assets/css/academy-theme.css`, que se carga
**después** de `academy.css` y no modifica ni una línea del archivo base.

- `--red` = `--brand-red` = `#e20c14`. Desde el 16/09/2026 hay **un solo rojo**,
  el de la marca. Antes `--red` era `#d81e5b` (rosado) y la regla era no
  mezclarlos; se unificaron porque el rosado no era de la academia. Las dos
  variables se conservan por si alguna vez vuelven a separarse.
- Logo vectorial `inmotion-logo.svg` en acceso, sidebar, barra superior y carnet.
- Intro: el logo animado va **inline** en `academia/index.html`. Está inline a
  propósito — cargado como `<img>` el navegador no ejecuta las animaciones CSS del
  SVG y la pantalla queda en negro. La versión suelta quedó en
  `academia/assets/inmotion-logo-animado.svg` por si se reusa.
  La cortina de la intro sale a los 2.45s, cuando termina la animación.
- Barra superior negra; en móvil (≤780px) oculta el kicker y la fecha, que ya
  salen en el encabezado de cada página.
- Barra inferior móvil clara, con el tab activo en rojo y un indicador de 4px.
- El panel de la pantalla de acceso es una foto (`assets/acceso-bailarines.webp`)
  con un degradado que hace legible el rótulo de la esquina.

Para volver al estilo anterior: borrá ese archivo y su `<link>` en `academia/index.html`.

## Límites de esta versión

- Todos los nombres, horarios y movimientos son ficticios.
- No hay backend, autenticación real ni sincronización entre dispositivos.
- El QR es una representación visual del flujo, no una credencial de producción.
- La simulación no activa la cámara.
- El registro de pagos no procesa tarjetas, no cobra y no genera factura FEL/SAT.
- No incluye estadísticas, promociones, WhatsApp ni alojamiento propio de video.
