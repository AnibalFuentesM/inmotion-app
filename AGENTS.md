# AGENTS.md

Contexto para agentes y LLMs que trabajen en este repo. Leer completo antes del primer cambio.

## Qué es

Un sitio estático con dos superficies que comparten dominio pero **no** código:
el **catálogo de videos** (raíz, en producción) y la **app de la academia**
(`/academia/`, prototipo). Sin build, sin framework, sin backend propio.

## Dónde se trabaja

Se trabaja **siempre sobre esta misma app**: `academia/`, dentro de
`~/Documents/Inmotion`, sobre `main`. Esto aplica a cualquier agente o LLM.

- **No crear apps, prototipos, maquetas ni "versiones para probar" aparte.**
  Si algo hay que experimentar, se experimenta acá. El cliente ve una sola app.
- **No crear ramas, worktrees ni clones** salvo que Mariano lo pida explícitamente.
  Ya pasó: una sesión dejó un checkout en `~/.codex/worktrees/1755/Inmotion` con un
  `python3 -m http.server 5500` sirviendo una copia vieja. Antes de dar por bueno lo
  que ves en el navegador, confirmá desde qué carpeta sirve el puerto:
  `lsof -nP -iTCP:5500 -sTCP:LISTEN` y `lsof -a -p <pid> -d cwd`.
- **El agente puede ejecutar directamente los comandos normales de git**, incluidos
  `add`, `commit` y `push`, cuando formen parte del trabajo solicitado. Antes de
  commitear debe revisar el estado, incluir únicamente los archivos correspondientes
  a su tarea y preservar cualquier cambio ajeno que ya exista. No debe usar operaciones
  destructivas, reescribir historial, hacer force-push ni borrar archivos de la carpeta
  salvo que Mariano lo pida explícitamente.
- Usá `git --no-optional-locks status` para consultar: un `git status` normal puede
  dejar un `.git/index.lock` que el agente no puede borrar y que bloquea el siguiente
  comando de Mariano.

## Dónde tocar qué

| Quiero cambiar… | Archivo |
| --- | --- |
| Apariencia de la app | `academia/assets/css/academy-theme.css` |
| Comportamiento / pantallas de la app | `academia/assets/js/academy.js` |
| Estructura, intro y shell de la app | `academia/index.html` |
| El catálogo (maquetado) | `index.html` |
| Datos del catálogo (sheet, gid, webapp) | `assets/js/config.js` |
| Lógica del catálogo | `assets/js/*.js` |
| Panel de staff (Drive + Sheets) | `apps-script/Code.gs`, `apps-script/Index.html` |

## Reglas

1. **`academia/` es autocontenida.** No la hagas depender de `/assets/` ni al revés.
   Está duplicado el logo a propósito: así la carpeta se puede sacar a su propio repo
   sin reescribir una sola ruta.
2. **El estilo de la app se cambia en `academy-theme.css`, nunca en `academy.css`.**
   El theme es una capa de overrides que se carga después; borrarlo devuelve el diseño base
   intacto. Si un cambio no se puede expresar como override, decilo antes de editar la base.
3. **Un solo rojo.** Desde el 16/09/2026 `--red` y `--brand-red` valen ambos `#e20c14`,
   el rojo de la marca. Antes `--red` era `#d81e5b` (rosado) y la regla era no mezclarlos;
   se unificaron porque el rosado no era de la academia. Las dos variables siguen
   existiendo: si alguna vez se vuelven a separar, se cambia solo el valor en
   `academy-theme.css`, nunca los usos.
4. **El logo animado de la intro va inline en `academia/index.html`.**
   No lo conviertas a `<img src>`: el navegador renderiza el SVG pero no ejecuta sus
   animaciones CSS, y la intro sale en negro. La cortina sale a los 2.45s, justo después
   de que termina la animación; si cambiás una, cambiá la otra.
5. **La app no tiene backend.** Todo persiste en `localStorage` bajo la clave
   `inmotion-academy-demo-v1`. No inventes llamadas a una API que no existe.
6. **El catálogo se configura solo desde `assets/js/config.js`.** No hardcodees URLs
   de Sheets ni de Apps Script en otro archivo.
7. **No hay paso de build.** No agregues bundler, framework ni dependencias sin acordarlo.
8. **Nunca commitear** `.env*.local` ni `.vercel/` (ya están en `.gitignore`).

## Convenciones

- UI y comentarios en español; nombres de variables y funciones en inglés.
- HTML, CSS y JS planos. Módulos ES nativos (`<script type="module">`).
- Todos los nombres, horarios y montos de la app son ficticios, de demostración.

## Antes de dar algo por terminado

- Levantar `python3 -m http.server 5500` y abrir **las dos** superficies.
- Consola del navegador sin errores.
- Probar la app a 375px de ancho: la barra superior y la inferior cambian de layout ahí.
