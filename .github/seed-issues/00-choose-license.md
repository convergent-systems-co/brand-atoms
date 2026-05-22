---
title: "Choose your license"
labels: ["kind/chore", "area/core", "priority/high", "status/triage"]
---

## Context

This repo was created from `convergent-systems-co/astro-tf-app-template`, which
ships with **AGPL-3.0** as the default license. AGPL-3.0 is open source
(OSI-approved) and blocks proprietary SaaS forks via the network-distribution
clause.

Close this issue by either:

1. **Keep AGPL-3.0** — do nothing. The default is in place. Comment "keep" and close.
2. **Switch to a different license** — open a PR replacing `LICENSE` (and updating `COPYRIGHT` if applicable) with one of:
   - **MIT** — maximum adoption, no copyleft
   - **Apache-2.0** — patent grant, no copyleft
   - **BUSL-1.1** — source-available, 4-year non-compete, then converts to Apache-2.0
   - **GPL-3.0** — copyleft, no network-use trigger
   - Other — your choice

Then close this issue, linking the PR.

## Acceptance criteria

- [ ] License decision is recorded (either AGPL-3.0 confirmed or replaced)
- [ ] If switched: `LICENSE` and `COPYRIGHT` files updated, ADR filed at `docs/adr/0001-license-choice.md`
- [ ] README license badge / footer reflects the choice
