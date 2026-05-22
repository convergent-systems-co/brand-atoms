---
title: "Wire Cloudflare Pages deployment"
labels: ["kind/feature", "area/release", "priority/high", "status/triage"]
---

## Context

`.github/workflows/release.yml` deploys to Cloudflare Pages when a `v*` tag
is pushed, using `wrangler pages deploy`. It needs three pieces of config to
fire.

## Acceptance criteria

- [ ] Cloudflare API token generated (Account → API Tokens → Create Token, scope: **Account → Cloudflare Pages → Edit**)
- [ ] Repo secret `CLOUDFLARE_API_TOKEN` set to that token's value
- [ ] Repo secret `CLOUDFLARE_ACCOUNT_ID` set to the account ID
- [ ] Repo **variable** (not secret) `CLOUDFLARE_PAGES_PROJECT` set to the Pages project name created in seed issue #4
- [ ] Test by pushing a tag (`scripts/release.sh v0.0.1` to a throwaway tag); confirm the workflow's `deploy` step runs and the site appears at `https://<project>.pages.dev`
- [ ] Production-branch deploys are configured to fire only on tagged releases (current default) — adjust if continuous deploy on `main` is desired
