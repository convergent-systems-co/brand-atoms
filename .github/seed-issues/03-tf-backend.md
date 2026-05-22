---
title: "Initialize Terraform remote state backend"
labels: ["kind/chore", "area/infra", "priority/high", "status/triage"]
---

## Context

`infra/terraform/envs/{dev,stg,prod}/backend.tf` ships as a stub. The
recommended backend for Cloudflare-centric projects is **Cloudflare R2**
(S3-compatible) — the stub already includes a commented R2 block. HCP
Terraform or AWS S3+DynamoDB are also acceptable.

## Acceptance criteria

- [ ] Backend bucket / workspace exists for each env
- [ ] `backend.tf` is filled in for `dev`, `stg`, `prod`
- [ ] `make tf-init ENV=dev` succeeds
- [ ] Backend choice recorded as ADR (`docs/adr/0001-tf-backend.md`)
- [ ] CI has backend credentials configured (OIDC where supported; otherwise least-privilege scoped tokens in repo secrets)
