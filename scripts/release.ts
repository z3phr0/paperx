#!/usr/bin/env bun
/**
 * paperx release runner.
 *
 *   bun run release patch   → 0.1.0 → 0.1.1
 *   bun run release minor   → 0.1.0 → 0.2.0
 *   bun run release major   → 0.1.0 → 1.0.0
 *   bun run release 1.2.3   → explicit version
 *
 * Bumps package.json.version (the single source of truth — manifest
 * version + meta.paperxVersion both flow from here at build time),
 * regenerates CHANGELOG.md via conventional-changelog (angular preset),
 * runs typecheck + build, and produces one `chore(release): vX.Y.Z`
 * commit on the current branch. Tagging happens AFTER ff-merge to dev,
 * not here.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
// Bun monorepo: the extension (apps/paperx) is the released artifact;
// the root package.json is the private workspace manifest with no
// version field. CHANGELOG.md stays at the repo root for cross-package
// release history.
const PKG_PATH = join(ROOT, 'apps/paperx/package.json');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');

function bump(current: string, kind: string): string {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const parts = current.split('.').map(Number);
  const [maj, min, pat] = parts;
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n)) || maj == null || min == null || pat == null) {
    throw new Error(`bad current version: ${current}`);
  }
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'major') return `${maj + 1}.0.0`;
  throw new Error(`unknown bump: ${kind}; use patch / minor / major / x.y.z`);
}

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`× ${cmd} ${args.join(' ')} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

function currentBranch(): string {
  const r = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' });
  return (r.stdout ?? '').trim();
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: bun run release <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as { version: string };
  const next = bump(pkg.version, arg);
  console.log(`→ bump ${pkg.version} → ${next}`);
  pkg.version = next;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // First run (no CHANGELOG.md yet) needs -r 0 to read all history;
  // subsequent runs default to -r 1 (just the new commits since the
  // last release section). We hand the flag manually rather than
  // through the package.json script so the behavior stays explicit.
  const isFirst = !existsSync(CHANGELOG_PATH);
  // Use the CLI package name (`conventional-changelog-cli`) explicitly:
  // it bundles the angular preset as a dep, whereas the bare
  // `conventional-changelog` library package does not. The exposed
  // binary is still named `conventional-changelog`, but bunx resolves
  // by the package name we pass.
  // `-k apps/paperx/package.json` tells conventional-changelog where
  // to read the bumped version from — without it the angular preset
  // would scan the cwd's package.json (the private workspace root,
  // which has no version field) and emit a CHANGELOG section with an
  // empty version header.
  const cgArgs = [
    'conventional-changelog-cli',
    '-p',
    'angular',
    '-i',
    'CHANGELOG.md',
    '-s',
    '-k',
    'apps/paperx/package.json',
  ];
  if (isFirst) cgArgs.push('-r', '0');
  run('bunx', cgArgs);

  // Don't ship a release with broken types or a broken build.
  run('bun', ['run', 'typecheck']);
  run('bun', ['run', 'build']);

  run('git', ['add', 'apps/paperx/package.json', 'CHANGELOG.md']);
  run('git', ['commit', '-m', `chore(release): v${next}`]);

  const branch = currentBranch();
  console.log(`\n✓ committed chore(release): v${next} on ${branch}`);
  console.log(`\nNext steps:`);
  console.log(`  git checkout dev`);
  console.log(`  git merge --ff-only ${branch}`);
  console.log(`  git tag -a v${next} -m 'Release v${next}'`);
  console.log(`  # then push when ready: git push origin dev && git push origin v${next}`);
}

main();
