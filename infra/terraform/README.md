# Terraform Infrastructure

## Layout

- `modules/` — reusable modules
- `envs/{dev,stg,prod}/` — one terraform root per environment

## Usage

```
make tf-init  ENV=dev
make tf-plan  ENV=dev
make tf-apply ENV=dev
```

## Backend

`backend.tf` ships as a stub. Replace with S3, HCP, or Azure during seed
issue #3.
