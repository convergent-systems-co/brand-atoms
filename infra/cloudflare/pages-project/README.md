# infra/cloudflare/pages-project

Terraform module that captures the Cloudflare Pages project `brand-atoms` deploys to. The project pre-existed this module — captured via `tofu import` rather than created.

## Audience

Contributor recovering the project after deletion, or aligning manual configuration with the declared spec.

## What this manages

A single `cloudflare_pages_project` named `brand-atoms` with production branch `main`. Deployments arrive via `wrangler pages deploy` from CI — no Git-source binding here.

## Prerequisites

- OpenTofu or Terraform `>= 1.6.0`.
- AWS-compatible credentials for the `cs-tfstate` R2 backend (from `~/.env/convergent-systems.co/.env` via `eval "$(cat …)"`).
- `CLOUDFLARE_API_TOKEN` exported with `Cloudflare Pages — Edit` scope.
- convergent-systems-co Cloudflare account ID (FIFO var `CLOUDFLARE_ACCOUNT_ID`).

## Apply

```bash
cd infra/cloudflare/pages-project
set -a
eval "$(cat ~/.env/convergent-systems.co/.env)"
set +a
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_ACCOUNT_TOKEN"
export TF_VAR_cloudflare_account_id="$CLOUDFLARE_ACCOUNT_ID"

tofu init
tofu plan       # expect: no changes
tofu apply -auto-approve   # only if plan shows changes
```

## State

```
s3://cs-tfstate/state-bucket/convergent-systems-co/brand-atoms/pages-project.tfstate
```

## Initial import

The project was created out-of-band before this module landed. It was imported via:

```bash
tofu import cloudflare_pages_project.this $CLOUDFLARE_ACCOUNT_ID/brand-atoms
```

After import, `tofu plan` should report no changes. If it shows a diff, either the project drifted from the declared spec, or the spec needs adjustment — investigate before applying.

## Destroy

Don't destroy this project — it serves production traffic. If you must, remove the custom domain attachment first.
