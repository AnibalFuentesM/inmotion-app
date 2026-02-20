# Salsa Recap Video Catalog (Static Web App)

A static single-page web app that loads salsa recap video metadata from a published Google Sheet GViz JSON endpoint.

## Features

- Fetches Google Visualization JSON (`gviz/tq?tqx=out:json`) and parses the `setResponse(...)` wrapper.
- Search across `step_name`, `tags`, `style`, and `level`.
- Style and level dropdown filters.
- Responsive video card catalog with thumbnails.
- Detail modal with video playback/preview and full metadata.
- Error handling for network/API failures and empty states.

## Project Structure

```text
/Users/anibal/Documents/New project/
  index.html
  /assets/
    /css/
      app.css
    /js/
      config.js
      data-source.js
      gviz-parser.js
      video-model.js
      filters.js
      ui-cards.js
      ui-modal.js
      app.js
  README.md
```

## Configuration

Edit `/Users/anibal/Documents/New project/assets/js/config.js`:

- Set `APP_CONFIG.gvizUrl` to your endpoint.
- Keep `APP_CONFIG.gid` aligned with your selected sheet tab.

Supported URL patterns:

1. `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&gid=0`
2. `https://docs.google.com/spreadsheets/d/e/<PUBLISHED_ID>/gviz/tq?tqx=out:json&gid=0`

Required sheet columns:

- `id`
- `step_name`
- `style`
- `level`
- `date`
- `video_url`
- `thumbnail_url`
- `tags`
- `notes`

## Local Run

No build step is required.

1. Open `/Users/anibal/Documents/New project/index.html` directly in a browser, or
2. Serve locally with a static server. Example:

```bash
cd "/Users/anibal/Documents/New project"
python3 -m http.server 5500
```

Then visit [http://localhost:5500](http://localhost:5500).

## Deploy to GitHub Pages

1. Push this folder to your GitHub repository root.
2. Open repository Settings > Pages.
3. Set source to `main` branch and root (`/`).
4. Save. GitHub Pages serves the app as static files.

## Deploy to Netlify

1. Connect your repository (or drag and drop this folder).
2. Build command: leave blank.
3. Publish directory: `.`
4. Deploy.

## Video Playback Behavior

The modal player uses this priority:

1. Google Drive URL: converts to `https://drive.google.com/file/d/<id>/preview` and embeds an iframe.
2. Direct media file URL (`.mp4`, `.webm`, `.ogg`): renders native `<video controls>`.
3. Any other URL: shows external link fallback.

## Troubleshooting

### App shows “Unable to load videos”

Check:

1. The sheet is published to web.
2. `APP_CONFIG.gvizUrl` uses `/gviz/tq?tqx=out:json`.
3. The `gid` points to the correct tab.
4. The sheet is public (no authentication required).

### App loads but no videos appear

Check:

1. There are rows in the target tab.
2. Header names match expected columns.
3. Style/level filters are not excluding all rows (use “Clear filters”).

### Thumbnails or videos fail to render

- Keep URLs publicly accessible.
- For Drive videos, ensure sharing permissions allow public viewing.
