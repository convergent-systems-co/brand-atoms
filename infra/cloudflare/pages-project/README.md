# brand-atoms — Cloudflare Pages Project

Manages the `brand-atoms` Cloudflare Pages project via OpenTofu.

## Usage

```bash
cd infra/cloudflare/pages-project
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with the Cloudflare account ID
source ~/.env/convergent-systems.co/.env
tofu init
tofu plan
tofu apply
```

## State

R2 bucket: `cs-tfstate`
Key: `state-bucket/convergent-systems-co/brand-atoms/pages-project.tfstate`

## Import existing project

If the Pages project already exists in Cloudflare:

```bash
tofu import cloudflare_pages_project.this <account_id>/brand-atoms
```
