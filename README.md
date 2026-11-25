# GPD Marketing Frontend

This folder is a standalone Netlify site repository. Set the site root to
`frontend/` when deploying from the monorepo, or push this folder's contents to
a frontend-only repository.

Set `VITE_API_URL` to the public HTTPS origin of the Render API. Netlify builds
with `npm run build`; `netlify.toml` publishes `dist/` and routes SPA paths to
`index.html`.
