---
title: "Cut v0.1.0 release and first deploy"
labels: ["kind/chore", "area/release", "priority/medium", "status/triage"]
---

## Context

`.github/workflows/release.yml` fires on `v*` tag, builds the Astro site,
and deploys to Cloudflare Pages via `wrangler pages deploy`. Requires the
secrets and vars wired up in seed issue #5.

## Acceptance criteria

- [ ] Seed issue #5 (Cloudflare Pages deployment) is done
- [ ] `scripts/release.sh v0.1.0` tags and pushes
- [ ] `release.yml` workflow succeeds end-to-end (`install` → `build` → `deploy (Cloudflare Pages)` → `create GitHub release`)
- [ ] The site is reachable at `https://<project>.pages.dev` (or the custom domain configured in #4)
- [ ] GitHub Release page exists with auto-generated notes
- [ ] CHANGELOG.md's `[Unreleased]` section is migrated to `[0.1.0] — <date>`
