# Agent notes

A library shared by DSH plugins with their own pages (dsh-card-board, dsh-notify-inbox, dsh-media-hub, dsh-work). A change here reaches every plugin at its next dependency bump, so a change of behaviour is released as a minor version below 1.0 and each plugin's tests run against it before its own release.

## Code

- What goes here: host-side logic two or more plugins need with the same rule. A plugin's own rules (who may see a board, which folders to watch) stay in the plugin. Record placement choices in `docs/decisions.md`.
- Everything in the repo is English. Examples and tests use made-up data only.
- No runtime dependencies, no DSH imports: DSH services come through what the caller passes. `esbuild` is an optional peer, loaded only by `./build`.
- Comments only for a why the code can't show.

## Git

- Conventional Commits, one-line subjects. PR titles are Conventional Commit subjects (CI checks them); squash merges, and whoever merges deletes the branch.
- Versions follow semver from the commit types since the last tag (below 1.0, `feat` or breaking is a minor bump, `fix`/`perf` a patch); run `.github/scripts/release-bump-check.py vX.Y.Z` before tagging.
- Releases: move `CHANGELOG.md` notes under the new version, bump `package.json`, merge, and once CI is green push the tag `vX.Y.Z`; `.github/workflows/publish.yml` publishes to npm by trusted publishing (OIDC, no stored token) and creates the GitHub release. Its trusted publisher on npmjs.com names this repo and `publish.yml`.
