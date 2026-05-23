/**
 * Static-YAML test for .github/workflows/deploy.yml (issue #4).
 *
 * Asserts the deploy workflow contains exactly the steps and env wiring
 * required by the acceptance criteria. Runs via `tsx` — no test framework.
 *
 * Run: `pnpm test:workflow`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = process.cwd();
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'deploy.yml');
const ACCOUNT_ID = 'e1fe0f0ce8ff18da4edc118372c30022';
const SECRET_NAME = 'CLOUDFLARE_API_TOKEN';
const PROJECT_NAME = 'brand-atoms';

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  'continue-on-error'?: boolean | string;
  if?: string | boolean;
};

type Job = {
  'runs-on'?: string;
  env?: Record<string, string>;
  steps?: Step[];
};

type Workflow = {
  name?: string;
  on?: unknown;
  env?: Record<string, string>;
  jobs?: Record<string, Job>;
};

function loadWorkflow(): Workflow {
  const raw = readFileSync(WORKFLOW_PATH, 'utf8');
  return parseYaml(raw) as Workflow;
}

function findStep(steps: Step[], predicate: (s: Step) => boolean): Step | undefined {
  return steps.find(predicate);
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`✓ ${msg}`);
}

// ─── Load ─────────────────────────────────────────────────────────────
let wf: Workflow;
try {
  wf = loadWorkflow();
} catch (err) {
  fail(`Cannot read/parse ${WORKFLOW_PATH}: ${(err as Error).message}`);
}

// ─── Trigger: push to main ────────────────────────────────────────────
// YAML's `on:` is parsed as either { push: { branches: [...] } } or shorthand.
const on = (wf.on ?? {}) as { push?: { branches?: string[] } };
assert.ok(on.push, 'workflow must have on.push trigger');
assert.ok(
  Array.isArray(on.push.branches) && on.push.branches.includes('main'),
  'on.push.branches must include "main"',
);
pass('on.push.branches includes main');

// ─── Workflow-level env: account ID + token alias ─────────────────────
const wfEnv = wf.env ?? {};
assert.equal(
  wfEnv.CLOUDFLARE_ACCOUNT_ID,
  ACCOUNT_ID,
  `workflow env.CLOUDFLARE_ACCOUNT_ID must equal ${ACCOUNT_ID}`,
);
pass('workflow-level CLOUDFLARE_ACCOUNT_ID is set to the correct account');

assert.ok(
  typeof wfEnv.CLOUDFLARE_API_TOKEN === 'string' &&
    wfEnv.CLOUDFLARE_API_TOKEN.includes(`secrets.${SECRET_NAME}`),
  `workflow env.CLOUDFLARE_API_TOKEN must alias \${{ secrets.${SECRET_NAME} }}`,
);
pass(`CLOUDFLARE_API_TOKEN aliases secrets.${SECRET_NAME}`);

// Make sure we DON'T accidentally reference a secret named CLOUDFLARE_API_TOKEN
const rawFile = readFileSync(WORKFLOW_PATH, 'utf8');
assert.ok(
  !/secrets\.CLOUDFLARE_API_TOKEN\b/.test(rawFile),
  'workflow must not reference secrets.CLOUDFLARE_API_TOKEN (use CLOUDFLARE_API_TOKEN)',
);
pass('no references to secrets.CLOUDFLARE_API_TOKEN');

// ─── Job: deploy ──────────────────────────────────────────────────────
const jobs = wf.jobs ?? {};
const jobNames = Object.keys(jobs);
assert.ok(jobNames.length >= 1, 'workflow must define at least one job');
const job = jobs[jobNames[0]];
assert.equal(job['runs-on'], 'ubuntu-latest', 'job must runs-on: ubuntu-latest');
const steps = job.steps ?? [];
assert.ok(steps.length > 0, 'job must have steps');
pass(`job "${jobNames[0]}" present with ${steps.length} step(s)`);

// ─── Step skeleton ────────────────────────────────────────────────────
const checkout = findStep(steps, (s) => (s.uses ?? '').startsWith('actions/checkout@'));
assert.ok(checkout, 'must have actions/checkout step');
pass('checkout step present');

const pnpmSetup = findStep(steps, (s) => (s.uses ?? '').startsWith('pnpm/action-setup@'));
assert.ok(pnpmSetup, 'must have pnpm/action-setup step');
pass('pnpm/action-setup step present');

const nodeSetup = findStep(steps, (s) => (s.uses ?? '').startsWith('actions/setup-node@'));
assert.ok(nodeSetup, 'must have actions/setup-node step');
const nodeVersion = String(nodeSetup.with?.['node-version'] ?? '');
assert.ok(nodeVersion === '22' || nodeVersion === '22.x', 'node-version must be 22');
pass('actions/setup-node uses Node 22');

const install = findStep(steps, (s) => (s.run ?? '').includes('pnpm install --frozen-lockfile'));
assert.ok(install, 'must run `pnpm install --frozen-lockfile`');
pass('pnpm install --frozen-lockfile present');

const validate = findStep(steps, (s) => /\bpnpm\s+validate\b/.test(s.run ?? ''));
assert.ok(validate, 'must run `pnpm validate`');
pass('pnpm validate present');

const rootBuild = findStep(
  steps,
  (s) => /\bpnpm\s+build\b/.test(s.run ?? '') && !(s.run ?? '').includes('cd web'),
);
assert.ok(rootBuild, 'must run root `pnpm build` (converter)');
pass('root pnpm build (converter) present');

const webBuild = findStep(steps, (s) => /cd\s+web[\s\S]*pnpm\s+build/.test(s.run ?? ''));
assert.ok(webBuild, 'must run `cd web && pnpm build` (astro)');
pass('web build (astro) present');

// ─── Deploy step ──────────────────────────────────────────────────────
// wrangler-action@v3 was removed (commit aba2067) because it ran
// `pnpm add wrangler` at the workspace root, which pnpm rejects without
// -w. wrangler is a devDep in web/, so we exec it directly via pnpm.
type StepWithDir = Step & { 'working-directory'?: string };
const deploy = findStep(steps, (s) => /\bwrangler\s+pages\s+deploy\b/.test(s.run ?? '')) as
  | StepWithDir
  | undefined;
assert.ok(deploy, 'must have a deploy step that runs `wrangler pages deploy`');
pass('wrangler-pages-deploy step present');

// Direct `pnpm exec wrangler ...` — the abandoned wrangler-action must
// not creep back in.
assert.ok(
  !steps.some((s) => (s.uses ?? '').startsWith('cloudflare/wrangler-action')),
  'must not use cloudflare/wrangler-action — exec wrangler directly from web/ instead',
);
pass('no cloudflare/wrangler-action regression');

const run = String(deploy.run ?? '');
const workingDir = String(deploy['working-directory'] ?? '');
assert.ok(
  workingDir === './web' || workingDir === 'web',
  `deploy step must set working-directory to web/ (got "${workingDir}")`,
);
assert.ok(
  /\bpnpm\s+exec\s+wrangler\b/.test(run),
  `deploy step must run \`pnpm exec wrangler ...\` (got "${run}")`,
);
// From web/, the dist path is `dist`, not `web/dist`.
assert.ok(
  /pages\s+deploy\s+dist\b/.test(run),
  `wrangler command must be "pages deploy dist ..." from web/ (got "${run}")`,
);
assert.ok(
  run.includes(`--project-name ${PROJECT_NAME}`),
  `wrangler command must include --project-name ${PROJECT_NAME}`,
);
assert.ok(run.includes('--branch main'), 'wrangler command must include --branch main');
pass('wrangler command deploys web/dist to brand-atoms on branch main');

// ─── Order check: deploy must come AFTER both builds ──────────────────
const idxRootBuild = steps.indexOf(rootBuild as Step);
const idxWebBuild = steps.indexOf(webBuild as Step);
const idxDeploy = steps.indexOf(deploy as Step);
const idxValidate = steps.indexOf(validate as Step);
const idxInstall = steps.indexOf(install as Step);
assert.ok(idxInstall < idxValidate, 'install must come before validate');
assert.ok(idxValidate < idxRootBuild, 'validate must come before root build');
assert.ok(idxRootBuild < idxWebBuild, 'root build must come before web build');
assert.ok(idxWebBuild < idxDeploy, 'web build must come before deploy');
pass('step order: install → validate → root build → web build → deploy');

// ─── No swallowed failures ────────────────────────────────────────────
for (const s of steps) {
  const coe = s['continue-on-error'];
  assert.notEqual(
    coe,
    true,
    `step "${s.name ?? s.uses ?? s.run}" must not set continue-on-error: true`,
  );
  assert.notEqual(
    String(coe).toLowerCase(),
    'true',
    `step "${s.name ?? s.uses ?? s.run}" must not set continue-on-error: true`,
  );
  // Forbid `if: false` (disables step silently)
  if (s.if !== undefined) {
    const ifVal = String(s.if).trim().toLowerCase();
    assert.notEqual(ifVal, 'false', `step "${s.name ?? s.uses ?? s.run}" must not set if: false`);
  }
}
pass('no step uses continue-on-error: true or if: false');

// ─── Missing-secret guard ─────────────────────────────────────────────
// Either an explicit guard step that fails on empty CLOUDFLARE_API_TOKEN with
// the required URL message, OR a secret-presence assertion via env.
const settingsUrl =
  'https://github.com/convergent-systems-co/branding-library/settings/secrets/actions';
const guard = findStep(
  steps,
  (s) =>
    (s.run ?? '').includes(SECRET_NAME) &&
    (s.run ?? '').includes(settingsUrl) &&
    /(missing|not set|empty|unset)/i.test(s.run ?? ''),
);
assert.ok(
  guard,
  `must have a guard step that fails with a clear message referencing ${settingsUrl} when ${SECRET_NAME} is unset`,
);
pass(`missing-secret guard step present (references ${settingsUrl})`);

console.log('\nAll workflow assertions passed.');
