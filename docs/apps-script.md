# Panel de staff (Google Apps Script)

Fuente en [`apps-script/`](../apps-script): `Code.gs`, `Index.html`, `appsscript.json`.
Esos archivos son la copia versionada de lo que vive en el proyecto de Apps Script:
editarlos aquí no despliega nada, hay que pegarlos allá.

## 1. Crear el proyecto

1. Entrar a <https://script.new>.
2. Reemplazar los archivos por defecto con el contenido de `Code.gs`,
   `Index.html` y `appsscript.json`.

## 2. Ajustar la configuración

En `Code.gs` ya vienen `spreadsheetId` y `driveFolderId`. Solo si hace falta:

- `sheetName`: dejarlo vacío usa la primera pestaña.
- `allowedEmails`: opcional. Vacío para el setup más simple; llenarlo solo si
  querés una lista explícita de permitidos.

## 3. Desplegar

1. `Deploy` → `New deployment`, tipo `Web app`.
2. Para el setup simple: `Execute as: Me`, `Who has access: Anyone with Google account`.
3. Autorizar Drive y Sheets cuando Google lo pida.
4. Copiar la URL del despliegue que termina en `/exec`.

Para allowlist estricta: definir `allowedEmails` y redesplegar con
`Execute as: User accessing the web app`.

## 4. Conectar el sitio

Pegar la URL `/exec` en `APP_CONFIG.appsScriptWebAppUrl` dentro de
[`assets/js/config.js`](../assets/js/config.js) y recargar.

## Troubleshooting

**El catálogo público no carga.** Verificar que el sheet esté publicado en la web,
que `gvizUrl` use `/gviz/tq?tqx=out:json`, que el `gid` apunte a la pestaña correcta
y que el sheet sea público.

**El panel embebido no aparece.** Verificar que `appsScriptWebAppUrl` esté definido,
que sea la URL `/exec` y no `/dev`, y que el despliegue siga activo.

**El panel carga pero falla al guardar o subir.** Verificar que el proyecto haya sido
autorizado después de desplegar, que `spreadsheetId` y `driveFolderId` sean correctos,
que la cuenta del despliegue pueda editar el sheet y escribir en la carpeta, y que el
usuario esté en `allowedEmails` si la activaste.

**Los videos suben pero no reproducen.** Verificar los permisos de la carpeta o los
archivos en Drive, que `video_url` apunte a la URL del archivo y que el formato sea
compatible.
