# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial template scaffold: Astro 6 (TypeScript, static) at `web/site/`,
  Cloudflare Pages deploy workflow, Terraform Cloudflare provider stubs in
  `infra/terraform/envs/{dev,stg,prod}/`, the same standards machinery as
  `convergent-systems-co/go-tf-app-template` (bootstrap, label sync, triage,
  secret scan, ADRs, MADR, Code of Conduct, AGPL-3.0).
