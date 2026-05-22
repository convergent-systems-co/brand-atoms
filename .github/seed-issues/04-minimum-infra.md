---
title: "Define minimum-viable infra (Pages project + DNS)"
labels: ["kind/feature", "area/infra", "priority/medium", "status/triage"]
---

## Context

Lay down the floor: a Cloudflare Pages project, a custom domain (if
applicable), and the DNS records that route traffic.

## Acceptance criteria

- [ ] `cloudflare_pages_project.site` applies clean in `dev`
- [ ] Custom domain configured via `cloudflare_pages_domain` (if a domain is in scope) — otherwise the default `*.pages.dev` host is used and documented
- [ ] DNS records (`cloudflare_record` for CNAME or A pointing at Pages) exist in the same workspace
- [ ] `tflint` passes
- [ ] Cost estimate documented in the PR description (Pages free tier is sufficient for most sites)
