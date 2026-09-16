# App de la academia

Prototipo navegable de gestión para In Motion Dance Academy. Vive en `academia/`
y se sirve en `/academia/`.

## Qué incluye

- Acceso de demostración para alumno, maestro y administración.
- Alumno: inicio, calendario de clases, carnet QR.
- Maestro: agenda del día y control de asistencia.
- Administración: listado de alumnos, alta local, control de pagos y mora.
- Simulación del registro de asistencia por QR.
- Registro local de pagos hechos fuera de la plataforma.
- Navegación responsive: menú lateral en escritorio, barra inferior en móvil.

## Datos

Todo persiste en `localStorage` bajo la clave `inmotion-academy-demo-v1`.
Para reiniciar la demo, borrá esa clave desde las herramientas del navegador
o borrá los datos del sitio.

## Capa de tema (In Motion 2026)

La apariencia sale de `academia/assets/css/academy-theme.css`, que se carga
**después** de `academy.css` y no modifica ni una línea del archivo base.

- `--red` = `#d81e5b` (carmín): botones, enlaces, estado activo.
- `--brand-red` = `#e20c14`: reservado al logo y a los brochazos.
- Logo vectorial `inmotion-logo.svg` en acceso, sidebar, barra superior y carnet.
- Intro: el logo animado va **inline** en `academia/index.html`. Está inline a
  propósito — cargado como `<img>` el navegador no ejecuta las animaciones CSS del
  SVG y la pantalla queda en negro. La versión suelta quedó en
  `academia/assets/inmotion-logo-animado.svg` por si se reusa.
  La cortina de la intro sale a los 2.45s, cuando termina la animación.
- Barra superior negra; en móvil (≤780px) oculta el kicker y la fecha, que ya
  salen en el encabezado de cada página.
- Barra inferior móvil clara, con el tab activo en carmín y un indicador de 4px.

Para volver al estilo anterior: borrá ese archivo y su `<link>` en `academia/index.html`.

## Límites de esta versión

- Todos los nombres, horarios y movimientos son ficticios.
- No hay backend, autenticación real ni sincronización entre dispositivos.
- El QR es una representación visual del flujo, no una credencial de producción.
- La simulación no activa la cámara.
- El registro de pagos no procesa tarjetas, no cobra y no genera factura FEL/SAT.
- No incluye estadísticas, promociones, WhatsApp ni alojamiento propio de video.
