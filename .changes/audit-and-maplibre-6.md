---
bump: minor
---
Security: `maplibre-gl` moves to 6.9 (GHSA-jrc7-96c5-q579, an XSS sanitizer bypass in `DOM.sanitize()`, critical); the `Map` component is ported to its named exports and consumers keep the same `maplibre-gl/dist/maplibre-gl.css` import. CI: a dependency audit workflow runs on every push to `main`, weekly and on demand (production dependencies fail at high or above, the whole tree at critical), and the publish job refuses to ship with a high or critical advisory in a production dependency. `npm run audit` / `just audit` run the same gate locally. Dev tooling: vitest 4.1.11 and the transitive advisories in postcss, nanoid, fast-uri, browserslist and brace-expansion cleared.
