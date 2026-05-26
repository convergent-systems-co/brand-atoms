# Shell Brand Extension Spec — `brands/shell/`

**Status:** Draft — atoms-spec upstream PR pending  
**Schema:** `schemas/shell-brand-v1.json`  
**Atom subtype:** `brands/shell/<id>.yaml`

## Overview

The `brands/shell/` extension introduces a new atom subtype for terminal shell theming.
Each shell brand atom extends a general brand identity with shell-specific bindings
consumed by [aish](https://github.com/convergent-systems-co/aish):

- Prompt symbol and powerline separator character
- Semantic role bindings (primary, accent, error, warning, success, muted) as `#RRGGBB`
  hex values, used to generate ANSI escape sequences at render time
- Terminal color support declarations (256-color / truecolor)

## File location

```
brands/shell/<id>.yaml
```

`<id>` must be a lowercase slug matching `^[a-z0-9-]+$` and MUST match the filename
without the `.yaml` extension.

## Schema

All shell brand YAML files are validated against `schemas/shell-brand-v1.json`
(JSON Schema draft/2020-12).

## Required fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique slug, matches filename |
| `name` | `string` | Human-readable display name |
| `version` | `string` | SemVer (e.g. `1.0.0`) |
| `base_brand` | `string` | ID of the base brand this extends (informational; not cross-validated) |
| `prompt_symbol` | `string` | Shell prompt symbol (e.g. `❯`, `➜`, `$`) |
| `separator_char` | `string` | Powerline separator char; empty string for none |
| `ansi_256_support` | `boolean` | Supports xterm-256color |
| `truecolor_support` | `boolean` | Supports 24-bit color |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `description` | `string` | Prose description |
| `role_bindings` | `object` | Semantic role → `#RRGGBB` hex value |
| `tags` | `string[]` | Discovery tags |
| `license` | `string` | SPDX license identifier |

## role_bindings

Role bindings map semantic shell roles to exact `#RRGGBB` hex values. These are
used by aish to generate the appropriate ANSI escape sequences for the active
terminal's color depth.

| Role | Usage |
|---|---|
| `primary` | Active prompt segment, current directory |
| `accent` | Git branch indicator, highlights |
| `error` | Non-zero exit code, error output |
| `warning` | Dirty git state, stash indicator |
| `success` | Zero exit code, clean git state |
| `muted` | Timestamps, secondary path segments |

Additional custom roles may be added as needed; all values must be `#RRGGBB`.

## Relationship to base brands

The `base_brand` field is a string reference to a brand-atoms brand ID. It is
informational — aish uses it to resolve brand context (colors, fonts, glyphs)
when rendering richer shell themes. It does not require the base brand to exist
as a `brands/<id>/` catalog entry; community themes (nord, dracula, etc.) are
valid `base_brand` references.

## Example

```yaml
id: nord
name: Nord Shell
version: 1.0.0
description: Nord color scheme optimized for terminal shell use with aish
base_brand: nord
prompt_symbol: "❯"
separator_char: ""
ansi_256_support: true
truecolor_support: true
role_bindings:
  primary: "#88c0d0"
  accent: "#81a1c1"
  error: "#bf616a"
  warning: "#ebcb8b"
  success: "#a3be8c"
  muted: "#616e88"
tags: [nord, dark, minimal, clean]
license: MIT
```

## atoms-spec PR

A formal PR to the upstream `atoms-spec` repository defining `brands/shell/` as
a first-class atom subtype is pending. This document serves as the source-of-truth
specification until that PR lands.

**Tracking:** convergent-systems-co/brand-atoms#35
