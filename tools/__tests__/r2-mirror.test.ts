import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
/**
 * Tests for tools/r2-mirror.ts orchestration. These exercise the runMirror()
 * core with a fake R2 client + fake archive fetcher — no live HTTP.
 *
 * What's verified:
 *  - Idempotency: when HEAD returns a size match, no PUT is issued.
 *  - --dry-run: no PUTs and no createBucket calls are issued, but a plan
 *    is still produced for each font.
 *  - putObject is called when HEAD returns missing.
 *  - perSlug cdnUrls are populated even for skipped uploads (the YAML still
 *    needs the URL — skipping just avoids re-uploading bytes).
 *  - Custom-domain "blocked" path is faithfully reported, not eaten.
 */
import { test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { parse as parseYaml } from 'yaml';
import {
  type FontMirrorConfig,
  type R2Client,
  type R2HeadResult,
  runMirror,
  updateAtomYamlWithCdnUrls,
  validateConfigCoverage,
} from '../r2-mirror.js';
import { Font } from '../schemas/font.js';

// -------------------- helpers --------------------

type Call =
  | { op: 'bucketExists'; name: string }
  | { op: 'createBucket'; name: string }
  | { op: 'headObject'; bucket: string; key: string }
  | { op: 'putObject'; bucket: string; key: string; size: number }
  | { op: 'attachCustomDomain'; bucket: string; domain: string; zoneId: string }
  | { op: 'publicBaseUrl'; bucket: string };

class FakeR2 implements R2Client {
  calls: Call[] = [];
  store = new Map<string, { size: number }>();
  bucketAlreadyExists = false;
  customDomainBlocked = false;
  customDomainAlreadyAttached = false;

  async bucketExists(name: string): Promise<boolean> {
    this.calls.push({ op: 'bucketExists', name });
    return this.bucketAlreadyExists;
  }

  async createBucket(name: string): Promise<void> {
    this.calls.push({ op: 'createBucket', name });
    this.bucketAlreadyExists = true;
  }

  async headObject(bucket: string, key: string): Promise<R2HeadResult> {
    this.calls.push({ op: 'headObject', bucket, key });
    const hit = this.store.get(key);
    if (!hit) return { exists: false };
    return { exists: true, size: hit.size };
  }

  async putObject(bucket: string, key: string, body: Uint8Array): Promise<void> {
    this.calls.push({ op: 'putObject', bucket, key, size: body.byteLength });
    this.store.set(key, { size: body.byteLength });
  }

  async attachCustomDomain(
    bucket: string,
    domain: string,
    zoneId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    this.calls.push({ op: 'attachCustomDomain', bucket, domain, zoneId });
    if (this.customDomainBlocked) return { ok: false, reason: 'forbidden by test fixture' };
    return { ok: true };
  }

  async publicBaseUrl(bucket: string): Promise<string | null> {
    this.calls.push({ op: 'publicBaseUrl', bucket });
    return this.customDomainAlreadyAttached ? 'https://cdn.brand-atoms.com' : null;
  }
}

const makeFontsDir = (slugs: Array<{ slug: string; version: string }>): string => {
  const root = mkdtempSync(join(tmpdir(), 'r2mirror-'));
  for (const { slug, version } of slugs) {
    const dir = join(root, slug, version);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'atom.yaml'),
      `kind: font\nid: ${slug}\nversion: ${version}\nname: ${slug}\nfamily: ${slug}\nsource:\n  kind: external\n  family: ${slug}\n`,
    );
  }
  return root;
};

const fakeArchive = (entries: Record<string, Uint8Array>): Uint8Array => zipSync(entries);

const fakeFontConfig = (slug: string): FontMirrorConfig => ({
  slug,
  archiveUrl: `https://example.invalid/${slug}.zip`,
  archiveType: 'zip',
  pick: (p) => {
    const base = p.split('/').pop() ?? '';
    if (/^Keep-.*\.ttf$/.test(base)) return base;
    return null;
  },
});

// -------------------- tests --------------------

test('runMirror: dry-run never calls createBucket or putObject', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  const archive = fakeArchive({
    'Keep-Regular.ttf': strToU8('hello-font-bytes'),
    'Drop-Me.txt': strToU8('ignored'),
  });

  const result = await runMirror({
    client: fake,
    fontsDir,
    dryRun: true,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  const puts = fake.calls.filter((c) => c.op === 'putObject');
  const creates = fake.calls.filter((c) => c.op === 'createBucket');
  assert.equal(puts.length, 0, 'dry-run must not PUT');
  assert.equal(creates.length, 0, 'dry-run must not create the bucket');
  assert.equal(result.uploads.length, 1, 'dry-run still plans the upload');
  assert.equal(result.uploads[0]?.action, 'put');
  assert.equal(result.uploads[0]?.filename, 'Keep-Regular.ttf');
  assert.equal(Object.keys(result.perSlug.inter?.cdnUrls ?? {}).length, 1);
});

test('runMirror: idempotency — HEAD size match skips PUT', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  fake.bucketAlreadyExists = true;
  const bytes = strToU8('font-bytes-12345');
  const archive = fakeArchive({ 'Keep-Regular.ttf': bytes });
  fake.store.set('fonts/inter/1.0.0/Keep-Regular.ttf', { size: bytes.byteLength });

  const result = await runMirror({
    client: fake,
    fontsDir,
    dryRun: false,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  const puts = fake.calls.filter((c) => c.op === 'putObject');
  const heads = fake.calls.filter((c) => c.op === 'headObject');
  assert.equal(puts.length, 0, 'identical-size HEAD hit must skip PUT');
  assert.equal(heads.length, 1, 'HEAD must be called once');
  assert.equal(result.uploads[0]?.action, 'skip-head-match');
});

test('runMirror: missing object triggers PUT', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  fake.bucketAlreadyExists = true;
  const bytes = strToU8('font-bytes-zzz');
  const archive = fakeArchive({ 'Keep-Regular.ttf': bytes });

  await runMirror({
    client: fake,
    fontsDir,
    dryRun: false,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  const puts = fake.calls.filter((c) => c.op === 'putObject');
  assert.equal(puts.length, 1);
  if (puts[0]?.op === 'putObject') {
    assert.equal(puts[0].key, 'fonts/inter/1.0.0/Keep-Regular.ttf');
    assert.equal(puts[0].size, bytes.byteLength);
  }
});

test('runMirror: size-mismatch HEAD triggers PUT (not skip)', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  fake.bucketAlreadyExists = true;
  const bytes = strToU8('font-bytes-new');
  const archive = fakeArchive({ 'Keep-Regular.ttf': bytes });
  // Pre-existing object with a DIFFERENT size — must be overwritten.
  fake.store.set('fonts/inter/1.0.0/Keep-Regular.ttf', { size: 1 });

  const result = await runMirror({
    client: fake,
    fontsDir,
    dryRun: false,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  assert.equal(result.uploads[0]?.action, 'put');
});

test('runMirror: custom-domain blocked surfaces a reason, mirror still proceeds', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  fake.bucketAlreadyExists = true;
  fake.customDomainBlocked = true;
  const archive = fakeArchive({ 'Keep-Regular.ttf': strToU8('x') });

  const result = await runMirror({
    client: fake,
    fontsDir,
    dryRun: false,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  assert.equal(result.customDomain, 'blocked');
  assert.match(result.customDomainReason ?? '', /forbidden by test fixture/);
  assert.equal(result.uploads.length, 1);
  assert.equal(result.uploads[0]?.action, 'put');
});

test('runMirror: bucket creation is gated on bucketExists()', async () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const fake = new FakeR2();
  // bucketAlreadyExists = false → must create.
  const archive = fakeArchive({ 'Keep-Regular.ttf': strToU8('x') });

  const result = await runMirror({
    client: fake,
    fontsDir,
    dryRun: false,
    fetch: async () => archive,
    log: () => undefined,
    configs: [fakeFontConfig('inter')],
  });

  assert.equal(result.bucketCreated, true);
  const createCalls = fake.calls.filter((c) => c.op === 'createBucket');
  assert.equal(createCalls.length, 1);
});

test('updateAtomYamlWithCdnUrls: round-trip produces schema-valid YAML', () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const atomPath = join(fontsDir, 'inter', '1.0.0', 'atom.yaml');

  const urls = {
    'InterVariable.woff2': 'https://cdn.brand-atoms.com/fonts/inter/1.0.0/InterVariable.woff2',
  };
  updateAtomYamlWithCdnUrls(atomPath, urls);

  const parsed = parseYaml(readFileSync(atomPath, 'utf8'));
  const validated = Font.safeParse(parsed);
  assert.equal(
    validated.success,
    true,
    validated.success ? '' : JSON.stringify(validated.error.issues),
  );
  if (validated.success) {
    assert.deepEqual(validated.data.cdnUrls, urls);
  }
});

test('validateConfigCoverage: detects on-disk slugs missing from config', () => {
  const fontsDir = makeFontsDir([
    { slug: 'inter', version: '1.0.0' },
    { slug: 'orphan', version: '1.0.0' },
  ]);
  const res = validateConfigCoverage(fontsDir, [fakeFontConfig('inter')]);
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, .orphan);
});

test('validateConfigCoverage: passes when configs match on-disk slugs', () => {
  const fontsDir = makeFontsDir([{ slug: 'inter', version: '1.0.0' }]);
  const res = validateConfigCoverage(fontsDir, [fakeFontConfig('inter')]);
  assert.equal(res.ok, true);
});
