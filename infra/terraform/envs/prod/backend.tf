# Replace this stub during seed issue #3.
# Recommended: R2 (S3-compatible) + lock, or HCP Terraform.
#
# terraform {
#   backend "s3" {
#     bucket                      = "REPLACE-ME-tfstate"
#     key                         = "astro-tf-app-template/prod/terraform.tfstate"
#     region                      = "auto"
#     endpoints                   = { s3 = "https://<accountid>.r2.cloudflarestorage.com" }
#     skip_credentials_validation = true
#     skip_region_validation      = true
#     skip_metadata_api_check     = true
#     skip_requesting_account_id  = true
#     use_path_style              = true
#   }
# }
