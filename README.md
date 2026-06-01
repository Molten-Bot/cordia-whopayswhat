# WhoPaysWhat

Static browser-only starter for splitting bills with friends. Current UI ships with a local expense list, settled-item clearing, app naming, and theme preferences.

## Structure

- `public/index.html` - app markup and deploy entry point
- `public/global.css` - global styling
- `src/app.ts` - typed browser-only application source
- `public/app.js` - compiled browser application logic
- `public/_redirects` - static hosting SPA fallback
- `public/_headers` - basic static security headers

## Run locally

Install dependencies, compile TypeScript, then serve the `public` folder with any static file server:

```sh
npm install
npm run build
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Deploy

Use these project settings:

- Build command: `npm run build`
- Build output directory: `public`

WhoPaysWhat does not require bundling or server functions.
