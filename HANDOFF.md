# HANDOFF — brand-atoms encyclopedia roadmap to "complete"

Current state and the punch list for getting the encyclopedia from its
present catalog and feature surface to a state I'd call _complete_.
This is a living document: edit it as items move between sections.

---

## Snapshot (2026-05-19)

- **Brands:** 144
- **Palettes:** 210
- **Fonts:** 69
- **Output formats per brand:** 9 (YAML, JSON, W3C tokens, CSS, SCSS,
  Tailwind, Figma tokens, Swift, Kotlin, Markdown)
- **Live site:** [brand-atoms.com](https://brand-atoms.com)
- **CLI:** `brandatom` v0.1.1 — brew + scoop install live
- **Last commit on `main`:** `43ee387` (pre-handoff bump)
- **Session commit count:** 43 (Wave-5 added 8 cluster commits)

## What "complete" means

The encyclopedia is _complete_ when:

1. **Catalog density** — every recognized identity an AI agent or
   designer is likely to ask for can be addressed as
   `<slug>@<version>` and resolves to a real, sourced spec. Not "every
   brand in existence" — every brand a reasonable consumer expects to
   find.
2. **Quality consistency** — every brand at every version uses the
   same role vocabulary, has both light + dark mode role mappings, and
   carries at least 5 typed rules grounded in published guidance.
3. **Output completeness** — every brand emits cleanly through every
   emitter, with no `[unresolved]` strings or missing fields in any
   format.
4. **Contribution path** — anyone outside the original maintainers
   can request that a brand be added (form lives at `/request-brand`),
   and the AI-augmented review path documented below can turn the
   request into a draft PR.
5. **Distribution** — the CLI works on every major platform; the
   library can be consumed via HTTP fetch, npm, brew, and scoop.

---

## 1. Catalog expansion (data work)

Brands and atoms still missing from the catalog, in roughly
decreasing order of usefulness for the catalog's primary audiences
(AI agents generating in-brand output; humans browsing or composing).

### High-value brand gaps

- [x] **Communications apps (4):** WhatsApp, Telegram, Signal, Snapchat — landed in `6733a61` (#20)
- [x] **Hardware / silicon (5):** NVIDIA, AMD, Intel, Samsung, Sony — landed in `ce0b1b4` (#21). Scope was parent corporate identity only; sub-brands (GeForce, Ryzen, Galaxy, Bravia, Xperia, Vaio) deferred.
- [x] **Other major tech gap-fillers (9):** Adobe, IBM, Atlassian, Salesforce, MongoDB landed in `943c3b8` (#22A); Cursor, Hugging Face, Postman, Oracle landed in `c4267cd` (#22B). IBM brand reuses the existing `carbon@1` palette (no duplicate). Cursor authored light-first per live evidence (overriding initial dark-first directive); MongoDB authored dark-first per mongodb.com hero. Spectrum + Atlassian palettes captured anchor stops only, not the full 14×16 grid — flagged in palette `provenance.notes` for future expansion.
- [x] **AI labs (4):** Mistral, Cohere, Perplexity, xAI — landed in `7518580` (#23). Anthropic + OpenAI already in catalog. Audit resolved 2026-05-19: Cohere `identity: ink` kept — the brand-badge canvas is the Command product UI (dark), not the marketing chrome (light); consistent with other AI-lab identity surfaces.
- [x] **Email / productivity (5):** Gmail, Outlook, Superhuman, HEY, Fastmail — landed in `ba99e02` (#24). Gmail/Outlook documented as product-brands under Google/Microsoft via `provenance.notes` only (no inheritance machinery).

### Lower-priority brand gaps — Wave-5 (all landed 2026-05-19)

- [x] **Gaming platforms / engines (8):** Steam/Valve, Epic Games,
      Nintendo, PlayStation, Xbox, Roblox, Unity, Unreal Engine
      — `ffd1d51` (#25)
- [x] **News / journalism (9):** NYT, Washington Post, BBC, Reuters,
      Bloomberg, The Verge, Wired, The Atlantic, ProPublica
      — `43ee387` (#26)
- [x] **Music streaming (4):** Apple Music, SoundCloud, Bandcamp, Tidal
      — `3d2dd9f` (#27). Apple Music documented as product-brand
      under existing Apple atom via provenance.notes only.
- [x] **Travel / transport (6):** Uber, Lyft, DoorDash, Booking,
      Tesla, Rivian — `f3c5a99` (#28). Tesla and Rivian dark-first.
- [x] **Education (4):** Duolingo, Coursera, Khan Academy, Codecademy
      — `71f04ca` (#29)
- [x] **Universities (5):** MIT, Stanford, Harvard, Oxford, Cambridge
      — `55b0987` (#30). Parent institution only — sub-brand schools
      deferred. MIT Red corrected to #750014 (official) from the
      initial brief's #A31F34.
- [x] **Government / civic (3):** USWDS, GOV.UK, European Digital
      Identity — `9ed379b` (#31). USWDS brand reuses existing
      `uswds@1` palette.
- [x] **Foundations / registries (5):** Apache, Linux Foundation,
      Eclipse, npm, PyPI — `6b897c5` (#32). Mozilla already in catalog.

### Font additions worth considering

- [ ] **CJK pairings:** Noto Sans CJK SC/TC/JP/KR, M+1p, Source Han variants
- [ ] **Handwriting / script:** Caveat, Patrick Hand, Indie Flower
      (only when actual demand surfaces — currently none)
- [ ] **More variable fonts:** Recursive, Asap, IBM Plex Sans Var
      (we have static), Public Sans Var
- [ ] **More display:** Yeseva One, Abril Fatface, Ultra
- [ ] **Backfill `variableAxes`** on the 11 Wave-1 fonts that predate
      the schema extension

### Palette additions worth considering

- [ ] **Accessibility / colorblind-safe:** ColorBrewer (sequential,
      diverging, qualitative), Tableau colorblind-safe, IBM Carbon
      Accessibility tokens
- [ ] **More design systems:** Adobe Spectrum (Apache-2.0; deferred
      in Wave 1 as heavier-lift)
- [ ] **More editor themes:** Material Theme (VS Code), Synthwave '84,
      Nightfox, Github Light variants
- [ ] **Print / publishing:** Pantone is off-limits; no good open-source
      print equivalent identified yet

---

## 2. Quality / consistency

### Schema / versioning audit

- [ ] **Older brands at `0.1.0`** (JMFE family) — audit against the
      current `1.0.0` pattern. Specifically: do they declare the
      `identity` role? do they have ≥5 rules? do they reference the
      correct palette + fonts?
- [ ] **Bump deserving brands to `1.0.0`** with the role and rule
      backfills.
- [ ] **`identity` role coverage** — every brand whose card on
      `/brands/` shows a single signature surface should declare
      `roles.colors.identity`. Light-first brands can fall back to
      `primary`; dark-first brands MUST declare it.

### Provenance hygiene

- [ ] Every atom has `provenance.source` URL — verify all 283 atoms.
- [ ] Every brand-atoms-authored mode (light inversions on dark-only
      palettes, etc.) is flagged in `provenance.notes` — verify.
- [ ] Hex collision check: `convergent-deep-space` and other older
      palettes vs. newer ones — confirm no slug or swatch-id
      collisions.

### Emitter completeness

- [ ] Run all 9 emitters across all 73 brands and grep for
      `[unresolved]`, `undefined`, `null`, or missing-field artifacts.
- [ ] Each emitter has a one-shot test for at least one brand.

### Asset directory policy

- [ ] All non-Convergent-Systems brands have `assets: []` — that's
      the trademark-redistribution policy. Document this choice in
      `CONTRIBUTING.md`.
- [ ] For brands whose marks are public-domain or properly licensed
      (some OSS projects publish under specific terms), evaluate
      whether to populate asset entries. Per-brand decision.

---

## 3. Infrastructure / features

### Recently shipped (this session)

- [x] `dist/index.json` catalog summary endpoint
- [x] `brandatom` Go CLI with `brands list`, `palettes list`,
      `fonts list`, `brand <slug>@<v> apply`, `brand <slug>@<v> show`
- [x] Project detection in `apply` (Tailwind, generic web, Xcode,
      Android)
- [x] brew formula at `convergent-systems-co/homebrew-tap`
- [x] Scoop manifest at `convergent-systems-co/scoop-bucket`
- [x] Cross-repo release publish workflow
      (`.github/workflows/brandatom-release.yml`)
- [x] Copy-AI-prompt button on every brand detail page
- [x] `/instructions` page

### Pending feature work

- [ ] **Brand request form** at `/request-brand`. Users submit a
      brand name + webpage URL (required) plus optional notes. Form
      opens a pre-filled GitHub issue at
      `convergent-systems-co/branding-library/issues/new`. No AI
      automation yet — manual triage.
- [ ] **AI-augmented brand documenter** — given a webpage URL, an
      agent fetches the page, extracts CSS variables + visible
      colors + fonts, and proposes a draft brand.yaml + palette atom
      for human review. Pipeline TBD.
- [ ] **`brandatom apply` for more project types:**
  - [ ] Flutter (`pubspec.yaml` + `lib/` Dart constants)
  - [ ] React Native (theme.js / `colors.ts`)
  - [ ] .NET (resource dictionary or constants)
  - [ ] Plain Bash / dotenv (color variables for shell prompts)
- [ ] **`brandatom diff <a> <b>`** — show what differs between two
      brand versions or two brands.
- [ ] **`brandatom validate <path>`** — lint a local atom YAML
      against the schema before opening a PR.

### Distribution / consumption

- [ ] **JS/TS SDK** — npm package wrapping the HTTP fetch + JSON
      parsing for Node/Bun/Deno consumers. Right now consumers
      hand-roll `fetch(...)`.
- [ ] **Python SDK** — same for Python consumers (most AI agent
      runtimes).
- [ ] **MCP server** — model context protocol surface so any
      MCP-capable AI client can fetch brands without scaffolding.
- [ ] **OG images** — auto-generated social cards per brand on the
      site (currently absent).

### Site improvements

- [ ] **Search** on `/brands`, `/palettes`, `/fonts` — currently
      linear scroll.
- [ ] **Tag filtering** — `tags` field already lives on every atom;
      surface a filter UI.
- [ ] **Diff view** — pick two brands or two versions, render
      side-by-side.
- [ ] **Mobile layout** — works but the brand-canvas previews on
      `/brands/<slug>` are dense on narrow viewports.

---

## 4. Documentation

- [x] `/instructions` page — concept overview + AI/human usage
- [x] Per-brand Copy-AI-prompt button
- [ ] **`CONTRIBUTING.md`** at repo root — how to add an atom, how
      to author rules, what counts as valid provenance, the
      trademark policy.
- [ ] **`ARCHITECTURE.md`** at repo root — encyclopedia layout,
      schema vocabulary, emitter contract, build pipeline.
- [ ] **`SECURITY.md`** — how to report a vulnerability.
- [ ] **README at repo root** — current is thin; could include the
      live counts via the dist/index.json endpoint.

---

## 5. Known issues / debt

- [ ] **Workflow test `tools/__tests__/workflow.test.ts`** — passing
      after `cd6d55e` but the assertion grammar (`no
      cloudflare/wrangler-action regression`) is brittle; rewrite
      against a less stringy contract.
- [ ] **`dist/` collision in `.gitignore`** — fixed for
      `src/brandatom/dist/` via explicit unignore. If any other
      `dist/` source dirs ever get added, they'll silently disappear
      again. Consider renaming `src/brandatom/dist/` → `src/brandatom/install/`.
- [ ] **brandatom-v0.1.0** — exists as a binaries-only release on
      GitHub from the gitignore-collision incident. Either delete or
      annotate as deprecated.
- [ ] **Older font atoms missing `variableAxes`** — Inter has it
      (backfilled), but Lato / Raleway / Proxima / Freight / Helvetica
      / Toyota-Type / the four nerd-font monos do not. Most aren't
      variable; verify and only add the field where applicable.

---

## 6. Process — who does what

Right now: **everything routes through Thomas**. Brands get added
via direct commit. Atom-quality calls happen in conversation. AI
agents draft; Thomas reviews and merges.

What completion needs:

- [ ] **External contributor flow** — Issue → triaged by Thomas →
      draft brand.yaml by AI → human review → PR → merge.
- [ ] **Automated provenance verification** — when a brand atom
      lands, CI fetches the `provenance.source` URL and confirms it
      resolves (not a deep semantic check, just a 200 OK).
- [ ] **Owner labels** on issues so requests don't pile up
      unattributed.

---

## 7. Definition of "done" for each section

| Section | "Done" looks like |
|---|---|
| Catalog expansion | All "high-value brand gaps" landed. Lower-priority left as ongoing. |
| Quality / consistency | All older brands audited and at ≥1.0.0; all atoms validated against current schema. |
| Infrastructure | Brand request form live; AI documenter pipeline shipped; SDKs in npm + PyPI; MCP server published. |
| Documentation | CONTRIBUTING.md + ARCHITECTURE.md exist and are honest; root README is current. |
| Known issues | All items in §5 closed or filed as accepted-and-deferred. |

When all five rows are done, the encyclopedia is _complete_ in the
sense that matters: it's broad enough to be useful, consistent enough
to be trusted, contributable enough to outgrow its original
maintainers, and consumable enough to slot into real workflows.

---

_File maintained by hand; update when items move._
