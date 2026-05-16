#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { emitterMap, emitters } from './emitters/index.js';
import { loadAll } from './loader.js';
import { resolveBrand } from './resolver.js';

type CliArgs = {
  brandRefs: string[];
  emitterNames: string[];
  outDir: string;
  help: boolean;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    brandRefs: [],
    emitterNames: [],
    outDir: 'dist',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '--brand' || a === '-b') {
      const next = argv[++i];
      if (next) args.brandRefs.push(next);
    } else if (a === '--emit' || a === '-e') {
      const next = argv[++i];
      if (next) args.emitterNames.push(...next.split(','));
    } else if (a === '--out' || a === '-o') {
      const next = argv[++i];
      if (next) args.outDir = next;
    }
  }
  return args;
};

const printHelp = (): void => {
  console.log(`brand-atoms converter

Usage:
  pnpm build [--brand <slug>[@version]] [--emit <name>[,<name>...]] [--out <dir>]

Options:
  -b, --brand    Limit to a specific brand (repeatable). Default: build every brand.
  -e, --emit     Comma-separated emitters. Default: all emitters.
  -o, --out      Output directory. Default: dist
  -h, --help     Show this help.

Available emitters:
${emitters.map((e) => `  ${e.name.padEnd(8)}  ${e.description}`).join('\n')}
`);
};

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = process.cwd();
  const { atoms, brands, errors: loadErrors } = loadAll(repoRoot);

  if (loadErrors.length > 0) {
    for (const e of loadErrors) {
      const rel = e.file.replace(`${repoRoot}${sep}`, '');
      const path = e.path ? ` [${e.path}]` : '';
      console.error(`✗ ${rel}${path}: ${e.message}`);
    }
    console.error(`\n${loadErrors.length} load error(s); aborting.`);
    process.exit(1);
  }

  const wantedEmitterNames =
    args.emitterNames.length > 0 ? args.emitterNames : emitters.map((e) => e.name);
  const wantedEmitters = wantedEmitterNames.map((n) => {
    const em = emitterMap.get(n);
    if (!em) {
      console.error(`✗ unknown emitter: "${n}". Available: ${[...emitterMap.keys()].join(', ')}`);
      process.exit(1);
    }
    return em;
  });

  const wantedBrands =
    args.brandRefs.length === 0
      ? brands
      : brands.filter((b) => {
          return args.brandRefs.some((ref) => {
            const [slug, version] = ref.split('@');
            if (slug !== b.slug) return false;
            if (!version) return true;
            return b.version === version || b.version.startsWith(`${version}.`);
          });
        });

  if (wantedBrands.length === 0) {
    console.error(`✗ no brands matched filter: ${args.brandRefs.join(', ')}`);
    process.exit(1);
  }

  const outRoot = join(repoRoot, args.outDir);
  let totalFiles = 0;
  let totalBrands = 0;

  for (const brand of wantedBrands) {
    const { brand: resolved, errors: resolveErrors } = resolveBrand(brand, atoms);
    if (resolveErrors.length > 0) {
      for (const e of resolveErrors) {
        console.error(`✗ ${e.brand} [${e.path}]: ${e.message}`);
      }
      continue;
    }
    if (!resolved) continue;

    const brandOutDir = join(outRoot, 'brands', resolved.id, resolved.version);
    const writtenFiles: string[] = [];

    for (const em of wantedEmitters) {
      const files = em.emit(resolved);
      for (const file of files) {
        const fullPath = join(brandOutDir, file.path);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, file.contents, 'utf8');
        writtenFiles.push(relative(repoRoot, fullPath));
        totalFiles++;
      }
    }

    totalBrands++;
    console.log(`✓ ${resolved.id}@${resolved.version} (${writtenFiles.length} files)`);
    for (const f of writtenFiles) {
      console.log(`    ${f}`);
    }
  }

  console.log(
    `\nBuilt ${totalBrands} brand(s) × ${wantedEmitters.length} emitter(s) = ${totalFiles} file(s) in ${args.outDir}/`,
  );
};

main();
