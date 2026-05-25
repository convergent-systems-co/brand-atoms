# Direct-upload Pages project. Deployments come from wrangler pages deploy
# in .github/workflows/deploy.yml — not from a Pages-managed Git integration.
resource "cloudflare_pages_project" "this" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch
}
