---
title: "Wire CI: typecheck + build"
labels: ["kind/chore", "area/ci", "priority/high", "status/triage"]
---

## Context

`.github/workflows/ci.yml` exists; confirm it runs typecheck + build on
every PR, and that the Node version matches `package.json`'s `engines` field.

## Acceptance criteria

- [ ] `ci.yml` runs on PR + push-to-main
- [ ] `check` job runs `npm run check` (Astro check / TypeScript)
- [ ] `build` job runs `npm run build` and uploads `web/site/dist/` as artifact
- [ ] Node version in CI matches `web/site/package.json` `engines.node`
- [ ] Required status check enabled on the `main` branch protection rule
