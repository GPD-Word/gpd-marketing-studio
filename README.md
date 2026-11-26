# GPD Marketing Frontend

This folder is a standalone Netlify site repository. Set the site root to
`frontend/` when deploying from the monorepo, or push this folder's contents to
a frontend-only repository.

Netlify builds with `npm run build`; `netlify.toml` publishes `dist/`, proxies
`/api/*` and `/health` to the Render API, and routes other paths to `index.html`.
Set `VITE_API_URL` to the public Render API origin so the TikTok sign-in helper
can display the direct API URL. Production API requests still use the
same-origin Netlify proxy, allowing the secure sign-in cookie to work across
browsers. Update the proxy destination in `netlify.toml` if the Render API URL
changes.
