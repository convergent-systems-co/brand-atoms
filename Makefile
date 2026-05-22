# Defaults
ENV       ?= dev
NPM       ?= npm

.PHONY: help install dev build check preview tf-init tf-plan tf-apply tf-fmt fmt clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## npm ci in the active site
	cd web && $(NPM) ci

dev: ## Run the site's dev server
	cd web && $(NPM) run dev

build: ## Build the active site into web/<site>/dist
	cd web && $(NPM) run build

check: ## Astro check (type + diagnostics) on the active site
	cd web && $(NPM) run check

preview: ## Preview the production build locally
	cd web && $(NPM) run preview

tf-init: ## terraform init for the selected env
	cd infra/terraform/envs/$(ENV) && terraform init

tf-plan: ## terraform plan for the selected env
	cd infra/terraform/envs/$(ENV) && terraform plan

tf-apply: ## terraform apply for the selected env
	cd infra/terraform/envs/$(ENV) && terraform apply

tf-fmt: ## terraform fmt over infra/
	terraform fmt -recursive infra/

fmt: tf-fmt ## Format everything (currently TF only)

clean: ## Remove site build output
	rm -rf web/$(SITE)/dist web/$(SITE)/.astro
