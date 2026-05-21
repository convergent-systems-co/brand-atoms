output "project_name" {
  description = "Cloudflare Pages project name."
  value       = cloudflare_pages_project.this.name
}

output "subdomain" {
  description = "Default Pages subdomain (e.g., brand-atoms.pages.dev)."
  value       = cloudflare_pages_project.this.subdomain
}

output "created_on" {
  description = "Project creation timestamp."
  value       = cloudflare_pages_project.this.created_on
}
