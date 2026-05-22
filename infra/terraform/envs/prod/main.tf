terraform {
  required_version = ">= 1.7.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# CLOUDFLARE_API_TOKEN must be exported in the runner's environment.
provider "cloudflare" {}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID."
}

variable "project_name" {
  type        = string
  description = "Cloudflare Pages project name."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Branch that Cloudflare Pages treats as production."
}

# Replace with the real GitHub repo coordinates during bootstrap.
resource "cloudflare_pages_project" "site" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "web/site"
  }
}

output "subdomain" {
  value       = cloudflare_pages_project.site.subdomain
  description = "Default *.pages.dev hostname for the project."
}
