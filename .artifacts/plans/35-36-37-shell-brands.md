# Plan: Shell Brand Extension — Issues #35, #36, #37

## 1. Intent

Introduce `brands/shell/` as a new atom subtype in brand-atoms, add a JSON Schema for shell
brand extension YAML files, migrate the three existing dev-aesthetic brands (nord, dracula,
gruvbox) to shell extensions, and ship seven additional curated shell brands covering the
most-common terminal color schemes used with aish.

## 2. Plan

### Step 1 — Schema: `schemas/shell-brand-v1.json` (#35)
- Create `schemas/shell-brand-v1.json` — JSON Schema (draft/2020-12) defining the shell brand
  extension structure: id, name, version, description, base_brand, prompt_symbol,
  separator_char, ansi_256_support, truecolor_support, role_bindings, tags, license.
- Create `docs/shell-brand-spec.md` — human-readable specification describing the
  `brands/shell/` extension, its intent, required fields, and relationship to base brands.
  Note: atoms-spec PR to upstream is pending and out of scope for this branch.

### Step 2 — TDD: Validation tests (#35, #36, #37)
- Create `tools/__tests__/shell-brand.test.ts` with assertions:
  1. Each `brands/shell/*.yaml` file is valid YAML (parseable).
  2. Each shell brand has required fields: id, name, version, base_brand, prompt_symbol,
     separator_char, ansi_256_support, truecolor_support.
  3. Hex color values in role_bindings match `#RRGGBB` pattern.
  4. id matches `^[a-z0-9-]+$` slug pattern.
  5. Schema file `schemas/shell-brand-v1.json` is valid JSON.

### Step 3 — Migrate 3 existing brands (#36)
- Create `brands/shell/nord.yaml`
- Create `brands/shell/dracula.yaml`
- Create `brands/shell/gruvbox.yaml`

Note: nord, dracula, and gruvbox are NOT currently in `brands/` as base brand atoms —
they are dev-aesthetic terminal themes, not corporate brands. The `base_brand` field in
the shell extension is a reference string (not a validated cross-reference to `brands/`),
so these shell extensions stand alone.

### Step 4 — Add 7 new curated shell brands (#37)
- `brands/shell/catppuccin-mocha.yaml`
- `brands/shell/catppuccin-latte.yaml`
- `brands/shell/solarized-dark.yaml`
- `brands/shell/solarized-light.yaml`
- `brands/shell/tokyo-night.yaml`
- `brands/shell/one-dark.yaml`
- `brands/shell/monokai.yaml`

## 3. Risks

- The existing `pnpm validate` tool only processes `brands/<slug>/<version>/brand.yaml`.
  Shell brands at `brands/shell/*.yaml` will NOT be processed by validate.ts — they use a
  different schema and path. The test suite uses a dedicated test file for shell brand
  validation, not the existing validate.ts runner.
- nord, dracula, gruvbox are not in the brands/ catalog (confirmed by directory listing).
  base_brand is a string reference only — no cross-repo validation.
- Rollback: all changes are additive (new files only). No existing files are modified.

## 4. Verification

```bash
# Confirm all 10 shell YAML files exist and are parseable
node -e "
  const fs = require('fs');
  const yaml = require('yaml');
  const files = fs.readdirSync('brands/shell').filter(f => f.endsWith('.yaml'));
  files.forEach(f => { yaml.parse(fs.readFileSync('brands/shell/' + f, 'utf8')); console.log('OK:', f); });
"

# Run the new test suite
pnpm test

# Confirm existing validation still passes
pnpm validate
```

## 5. Out of scope

- Upstream atoms-spec PR (tracked as separate follow-up).
- Adding nord/dracula/gruvbox as full base brand atoms (separate task).
- CI/CD pipeline changes.
- Validate.ts integration for shell brands (validate.ts is for palette/font/brand atoms only).
