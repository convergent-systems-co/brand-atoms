---
title: "Add web vitals monitoring"
labels: ["kind/feature", "area/core", "priority/medium", "status/triage"]
---

## Context

`Code.md §10.2` requires Core Web Vitals targets: LCP < 2.5s, INP < 200ms,
CLS < 0.1 on a mid-range mobile device on slow 4G. Verify in CI and in
production.

## Acceptance criteria

- [ ] Cloudflare Web Analytics enabled on the Pages project (privacy-respecting, cookieless) — or an alternative privacy-respecting analytics choice documented in an ADR
- [ ] At least one synthetic Lighthouse run is scheduled (Cloudflare's built-in Lighthouse integration, or a GitHub Actions job using `treosh/lighthouse-ci-action`)
- [ ] PR comments include Lighthouse score deltas when the site changes
- [ ] An alert / threshold fires when any Core Web Vital regresses past the targets above

## Notes

For an Astro static site, the practical instrumentation surface is:
- **Real-user metrics**: Cloudflare Web Analytics (or a self-hosted equivalent like Plausible / Umami)
- **Synthetic**: Lighthouse CI in PRs
- **Errors / runtime**: minimal for static sites — add Sentry only if there is client-side JS that warrants it
