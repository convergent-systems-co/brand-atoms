terraform {
  backend "s3" {
    bucket = "cs-tfstate"
    key    = "state-bucket/convergent-systems-co/brand-atoms/pages-project.tfstate"
    region = "auto"
    endpoints = {
      s3 = "https://e1fe0f0ce8ff18da4edc118372c30022.r2.cloudflarestorage.com"
    }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = false
    use_lockfile                = true
  }
}
