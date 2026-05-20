#!/usr/bin/env bun
/**
 * paperx CLI — Mirror sprint skeleton.
 *
 * Business logic intentionally deferred to the next sprint. This entry
 * exists so the workspace structure is exercised end-to-end (install /
 * typecheck / run) before any feature work lands. Replace this file
 * when the CLI scope is defined.
 */
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('paperx-cli (skeleton) — usage: paperx-cli [--help] [--version]');
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('paperx-cli 0.0.1');
  process.exit(0);
}

console.log('paperx-cli: hello from the Mirror skeleton 👋');
