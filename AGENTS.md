# Agent Instructions

> **This repository is public.** Everything committed here, including commit
> messages, PR titles and descriptions, is world-readable. Read
> "Public repository, private homelab" at the end of this file before
> committing.

## Project

`ui-kit` is a library, not a deployed service. Vue 3 + Vuetify 3 frontend
building blocks (app shell, placeholder dashboard/settings views, shared
theme, notifications, search, ...), published to npm as `@rackmarten/ui-kit`
and consumed by the maintainer's self-hosted apps. Its backend counterpart
is `@rackmarten/server-kit`, in its own repository.

See `README.md` for what it provides.

## General rules

- It exists to be installed by the maintainer's apps, not to grow
  speculative features nobody needs yet: add to it when a real consuming
  app needs the capability, not preemptively.
- It ships as a built ES module, with Vue, Vuetify and vue-router as peer
  dependencies. Don't have a consumer import its `.vue` source out of
  `node_modules`: Vite's dependency pre-bundler can't process raw SFCs from
  a real (non-symlinked) npm install.
- `vite.config.ts` has `build.emptyOutDir: false` because vue-tsc's `.d.ts`
  output and Vite's JS output are written by two separate steps into the
  same `dist/`; don't remove it without re-checking both still land
  together.
- Tests use Vitest with jsdom. They live in `test/`, mirroring `src/`
  (`src/search/GlobalSearch.vue` -> `test/search/GlobalSearch.test.ts`),
  helpers in `test/helpers/`.
- `tools/theme-tuner.html` is a standalone page (no build step) for tuning
  the theme's accents and glow; it is not part of the package.
- Public API names (`AppShell`, `createHomelabVuetify`, `homelabAccents`,
  ...) are stable identifiers; renaming one is a breaking change.
- Do not commit secrets, credentials, tokens, or private keys.
- Prefer small, focused changes; run `npm run build`, `npm run typecheck`
  and `npm test` before considering a change complete, and add the change
  to the `[Unreleased]` section of `CHANGELOG.md`.

## Releases

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
with semver headings. To release: bump `version` in `package.json`, rename
`[Unreleased]` to `[<version>] - <YYYY-MM-DD>` (add a fresh empty
`[Unreleased]` above it and update the link references at the bottom), merge,
then push the tag `v<version>`. `.github/workflows/publish.yml` refuses a tag
that doesn't match `package.json`, publishes to npm with provenance using the
repository's `NPM_TOKEN` secret, and creates a GitHub release whose notes are
that version's `CHANGELOG.md` section.

## Public repository, private homelab

This repository is published under the MIT license. The maintainer's homelab
uses it, but homelab-specific state does not live here. Keep it that way:

- No private inventory: hostnames, domains, internal service names, task
  numbers or email addresses. Examples and test fixtures use invented values
  (`example.com`, `app`, `demo`). RFC1918 addresses such as `192.168.0.x` are
  fine.
- Comments keep the technical reason, not the private history behind it
  ("an inference gateway", "a consuming app", not a named service or task).
- No links to private repositories in docs. CI is self-contained
  (`.github/workflows/ci.yml`, GitHub-hosted runner), because a public repo
  cannot call a reusable workflow in a private one.

Before pushing, the leak check in CI (`.github/scripts/leak-check.sh`, run
with `--tree --log`) must pass. Its patterns are private and reach CI as the
org's `LEAK_PATTERNS` secret; a hit prints only an opaque id and a location.
`.leak-allow` lists intentional exceptions (`<path-glob>:<id>`), for
functional configuration only. Rephrase a hit rather than allowlisting it.
The script is a vendored copy: change it upstream, not here.
