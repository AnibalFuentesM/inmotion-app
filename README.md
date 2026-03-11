# Salsa Recap Video Catalog

A static single-page catalog that reads video metadata from a published Google Sheet and now embeds a simpler Apps Script staff panel for uploads and metadata edits.

## Features

- Loads public catalog data from a Google Sheets GViz endpoint.
- Search plus style and level filters.
- Responsive video cards with thumbnails and modal playback.
- Embedded Apps Script panel for:
  - uploading a new video to Google Drive
  - appending a new row to the catalog sheet
  - editing metadata for an existing catalog item

## Project Structure

```text
/Users/anibal/Documents/Inmotion/
  index.html
  /assets/
    /css/
      app.css
    /js/
      app.js
      admin-panel.js
      config.js
      data-source.js
      filters.js
      gviz-parser.js
      ui-cards.js
      ui-modal.js
      video-model.js
  /apps-script/
    Code.gs
    Index.html
    appsscript.json
  README.md
```

## Website Config

Edit [assets/js/config.js](/Users/anibal/Documents/Inmotion/assets/js/config.js).

Required fields:

- `APP_CONFIG.gvizUrl`
- `APP_CONFIG.gid`
- `APP_CONFIG.appsScriptWebAppUrl`

Example:

```js
export const APP_CONFIG = {
  gvizUrl:
    'https://docs.google.com/spreadsheets/d/1F5vMhZXHYvsc179HOdRWyml1lqeN-uxiSQv_AwZVqvg/gviz/tq?tqx=out:json&gid=0',
  gid: 0,
  appsScriptWebAppUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  requiredColumns: [
    'id',
    'step_name',
    'style',
    'level',
    'date',
    'video_url',
    'thumbnail_url',
    'tags',
    'notes'
  ]
};
```

The public catalog still depends on the same sheet columns:

- `id`
- `step_name`
- `style`
- `level`
- `date`
- `video_url`
- `thumbnail_url`
- `tags`
- `notes`

## Apps Script Setup

The simpler admin flow lives in [apps-script/Code.gs](/Users/anibal/Documents/Inmotion/apps-script/Code.gs), [apps-script/Index.html](/Users/anibal/Documents/Inmotion/apps-script/Index.html), and [apps-script/appsscript.json](/Users/anibal/Documents/Inmotion/apps-script/appsscript.json).

### 1. Create the Apps Script project

1. Go to [script.new](https://script.new).
2. Replace the default files with the contents of:
   - [apps-script/Code.gs](/Users/anibal/Documents/Inmotion/apps-script/Code.gs)
   - [apps-script/Index.html](/Users/anibal/Documents/Inmotion/apps-script/Index.html)
   - [apps-script/appsscript.json](/Users/anibal/Documents/Inmotion/apps-script/appsscript.json)

### 2. Adjust the script config

In `Code.gs`, these values are already prefilled:

- `spreadsheetId`
- `driveFolderId`

You only need to adjust these if necessary:

- `sheetName`
  - leave it blank to use the first sheet tab
- `allowedEmails`
  - optional
  - leave empty for the simplest setup
  - fill it only if you want an explicit allowlist

### 3. Deploy the web app

1. Click `Deploy` > `New deployment`.
2. Choose type `Web app`.
3. For the simplest setup:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone with Google account`
4. Click `Deploy`.
5. Authorize Drive and Sheets access when Google asks.
6. Copy the deployment URL that ends in `/exec`.

If you want strict per-user allowlisting later:

- set `allowedEmails` in `Code.gs`
- redeploy as `Execute as: User accessing the web app`

### 4. Connect the website

Paste the `/exec` URL into `APP_CONFIG.appsScriptWebAppUrl` in [assets/js/config.js](/Users/anibal/Documents/Inmotion/assets/js/config.js), then reload the site.

## Local Run

No build step is required.

```bash
cd "/Users/anibal/Documents/Inmotion"
python3 -m http.server 5500
```

Then open [http://localhost:5500/index.html](http://localhost:5500/index.html).

## Upload Flow

- The website embeds the Apps Script web app in an iframe.
- The Apps Script form uploads the file into the configured Drive folder.
- Apps Script writes the metadata into the spreadsheet.
- After a successful upload or edit, the iframe notifies the parent page and the public catalog reloads automatically.

## Troubleshooting

### The public catalog does not load

Check:

1. The sheet is published to web.
2. `APP_CONFIG.gvizUrl` uses `/gviz/tq?tqx=out:json`.
3. The `gid` points to the correct tab.
4. The sheet is public.

### The embedded staff panel does not appear

Check:

1. `APP_CONFIG.appsScriptWebAppUrl` is set.
2. The URL is the deployed `/exec` URL, not `/dev`.
3. The Apps Script deployment is still active.

### The embedded panel loads but save/upload fails

Check:

1. The Apps Script project was authorized after deployment.
2. The `spreadsheetId` and `driveFolderId` in `Code.gs` are correct.
3. The deployment account can edit the sheet and write to that Drive folder.
4. If you enabled `allowedEmails`, the current user matches one of those emails.

### Videos upload but do not play in the catalog

Check:

1. The Drive folder or files are shared in a way that allows viewers to open them.
2. The saved `video_url` points to a Drive file URL.
3. The uploaded files are compatible video formats.
