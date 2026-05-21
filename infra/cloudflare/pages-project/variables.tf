variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Pages project."
  type        = string
}

variable "project_name" {
  description = "Cloudflare Pages project name. Default URL: https://<project_name>.pages.dev."
  type        = string
  default     = "brand-atoms"
}

variable "production_branch" {
  description = "Branch that triggers production deployments."
  type        = string
  default     = "main"
}
