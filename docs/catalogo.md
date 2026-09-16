# Catálogo de videos

Catálogo estático de una sola página que lee metadata desde un Google Sheet
publicado, con un panel de staff embebido para subir y editar. Es la raíz del
sitio (`index.html`).

## Funciones

- Carga los datos públicos desde un endpoint GViz de Google Sheets.
- Búsqueda más filtros por estilo y nivel.
- Tarjetas responsive con miniatura y reproducción en modal.
- Panel de Apps Script embebido para subir un video a Drive, agregar una fila al
  sheet y editar la metadata de un ítem existente.

## Configuración

Se edita **solo** en [`assets/js/config.js`](../assets/js/config.js).

Campos obligatorios: `APP_CONFIG.gvizUrl`, `APP_CONFIG.gid`,
`APP_CONFIG.appsScriptWebAppUrl`.

```js
export const APP_CONFIG = {
  gvizUrl: 'https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:json&gid=0',
  gid: 0,
  appsScriptWebAppUrl: 'https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec',
  requiredColumns: [
    'id', 'step_name', 'style', 'level', 'date',
    'video_url', 'thumbnail_url', 'tags', 'notes'
  ]
};
```

El sheet debe tener esas mismas columnas: `id`, `step_name`, `style`, `level`,
`date`, `video_url`, `thumbnail_url`, `tags`, `notes`.

## Flujo de subida

1. El sitio embebe la web app de Apps Script en un iframe.
2. El formulario sube el archivo a la carpeta de Drive configurada.
3. Apps Script escribe la metadata en el spreadsheet.
4. Al terminar, el iframe avisa a la página padre y el catálogo se recarga solo.

Despliegue y troubleshooting del panel: [apps-script.md](apps-script.md).
