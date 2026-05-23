terraform {
  required_version = ">= 1.7.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Multi-provider setup: this module touches account-level Pages resources
# and zone-level DNS records. After the 2026-05-23 core-infra token split,
# each plane has its own narrow API token (see ~/.ai/Common.md §4 and
# convergent-systems-co/core-infra/terraform/cloudflare/{account,dns}-token).
#
# Tokens passed in as sensitive TF variables. Populate from 1Password before
# apply (see variables below) or via the cs-tofu wrapper at
# convergent-systems-co/core-infra/scripts/cs-tofu.

provider "cloudflare" {
  alias     = "account"
  api_token = var.account_token
}

provider "cloudflare" {
  alias     = "dns"
  api_token = var.dns_token
}

# --- Pages project + custom domain (account-scoped) -------------------------

resource "cloudflare_pages_project" "this" {
  provider          = cloudflare.account
  account_id        = var.cloudflare_account_id
  name              = "brand-atoms"
  production_branch = "main"
}

resource "cloudflare_pages_domain" "custom" {
  provider     = cloudflare.account
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.this.name
  name         = "brand-atoms.com"
}

# --- DNS record at the zone apex (zone-scoped) ------------------------------

resource "cloudflare_dns_record" "pages_cname" {
  provider = cloudflare.dns
  zone_id  = var.zone_id
  name     = "brand-atoms.com"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.this.name}.pages.dev"
  proxied  = true
  ttl      = 1 # 1 = "auto" — required when proxied

  comment = "Cloudflare Pages apex — managed by terraform"

  depends_on = [cloudflare_pages_domain.custom]
}

# --- Inputs -----------------------------------------------------------------

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Pages project."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID for brand-atoms.com."
  type        = string
}

variable "account_token" {
  description = "Cloudflare API token with Account Pages Edit scope. Minted by terraform/cloudflare/account-token in core-infra. Populate from 'Convergent Systems - Account' in 1Password Developer vault."
  type        = string
  sensitive   = true
}

variable "dns_token" {
  description = "Cloudflare API token with Zone DNS Edit scope. Minted by terraform/cloudflare/dns-token in core-infra. Populate from 'Convergent Systems - DNS' in 1Password Developer vault."
  type        = string
  sensitive   = true
}

# --- Outputs ----------------------------------------------------------------

output "project_name" {
  value = cloudflare_pages_project.this.name
}

output "subdomain" {
  value       = cloudflare_pages_project.this.subdomain
  description = "Default *.pages.dev hostname for the project."
}

output "custom_domain" {
  value       = cloudflare_pages_domain.custom.name
  description = "Apex custom domain attached to the Pages project."
}

# --- State imports ----------------------------------------------------------
# Existing resources created out-of-band (wrangler, dashboard, or direct API
# calls during the 2026-05-23 token-split rollout). Import them into state so
# terraform manages them going forward without destroy-and-create.

import {
  to = cloudflare_pages_project.this
  id = "e1fe0f0ce8ff18da4edc118372c30022/brand-atoms"
}

import {
  to = cloudflare_pages_domain.custom
  id = "e1fe0f0ce8ff18da4edc118372c30022/brand-atoms/brand-atoms.com"
}

import {
  to = cloudflare_dns_record.pages_cname
  id = "27e45e4614bd806907c5623a590bd675/0b465ecbeda482229fad2c2a00050175"
}
