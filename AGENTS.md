# Repository Guide

## Commands

- Install with the committed Yarn v1 lockfile: `yarn install --frozen-lockfile`.
- TypeScript is not declared in `package.json`; `yarn build` requires `tsc` on `PATH` (the Docker builder installs it globally). On a clean host, use `npx --yes --package typescript@4.9.3 tsc` for the equivalent check.
- Verify changes with `yarn build` when `tsc` is available; this is the only configured check and emits `dist/`.
- Run locally with `yarn build && yarn start`, from the repository root. The server listens on port 3000.
- There is no configured test, lint, formatter, or dedicated typecheck script. Do not invent one; `yarn build` runs strict TypeScript compilation.

## Runtime shape

- `src/index.ts` is the only entrypoint. Each `/assets/...` route first runs the matching getter from `src/middleware/assetsGetter.ts`, then serves the generated PNG with `express.static`.
- `src/config/assets.config.ts` owns the upstream WebP URL templates. The middleware downloads, converts with Sharp, and caches files under `public/assets/`.
- Paths are based on `process.cwd()`, so start the process from the repository root (the Docker image uses `/app`).
- `public/*` is intentionally gitignored. The Compose files mount `./public:/app/public` so the image cache survives container replacement; do not commit generated images.

## Deployment quirks

- `docker-compose.yml` does not publish port 3000. Use the README's `docker run -p 3000:3000 ...` flow for direct local access.
- `docker-compose.traefik.yml` is the production-style setup and requires the pre-existing external `traefik` network and its configured TLS resolver.
- The runtime Docker stage intentionally uses `npm install --omit=dev` because `node:slim` lacks Yarn/Corepack; the builder still uses `yarn install --frozen-lockfile`.

## Known cache hazards

- Before changing asset fetching or investigating Chrome `blocked by ORB`, read `ORB_INVESTIGATION.md`; it records verified behavior and focused acceptance checks.
- A cache hit currently calls `next()` without returning, so execution continues into another upstream download/write. Do not treat the current branch as a working cache implementation.
- Writes currently target the final PNG directly. Preserve the mounted-cache behavior, but account for concurrent readers/writers when fixing this path.
