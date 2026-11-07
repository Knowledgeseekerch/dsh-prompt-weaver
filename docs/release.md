# Release guide

This project is intended for GitHub distribution as a source bundle. It is marked `private` in `package.json` to prevent accidental npm publication; an explicit maintainer decision is required before publishing to npm.

## Versioning

Use semantic versioning:

- **Patch** — bug fixes, tests, docs, compatibility notes.
- **Minor** — backward-compatible configuration or RPC fields, new frameworks, UI improvements.
- **Major** — breaking RPC/config/framework/export changes.

Update:

1. `package.json` version;
2. `CHANGELOG.md`;
3. compatibility evidence in `docs/compatibility.md` if the supported DSH behavior changes.

## Pre-release gates

Run all commands with Node.js 22.19 or newer:

```bash
npm run check
npm run lint
npm test
npm run cli:smoke
npm run frameworks:validate
npm run pack:dry-run
```

Also run the live DSH checklist in `docs/compatibility.md` before claiming support for a specific DSH version.

## Create a GitHub release

1. Commit the release changes.
2. Tag the release:
   ```bash
   git tag -a v0.1.0 -m "dsh-prompt-weaver v0.1.0"
   git push origin v0.1.0
   ```
3. Build the distributable:
   ```bash
   npm pack
   ```
4. Create the GitHub release and attach the generated `dsh-prompt-weaver-0.1.0.tgz`.
5. Paste the relevant `CHANGELOG.md` section into the release notes.
6. Include the tested DSH version only if the live checklist passed.

Users can install a tagged source snapshot:

```bash
dsh plugin --profile web add github:Knowledgeseekerch/dsh-prompt-weaver#v0.1.0
```

## CI

GitHub Actions runs on push and pull requests:

- syntax/JSON check;
- lightweight lint;
- all Node built-in tests;
- CLI smoke test;
- framework validation;
- npm pack dry-run.

Release workflow runs only after a `v*` tag is pushed; it re-runs tests and uploads the npm-pack tarball to GitHub Releases.
