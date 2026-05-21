# Direct-upload Pages project. Deployments arrive via `wrangler pages
# deploy` from a CI workflow — no Git-source binding.
resource "cloudflare_pages_project" "this" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch
}
