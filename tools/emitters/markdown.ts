import type { ResolvedBrand } from '../resolver.js';
import type { Constraint } from '../schemas/index.js';
import type { Emitter } from './types.js';

const swatchValue = (brand: ResolvedBrand, swatchId: string): string => {
  const sw = brand.palette.data.swatches.find((s) => s.id === swatchId);
  return sw?.value ?? '#000000';
};

const severityEmoji = (sev: 'error' | 'warning' | 'recommendation'): string => {
  if (sev === 'error') return '🛑';
  if (sev === 'warning') return '⚠️';
  return '💡';
};

const ruleDetails = (rule: Constraint): string[] => {
  const out: string[] = [];
  const r = rule as unknown as Record<string, unknown>;
  for (const key of [
    'min',
    'max',
    'unit',
    'against',
    'minRatio',
    'standard',
    'use',
    'treatments',
    'allowed',
    'forbidden',
    'pairsWith',
    'doesNotPairWith',
    'forbiddenContexts',
    'allowedContexts',
    'requires',
    'minSizeRatio',
    'criterion',
  ]) {
    const v = r[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out.push(`- **${key}:** ${v.join(', ')}`);
    } else {
      out.push(`- **${key}:** \`${String(v)}\``);
    }
  }
  if (rule.when) {
    out.push(
      `- **when:** ${Object.entries(rule.when)
        .map(([k, vv]) => `\`${k}=${JSON.stringify(vv)}\``)
        .join(', ')}`,
    );
  }
  if (rule.appliesIn) {
    out.push(`- **applies in:** ${rule.appliesIn.join(', ')}`);
  }
  return out;
};

export const markdownEmitter: Emitter = {
  name: 'markdown',
  description: 'Human-readable brand guide rendered as Markdown',

  emit(brand) {
    const lines: string[] = [];

    lines.push(`# ${brand.name}`);
    lines.push('');
    lines.push(`> \`${brand.id}@${brand.version}\``);
    lines.push('');
    if (brand.description) {
      lines.push(brand.description);
      lines.push('');
    }
    if (brand.tags.length > 0) {
      lines.push(`**Tags:** ${brand.tags.map((t) => `\`${t}\``).join(', ')}`);
      lines.push('');
    }

    lines.push('## Atoms');
    lines.push('');
    lines.push('### Palette');
    lines.push('');
    lines.push(
      `**${brand.palette.data.name}** · \`${brand.palette.slug}@${brand.palette.resolvedVersion}\` · ${brand.palette.data.provenance?.license ?? '—'}`,
    );
    if (brand.palette.data.description) {
      lines.push('');
      lines.push(`> ${brand.palette.data.description.replace(/\n+/g, ' ')}`);
    }
    lines.push('');

    lines.push('### Fonts');
    lines.push('');
    lines.push('| Role | Font | License | Classification |');
    lines.push('|------|------|---------|----------------|');
    for (const font of brand.fonts) {
      const license = font.data.provenance?.license ?? '—';
      const cls = font.data.classification ?? '—';
      lines.push(
        `| \`${font.role}\` | **${font.data.name}** \`(${font.slug}@${font.resolvedVersion})\` | ${license} | ${cls} |`,
      );
    }
    lines.push('');

    lines.push('## Swatches');
    lines.push('');
    lines.push('| ID | Name | Value |');
    lines.push('|----|------|-------|');
    for (const s of brand.palette.data.swatches) {
      lines.push(`| \`${s.id}\` | ${s.name} | \`${s.value}\` |`);
    }
    lines.push('');

    lines.push('## Mode role mappings');
    lines.push('');
    lines.push('### Light mode');
    lines.push('');
    lines.push('| Role | Swatch | Hex |');
    lines.push('|------|--------|-----|');
    for (const [role, swatchId] of Object.entries(brand.palette.data.modes.light.roles)) {
      lines.push(`| \`${role}\` | \`${swatchId}\` | \`${swatchValue(brand, swatchId)}\` |`);
    }
    lines.push('');
    lines.push('### Dark mode');
    lines.push('');
    lines.push('| Role | Swatch | Hex |');
    lines.push('|------|--------|-----|');
    for (const [role, swatchId] of Object.entries(brand.palette.data.modes.dark.roles)) {
      lines.push(`| \`${role}\` | \`${swatchId}\` | \`${swatchValue(brand, swatchId)}\` |`);
    }
    lines.push('');

    if (brand.roles?.colors || brand.roles?.typography) {
      lines.push('## Brand semantic roles');
      lines.push('');
      if (brand.roles?.colors) {
        lines.push('### Colors');
        lines.push('');
        lines.push('| Role | Swatch | Hex |');
        lines.push('|------|--------|-----|');
        for (const [role, swatchId] of Object.entries(brand.roles.colors)) {
          lines.push(`| \`${role}\` | \`${swatchId}\` | \`${swatchValue(brand, swatchId)}\` |`);
        }
        lines.push('');
      }
      if (brand.roles?.typography) {
        lines.push('### Typography');
        lines.push('');
        lines.push('| Role | Font role key |');
        lines.push('|------|---------------|');
        for (const [role, fontKey] of Object.entries(brand.roles.typography)) {
          lines.push(`| \`${role}\` | \`${fontKey}\` |`);
        }
        lines.push('');
      }
    }

    if (brand.assets.length > 0) {
      lines.push('## Assets');
      lines.push('');
      for (const asset of brand.assets) {
        lines.push(`### ${asset.name} (\`${asset.category}\`)`);
        if (asset.description) {
          lines.push('');
          lines.push(asset.description);
        }
        lines.push('');
        for (const variant of asset.variants) {
          const dims =
            variant.dimensions?.width && variant.dimensions?.height
              ? `${variant.dimensions.width}×${variant.dimensions.height}`
              : '—';
          const scheme = variant.colorScheme ?? '—';
          const mode = variant.intendedMode ?? 'any';
          lines.push(
            `- \`${variant.id}\` · ${scheme} · mode: ${mode} · ${dims} · \`${variant.file}\``,
          );
        }
        lines.push('');
      }
    }

    if (brand.rules.length > 0) {
      lines.push('## Rules');
      lines.push('');
      for (const severity of ['error', 'warning', 'recommendation'] as const) {
        const list = brand.rules.filter((r) => r.severity === severity);
        if (list.length === 0) continue;
        lines.push(`### ${severityEmoji(severity)} ${severity} (${list.length})`);
        lines.push('');
        for (const rule of list) {
          lines.push(`#### \`${rule.type}\` → \`${rule.target}\``);
          lines.push('');
          for (const d of ruleDetails(rule)) lines.push(d);
          if (rule.rationale) {
            lines.push('');
            lines.push(`> ${rule.rationale.replace(/\n+/g, ' ')}`);
          }
          lines.push('');
        }
      }
    }

    if (brand.provenance) {
      lines.push('## Provenance');
      lines.push('');
      if (brand.provenance.source) lines.push(`- **Source:** <${brand.provenance.source}>`);
      lines.push(`- **License:** \`${brand.provenance.license}\``);
      if (brand.provenance.attribution)
        lines.push(`- **Attribution:** ${brand.provenance.attribution.replace(/\n+/g, ' ')}`);
      if (brand.provenance.importedDate)
        lines.push(`- **Imported:** \`${brand.provenance.importedDate}\``);
      if (brand.provenance.notes)
        lines.push(`- **Notes:** ${brand.provenance.notes.replace(/\n+/g, ' ')}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(
      `*Generated by the brand-atoms converter. Source: \`${brand.id}@${brand.version}\` from the encyclopedia.*`,
    );

    return [{ path: 'markdown/brand-guide.md', contents: `${lines.join('\n')}\n` }];
  },
};
