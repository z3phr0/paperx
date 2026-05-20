# Releasing paperx

paperx ships a Conventional Commits → automated CHANGELOG flow, with
`apps/paperx/package.json.version` as the single source of truth
(extension is the released artifact in the bun monorepo; root
`package.json` is private and unversioned). The MV3 manifest and
runtime `meta.paperxVersion` are both injected at build time by
`apps/paperx/vite.config.ts` — don't hand-edit them.

## Quick path (95% of releases)

1. On the feature branch you're shipping:

   ```bash
   bun run release minor   # or patch / major / explicit x.y.z
   ```

   This bumps `apps/paperx/package.json.version`, regenerates root
   `CHANGELOG.md` from new commits, runs `typecheck + build` (both
   forwarded to the paperx workspace via Bun `--filter`; must be
   clean), and creates one `chore(release): vX.Y.Z` commit on the
   current branch.

2. Move it to the working trunk and tag:

   ```bash
   git checkout dev
   git merge --ff-only feature/<your-branch>
   git tag -a vX.Y.Z -m "Release vX.Y.Z — <one-line summary>"
   ```

3. Push when you're ready — this is the last review gate:

   ```bash
   git push origin dev
   git push origin vX.Y.Z
   ```

## Pre-release checklist

Before running `bun run release ...`:

- [ ] All commits on the branch follow Conventional Commits
  (`type(scope): subject`). Mixed-style commits won't classify
  correctly into Added / Changed / Fixed / etc.
- [ ] `bun run test:e2e` passes against the latest `apps/paperx/dist/`
- [ ] `feature/<branch>` is rebased onto current `dev` so the merge
  is fast-forward (linear history; no merge commits)
- [ ] No uncommitted changes (`git status` clean)

## What `scripts/release.ts` does

- Bumps `apps/paperx/package.json.version` (patch / minor / major /
  explicit `X.Y.Z`)
- Runs `conventional-changelog -p angular` to (re)write
  `CHANGELOG.md` in place. First run uses `-r 0` to backfill all
  history from the init commit.
- Runs `bun run typecheck && bun run build` — non-zero aborts the
  release.
- `git add apps/paperx/package.json CHANGELOG.md` + commits as
  `chore(release): vX.Y.Z`. **Tag is NOT created here** — it lands on
  `dev` after the ff-merge so tag and release commit live on the
  same branch.

## Single source of truth

| Where the version surfaces | How it's set |
|---|---|
| `apps/paperx/package.json.version` | Manual edit (or `scripts/release.ts`) |
| `apps/paperx/dist/manifest.json` `version` | `apps/paperx/vite.config.ts` spreads `pkg.version` over the imported manifest |
| `meta.paperxVersion` in JSON Prompt export | `__PAPERX_VERSION__` Vite `define`, inlined at compile time |

`manifest.json` itself **does not** carry a `version` field anymore
(removed in `4b1288f`). If you find a literal version string anywhere
else, route it through one of the two channels above.

## Versioning policy

- **PATCH** — bug fixes, internal refactors that don't change UX or
  the wire format
- **MINOR** — new user-facing features, additive type widening (e.g.
  a new `ToolMode`), new panel sections
- **MAJOR** — breaking changes to the `paperx-prompt-v1` JSON
  schema, removal of a feature, behavioral regression that downstream
  consumers must adapt to

The wire format (`schema: "paperx-prompt-v1"`) bumps to v2 only on a
true breaking change to consumer code; additive `ToolMode` extensions
or new properties are MINOR.

## Recovery / common mistakes

- **CHANGELOG looks wrong** (commits classified into the wrong
  section): edit `CHANGELOG.md` by hand, `git add`, and amend the
  release commit (`git commit --amend --no-edit`) before merging to
  `dev`. After the tag is pushed, treat the CHANGELOG as immutable.
- **Forgot to bump version manually before commits** with conventional
  commits in them: that's fine. `bun run release minor` will pick up
  every commit since the last release section in `CHANGELOG.md`.
- **Need to ship a hotfix on top of a published release**: branch off
  the tag (`git checkout -b hotfix/x.y.z+1 vX.Y.Z`), commit fix,
  `bun run release patch`, ff-merge to `dev`, tag.
