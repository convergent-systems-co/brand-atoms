#!/usr/bin/env tsx
/**
 * tools/r2-mirror.ts
 *
 * Civilization-grade durable mirror of font binaries on Cloudflare R2.
 *
 *  1. Ensures the R2 bucket exists (creates if missing).
 *  2. Attempts to attach `cdn.brand-atoms.com` as a custom domain (graceful
 *     degrade if the API token lacks the right permission).
 *  3. For each font atom under `fonts/`:
 *      - Downloads the upstream archive named in `provenance.notes`.
 *      - Extracts the relevant `*.woff2` / `*.ttf` files.
 *      - Uploads each to R2 at `fonts/<slug>/<version>/<filename>`.
 *      - Idempotency: HEAD-then-PUT, skipped if size matches existing object.
 *      - Mutates atom.yaml in-place, populating `cdnUrls: { <filename>: <url> }`.
 *
 * CLI:
 *   pnpm mirror:r2                  # live run against the configured account
 *   pnpm mirror:r2 --dry-run        # print planned uploads, do nothing
 *   pnpm mirror:r2 --only=inter     # mirror just one font slug
 *
 * Auth: reads `CSO_CF_TOKEN` from env. Wrap with `zsh -ic 'pnpm mirror:r2'`
 * to pick it up from the 1Password-backed shell config.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { parseDocument } from 'yaml';

// ---------------------------------------------------------------------------
// Constants — change these and you change the deployment target.
// ---------------------------------------------------------------------------

export const ACCOUNT_ID = 'e1fe0f0ce8ff18da4edc118372c30022';
export const BUCKET_NAME = 'brand-atoms-cdn';
export const CUSTOM_DOMAIN = 'cdn.brand-atoms.com';
export const ZONE_ID = '27e45e4614bd806907c5623a590bd675';
export const FONTS_DIR_DEFAULT = 'fonts';

// ---------------------------------------------------------------------------
// Per-font mirror configuration. Keyed by font slug.
//
// The `pick` function takes the file's path inside the archive and returns
// either a target filename (= mirror this) or null (= skip).
//
// This is hard-coded rather than parsed from the YAML because the YAML's
// `provenance.notes` is free-form text — derivable, but fragile.
// ---------------------------------------------------------------------------

export type FontMirrorConfig = {
  slug: string;
  archiveUrl: string;
  archiveType: 'zip';
  pick: (pathInArchive: string) => string | null;
};

export const FONT_MIRROR_CONFIGS: ReadonlyArray<FontMirrorConfig> = [
  {
    slug: 'inter',
    archiveUrl: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
    archiveType: 'zip',
    pick: (p) => {
      const base = p.split('/').pop() ?? '';
      // Inter-4.1.zip ships the variable woff2 binaries; we mirror just those
      // (skip per-weight static files — variable handles the full range).
      if (/^InterVariable(-Italic)?\.woff2$/.test(base)) return base;
      return null;
    },
  },
  {
    slug: 'firacode-nerdfont',
    archiveUrl: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/FiraCode.zip',
    archiveType: 'zip',
    pick: (p) => {
      const base = p.split('/').pop() ?? '';
      // Mirror the "Mono"-variant Nerd Font ttf files (terminal-friendly width).
      if (/^FiraCodeNerdFontMono-[A-Za-z]+\.ttf$/.test(base)) return base;
      return null;
    },
  },
  {
    slug: 'jetbrainsmono-nerdfont',
    archiveUrl:
      'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/JetBrainsMono.zip',
    archiveType: 'zip',
    pick: (p) => {
      const base = p.split('/').pop() ?? '';
      if (/^JetBrainsMonoNerdFontMono-[A-Za-z]+\.ttf$/.test(base)) return base;
      return null;
    },
  },
  {
    slug: 'hack-nerdfont',
    archiveUrl: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/Hack.zip',
    archiveType: 'zip',
    pick: (p) => {
      const base = p.split('/').pop() ?? '';
      if (/^HackNerdFontMono-[A-Za-z]+\.ttf$/.test(base)) return base;
      return null;
    },
  },
  {
    slug: 'cascadiacode-nerdfont',
    archiveUrl: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/CascadiaCode.zip',
    archiveType: 'zip',
    pick: (p) => {
      const base = p.split('/').pop() ?? '';
      if (/^CaskaydiaCoveNerdFontMono-[A-Za-z]+\.ttf$/.test(base)) return base;
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// Pluggable R2 client interface. Production impl uses Cloudflare's HTTP API
// directly. Tests inject a fake to verify idempotency and dry-run behaviour.
// ---------------------------------------------------------------------------

export type R2HeadResult = { exists: boolean; size?: number };

export interface R2Client {
  bucketExists(name: string): Promise<boolean>;
  createBucket(name: string): Promise<void>;
  headObject(bucket: string, key: string): Promise<R2HeadResult>;
  putObject(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void>;
  attachCustomDomain(
    bucket: string,
    domain: string,
    zoneId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
  publicBaseUrl(bucket: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Cloudflare API client (the production implementation).
// ---------------------------------------------------------------------------

export class CloudflareR2Client implements R2Client {
  constructor(
    private readonly accountId: string,
    private readonly token: string,
  ) {}

  private get baseUrl(): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  async bucketExists(name: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/r2/buckets`, { headers: this.headers });
    if (!res.ok) throw new Error(`R2 list buckets failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { result: { buckets: Array<{ name: string }> } };
    return body.result.buckets.some((b) => b.name === name);
  }

  async createBucket(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/r2/buckets`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`R2 create bucket failed: ${res.status} ${await res.text()}`);
    }
  }

  async headObject(bucket: string, key: string): Promise<R2HeadResult> {
    const url = `${this.baseUrl}/r2/buckets/${bucket}/objects/${encodeKey(key)}`;
    const res = await fetch(url, { method: 'HEAD', headers: this.headers });
    if (res.status === 404) return { exists: false };
    if (!res.ok) throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
    const len = res.headers.get('content-length');
    return len ? { exists: true, size: Number(len) } : { exists: true };
  }

  async putObject(
    bucket: string,
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/r2/buckets/${bucket}/objects/${encodeKey(key)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers, 'Content-Type': contentType },
      body,
    });
    if (!res.ok) {
      throw new Error(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`);
    }
  }

  async attachCustomDomain(
    bucket: string,
    domain: string,
    zoneId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const url = `${this.baseUrl}/r2/buckets/${bucket}/custom_domains`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, zoneId, enabled: true }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    // 409 ⇒ already attached (acceptable). Otherwise surface the reason.
    if (res.status === 409 || /already exists/i.test(text)) return { ok: true };
    return { ok: false, reason: `${res.status} ${text}` };
  }

  async publicBaseUrl(bucket: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/r2/buckets/${bucket}/custom_domains`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { domains?: Array<{ domain: string; enabled?: boolean }> };
    };
    const domains = body.result?.domains ?? [];
    const ours = domains.find((d) => d.domain === CUSTOM_DOMAIN);
    if (ours) return `https://${ours.domain}`;
    return null;
  }
}

const encodeKey = (key: string): string =>
  key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

// ---------------------------------------------------------------------------
// Core mirroring logic (pure, side-effect-free w.r.t. injected client/fs).
// ---------------------------------------------------------------------------

export type PlannedUpload = {
  slug: string;
  version: string;
  filename: string;
  key: string;
  size: number;
};

export type MirrorResult = {
  bucketCreated: boolean;
  customDomain: 'attached' | 'pre-existing' | 'blocked';
  customDomainReason?: string;
  publicBaseUrl: string;
  uploads: Array<PlannedUpload & { action: 'put' | 'skip-head-match' }>;
  perSlug: Record<string, { version: string; cdnUrls: Record<string, string> }>;
};

export type MirrorOptions = {
  client: R2Client;
  fontsDir: string;
  dryRun: boolean;
  only?: string;
  fetch?: (url: string) => Promise<Uint8Array>;
  log?: (msg: string) => void;
  configs?: ReadonlyArray<FontMirrorConfig>;
};

export const defaultFetcher = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${url} → ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
};

export const extractZip = (
  archive: Uint8Array,
  pick: (path: string) => string | null,
): Map<string, Uint8Array> => {
  const all = unzipSync(archive);
  const out = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(all)) {
    const picked = pick(path);
    if (picked) out.set(picked, bytes);
  }
  return out;
};

export const contentTypeFor = (filename: string): string => {
  if (filename.endsWith('.woff2')) return 'font/woff2';
  if (filename.endsWith('.woff')) return 'font/woff';
  if (filename.endsWith('.ttf')) return 'font/ttf';
  if (filename.endsWith('.otf')) return 'font/otf';
  return 'application/octet-stream';
};

const listSlugVersions = (fontsDir: string): Array<{ slug: string; version: string }> => {
  const out: Array<{ slug: string; version: string }> = [];
  if (!existsSync(fontsDir)) return out;
  for (const slug of readdirSync(fontsDir, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const slugDir = join(fontsDir, slug.name);
    for (const ver of readdirSync(slugDir, { withFileTypes: true })) {
      if (!ver.isDirectory()) continue;
      if (existsSync(join(slugDir, ver.name, 'atom.yaml'))) {
        out.push({ slug: slug.name, version: ver.name });
      }
    }
  }
  return out;
};

export const runMirror = async (opts: MirrorOptions): Promise<MirrorResult> => {
  const log = opts.log ?? ((m: string) => console.log(m));
  const fetcher = opts.fetch ?? defaultFetcher;
  const configs = opts.configs ?? FONT_MIRROR_CONFIGS;

  const result: MirrorResult = {
    bucketCreated: false,
    customDomain: 'blocked',
    publicBaseUrl: `https://${CUSTOM_DOMAIN}`,
    uploads: [],
    perSlug: {},
  };

  // 1. Ensure bucket.
  const exists = await opts.client.bucketExists(BUCKET_NAME);
  if (!exists) {
    if (opts.dryRun) {
      log(`[dry-run] would create bucket ${BUCKET_NAME}`);
    } else {
      log(`creating bucket ${BUCKET_NAME}`);
      await opts.client.createBucket(BUCKET_NAME);
      result.bucketCreated = true;
    }
  } else {
    log(`bucket ${BUCKET_NAME} exists`);
  }

  // 2. Custom domain.
  if (opts.dryRun) {
    log(`[dry-run] would attach custom domain ${CUSTOM_DOMAIN}`);
    result.customDomain = 'attached';
  } else {
    // We *do* want to swallow errors here — publicBaseUrl is a probe, not a
    // mandatory step. A failure means "treat as not pre-existing" and proceed
    // to attachCustomDomain, whose own error handling reports the real blocker.
    const existingBase = await opts.client.publicBaseUrl(BUCKET_NAME).catch((err) => {
      log(`note: publicBaseUrl probe failed (${(err as Error).message}); will try attach`);
      return null;
    });
    if (existingBase) {
      log(`custom domain ${CUSTOM_DOMAIN} pre-existing`);
      result.customDomain = 'pre-existing';
      result.publicBaseUrl = existingBase;
    } else {
      const res = await opts.client.attachCustomDomain(BUCKET_NAME, CUSTOM_DOMAIN, ZONE_ID);
      if (res.ok) {
        log(`custom domain ${CUSTOM_DOMAIN} attached`);
        result.customDomain = 'attached';
      } else {
        log(`custom domain ${CUSTOM_DOMAIN} BLOCKED: ${res.reason}`);
        result.customDomain = 'blocked';
        result.customDomainReason = res.reason;
      }
    }
  }

  // 3. Per-font mirror.
  const slugVersions = listSlugVersions(opts.fontsDir);
  for (const cfg of configs) {
    if (opts.only && opts.only !== cfg.slug) continue;
    const sv = slugVersions.find((s) => s.slug === cfg.slug);
    if (!sv) {
      log(`skip ${cfg.slug}: no atom.yaml found under ${opts.fontsDir}`);
      continue;
    }
    log(`==> ${cfg.slug}@${sv.version}`);
    log(`    download ${cfg.archiveUrl}`);
    const archive = await fetcher(cfg.archiveUrl);
    log(`    archive: ${archive.byteLength} bytes`);
    const files = extractZip(archive, cfg.pick);
    log(`    extracted ${files.size} files`);

    const cdnUrls: Record<string, string> = {};
    for (const [filename, bytes] of files) {
      const key = `fonts/${cfg.slug}/${sv.version}/${filename}`;
      const head = opts.dryRun ? { exists: false } : await opts.client.headObject(BUCKET_NAME, key);

      const url = `${result.publicBaseUrl}/${key}`;
      cdnUrls[filename] = url;

      if (head.exists && head.size === bytes.byteLength) {
        log(`    SKIP ${key} (HEAD size match: ${head.size})`);
        result.uploads.push({
          slug: cfg.slug,
          version: sv.version,
          filename,
          key,
          size: bytes.byteLength,
          action: 'skip-head-match',
        });
      } else {
        if (opts.dryRun) {
          log(`    [dry-run] PUT ${key} (${bytes.byteLength} bytes)`);
        } else {
          log(`    PUT  ${key} (${bytes.byteLength} bytes)`);
          await opts.client.putObject(BUCKET_NAME, key, bytes, contentTypeFor(filename));
        }
        result.uploads.push({
          slug: cfg.slug,
          version: sv.version,
          filename,
          key,
          size: bytes.byteLength,
          action: 'put',
        });
      }
    }

    result.perSlug[cfg.slug] = { version: sv.version, cdnUrls };
  }

  return result;
};

// ---------------------------------------------------------------------------
// YAML mutation helper. Round-trips via `yaml` lib's Document AST so comments
// and existing key ordering are preserved.
// ---------------------------------------------------------------------------

export const updateAtomYamlWithCdnUrls = (
  atomYamlPath: string,
  cdnUrls: Record<string, string>,
): void => {
  const text = readFileSync(atomYamlPath, 'utf8');
  const doc = parseDocument(text);
  doc.set('cdnUrls', cdnUrls);
  writeFileSync(atomYamlPath, doc.toString({ lineWidth: 0 }));
};

// ---------------------------------------------------------------------------
// Validation helper used as a safety net: confirm the *configured* slug list
// matches what's on disk so we never silently skip a font.
// ---------------------------------------------------------------------------

export const validateConfigCoverage = (
  fontsDir: string,
  configs: ReadonlyArray<FontMirrorConfig> = FONT_MIRROR_CONFIGS,
): { ok: boolean; missing: string[]; extra: string[] } => {
  const onDisk = new Set(listSlugVersions(fontsDir).map((s) => s.slug));
  const configured = new Set(configs.map((c) => c.slug));
  const missing = [...onDisk].filter((s) => !configured.has(s));
  const extra = [...configured].filter((s) => !onDisk.has(s));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
};

// ---------------------------------------------------------------------------
// CLI entry. Skipped when this file is imported (e.g., by tests).
// ---------------------------------------------------------------------------

const parseArgs = (argv: string[]): { dryRun: boolean; only?: string } => {
  const out: { dryRun: boolean; only?: string } = { dryRun: false };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--only=')) out.only = a.slice('--only='.length);
  }
  return out;
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.CSO_CF_TOKEN;
  if (!token) {
    console.error('CSO_CF_TOKEN not set. Run via: zsh -ic "pnpm mirror:r2"');
    process.exit(2);
  }

  const fontsDir = join(process.cwd(), FONTS_DIR_DEFAULT);
  const coverage = validateConfigCoverage(fontsDir);
  if (!coverage.ok) {
    console.error('Font config coverage mismatch:', coverage);
    process.exit(3);
  }

  const client = new CloudflareR2Client(ACCOUNT_ID, token);
  const result = await runMirror({
    client,
    fontsDir,
    dryRun: args.dryRun,
    ...(args.only !== undefined ? { only: args.only } : {}),
  });

  if (!args.dryRun) {
    // Mutate the YAMLs with cdnUrls (only for slugs we actually mirrored).
    for (const [slug, info] of Object.entries(result.perSlug)) {
      const atomPath = join(fontsDir, slug, info.version, 'atom.yaml');
      updateAtomYamlWithCdnUrls(atomPath, info.cdnUrls);
      console.log(`wrote cdnUrls to ${atomPath}`);
    }
  }

  console.log('\n=== mirror summary ===');
  console.log(`bucket created:    ${result.bucketCreated}`);
  console.log(`custom domain:     ${result.customDomain}`);
  if (result.customDomainReason) {
    console.log(`custom domain reason: ${result.customDomainReason}`);
  }
  console.log(`public base URL:   ${result.publicBaseUrl}`);
  const puts = result.uploads.filter((u) => u.action === 'put').length;
  const skips = result.uploads.filter((u) => u.action === 'skip-head-match').length;
  console.log(`uploads: ${puts} put / ${skips} skip-head-match`);
  console.log(`slugs touched: ${Object.keys(result.perSlug).join(', ') || '(none)'}`);
};

const isDirectInvocation = Boolean(process.argv[1]?.endsWith('r2-mirror.ts'));
if (isDirectInvocation) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
