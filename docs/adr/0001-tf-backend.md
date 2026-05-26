# 0001 — Terraform Remote State Backend

**Status:** Accepted  
**Date:** 2026-05-26

## Context

This repo uses Terraform to manage its Cloudflare Pages project and associated infrastructure. State must be stored remotely so CI runners and contributors can share it without conflicts.

## Decision

Use the shared `cs-tfstate` Cloudflare R2 bucket as the Terraform backend (S3-compatible API). One state file per environment, keyed as `state-bucket/convergent-systems-co/brand-atoms/<env>/terraform.tfstate`. CI runners authenticate via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` repo secrets mapped to R2 API tokens.

## Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| HCP Terraform | Managed locking, UI | Extra vendor, separate account | Rejected |
| AWS S3 + DynamoDB | Battle-tested | Introduces AWS dep in Cloudflare-native project | Rejected |
| Cloudflare R2 (chosen) | Colocated, S3-compatible, no extra vendor | Needs R2 token in secrets | Accepted |

## Consequences

- State is stored in Cloudflare R2, colocated with Cloudflare Pages and DNS resources.
- CI needs `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` configured as repo secrets (R2 API tokens with Object Read/Write on `cs-tfstate`).
- `terraform init` requires these credentials; local developers must `source .env` or use `direnv`.
- Lock file (`use_lockfile = true`) prevents concurrent applies.
