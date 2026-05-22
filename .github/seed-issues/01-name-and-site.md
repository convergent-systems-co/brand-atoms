---
title: "Set site name, URL, and repo identity"
labels: ["kind/chore", "area/core", "priority/high", "status/triage"]
---

## Context

The template ships with placeholder values that need to be replaced before
the first deploy.

## Acceptance criteria

- [ ] `web/site/package.json` — `"name"` reflects the real site slug (or rename `web/site/` to a more specific dir, e.g. `web/marketing/`, and update `Makefile`'s `SITE` default)
- [ ] `web/site/astro.config.mjs` — `site:` set to the real production URL (drives sitemap, canonical, OG/Twitter Cards)
- [ ] `web/site/src/pages/index.astro` — title + description replaced with real content
- [ ] README.md H1 is the project's real name
- [ ] `npm install && npm run check && npm run build` succeed from `web/site/`
