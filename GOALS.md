# brand-atoms — Goals

> Brand guidelines, from PDFs into typed YAML — machine-consumable, composable atoms covering palettes, fonts, and glyph sets.

*This document is derived from `aish/ARCHITECTURE.md` (now `xdao/xdao/ARCHITECTURE.md` §The *-Atoms Catalogs). Sections marked **Generated** are pattern-based and are intended as a starting point for revision, not as decided plan.*

---

## What this catalog makes civilization-grade

Brand systems live as opaque PDFs and Figma boards. Designers, developers, and AI agents can't read them programmatically. Every brand-aware product (websites, apps, docs, terminals) re-implements the same color/font lookup. The same brand drifts across surfaces because no canonical machine-readable source exists.

By cataloging the primitives, `brand-atoms` turns this domain from opaque-and-ephemeral to typed, versioned, composable, machine-readable, and open — the civilization-grade properties the ecosystem requires.

## What it catalogs

### Atom types

- **`palette`** — Color swatches with semantic roles (primary, accent, muted, success, warning, error). Defined once, consumed by every surface.
- **`font`** — Font family with weights and licenses. Distinguishes display, body, mono, and where each is licensed for use.
- **`glyph`** — Nerd Font icon family (filetype glyphs, status indicators, prompt characters). New atom type introduced by aish theming work.

### Compositions: `brands`

A brand composition assembles palette + font + glyph sets with semantic role mappings (`primary`, `cta`, `heading`) and structured assets (logos, favicons, og-images). A new sub-type `brands/shell/` extends a general brand with prompt segments, separators, and shell-specific role bindings — consumed by aish.

### Rule types

- **`contrastRatio`** — WCAG contrast minimums per role pairing (e.g., primary-on-background ≥ 4.5).
- **`fontPairing`** — Permitted family combinations (e.g., headlines may pair with body but not with mono).
- **`forbiddenTreatment`** — Anti-patterns (don't tint logos, don't stretch wordmarks, don't use display font below 14pt).
- **`numericRange`** — Acceptable value ranges (font weight 300-700, hex saturation ≤ 90%).

## Runtime consumers

- **aish** — v0.2 — Shell theming via the `brands/shell/` extension. Atomic theme swap, pre-compiled ANSI escape sequences, nanosecond render path.
- **olympus** — Future — overlay theming for governance panels and TUI surfaces.

## Status & priority

**Current status:** `existing` — 236 palettes, 225 fonts, 151 brands

**Priority tier:** Tier 1 — Already exists with runtime pull

**Trigger / activation condition:** Already active. aish v0.2 will be the first runtime to consume the new `brands/shell/` extension.

## Roadmap *(Generated — milestone shapes mirror aish's roadmap pattern; revise as actual work begins)*

### v0.1 — Bootstrap & spec acceptance

**Goal:** Spec and ship the `brands/shell/` schema. Migrate 10 curated shell brands.

**Success criterion:** aish v0.2 successfully renders 10 themes with sub-50ms theme switch.

**Kill criterion:** Spec churn forces aish v0.2 to ship its own theming — indicates the catalog can't keep pace with a runtime.

**Work:**

- [ ] PR `brands/shell/` schema to atoms-spec
- [ ] Migrate 3 existing brands (nord, dracula, gruvbox) to shell extensions
- [ ] Add 7 new curated shell brands (powerline, minimal, classic variants)
- [ ] Validate against aish v0.2 theme loader
- [ ] Publish signed exports per atoms-spec

### v0.2 — Adoption & expansion

**Goal:** Community contribution flow for new shell brands.

**Work:**

- [ ] Bootstrap CONTRIBUTING.md with shell brand template
- [ ] Add 25 community-contributed brands
- [ ] Olympus integration scoping

### v1.0 — Operational

**Goal:** Olympus consumes Brand Atoms for overlay theming.

## Concrete atom example *(Generated — illustrative, not seed content)*

```yaml
atoms/glyph/nerd-default.yml
---
id: nerd-default
type: glyph
version: 1.0.0
name: Nerd Default
description: Default Nerd Font glyph set with filetype icons and shell indicators.
filetype_map:
  ".go": "\uE626"      # nf-dev-go
  ".rs": "\uE7A8"      # nf-dev-rust
  ".py": "\uE606"      # nf-dev-python
  ".md": "\uE73E"      # nf-fae-markdown
git:
  clean: "\uF00C"      # nf-fa-check
  dirty: "\uF071"      # nf-fa-warning
prompt:
  char: "❯"
license: OFL-1.1 (via Nerd Fonts)
```

## Adoption strategy *(Generated)*

Already adopted via brand-atoms's existing user base. The shell extension piggybacks on existing brand contributors.

## Civilization-grade property checklist

Every catalog must satisfy these before v1.0. Failing any blocks a release.

| Property | Mechanism in this catalog |
|---|---|
| Typed | JSON Schema in `schemas/` validates every atom, composition, rule |
| Versioned | Every atom has a semver `version` field; compositions reference atoms by version-pinned ID |
| Machine-readable | `exports/catalog.json` published on every release |
| Composable | Compositions reference atoms by ID; CI verifies references resolve and no circular dependencies |
| Open | Apache-2.0 licensed; LICENSE file present |
| Durable | No external dependencies for primary content (no remote image URLs, no vendor APIs in the hot path) |

## Related

- **Spec:** [atoms-spec](https://github.com/convergent-systems-co/atoms-spec) — the canonical structure every catalog conforms to
- **Tools:** [atoms-tools](https://github.com/convergent-systems-co/atoms-tools) — CLI for validate / export / bootstrap / resolve
- **Federation:** [xdao](https://github.com/convergent-systems-co/xdao) — ecosystem directory and discovery
- **Umbrella:** [atoms](https://github.com/convergent-systems-co/atoms) — every catalog as a git submodule
- **Manifest:** [`ATOMS.yml`](./ATOMS.yml) — this catalog's machine-readable manifest
- **Standard:** [`README.md`](./README.md) — catalog overview and contribution flow
