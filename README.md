# In Motion

Sitio estático con **dos superficies independientes**. No hay build, ni dependencias, ni backend propio.

| Superficie | URL | Carpeta | Qué es |
| --- | --- | --- | --- |
| Catálogo de videos | `/` | `index.html` + `assets/` | Catálogo público que lee un Google Sheet, con panel de staff embebido vía Apps Script. En producción. |
| App de la academia | `/academia/` | `academia/` | Prototipo navegable de gestión: alumnos, clases, pagos, asistencia QR. Datos de demostración. |

## Cómo correr

```bash
python3 -m http.server 5500
```

- Catálogo: <http://localhost:5500/>
- App: <http://localhost:5500/academia/>

## Estructura

```text
.
├── index.html                 # catálogo de videos (raíz del sitio)
├── assets/
│   ├── favicon.svg
│   ├── hero-bg.png
│   ├── inmotion-logo.svg
│   ├── css/app.css
│   └── js/                    # app.js, admin-panel.js, config.js, data-source.js,
│                              # filters.js, gviz-parser.js, ui-cards.js, ui-modal.js,
│                              # video-model.js
├── academia/                  # autocontenida: no depende de /assets/
│   ├── index.html
│   └── assets/
│       ├── favicon.svg
│       ├── inmotion-logo.svg
│       ├── inmotion-logo-animado.svg
│       ├── css/academy.css        # diseño base
│       ├── css/academy-theme.css  # capa de tema (overrides)
│       └── js/academy.js
├── apps-script/               # fuente para pegar en Google Apps Script
├── docs/
└── AGENTS.md                  # contexto y reglas para agentes / LLMs
```

## Documentación

- [docs/academia.md](docs/academia.md) — la app: roles, datos, tema, límites.
- [docs/catalogo.md](docs/catalogo.md) — el catálogo y su configuración.
- [docs/apps-script.md](docs/apps-script.md) — despliegue del panel de staff y troubleshooting.
- [AGENTS.md](AGENTS.md) — lo que un agente necesita saber antes de tocar el repo.
