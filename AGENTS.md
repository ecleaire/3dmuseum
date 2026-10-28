# Development and publication

- Use the existing checkout. Do not create a Git worktree unless the user asks.
- The public site at https://ecleaire.github.io/3dmuseum/ must show only its header and a coming-soon screen with its interactive regular octahedron until the user explicitly asks to launch it.
- The complete model viewer in index.html and src/ is the master application. Preserve it while changing the public landing page in production/.
- `npm run build` produces only the public coming-soon page in dist/. The regular octahedron asset in production/ is approved for public display. Never upload dist-master/, the app source, or public/models/ to GitHub Pages.
- `npm run dev` serves the master on loopback only. `npm run build:master` builds it to dist-master/. A noindex tag or client-side login screen is not access control.
- Do not deploy the master publicly. A remote master site needs server-side access control (such as Cloudflare Access) configured for the user's account first. Hosting choice and credentials are still pending.
- Do not launch the full application on production automatically after tests pass or after a normal commit/push request. Production launch requires explicit user instruction.
- Run npm test and the affected build. The Pages workflow checks the published landing page and verifies that master paths and model assets return 404.
