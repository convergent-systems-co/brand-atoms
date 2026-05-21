# CLOUDFLARE_API_TOKEN from env, never in code. See ~/.ai/Common.md §4.
# Required token scopes: Account → Cloudflare Pages (Edit).
provider "cloudflare" {}
