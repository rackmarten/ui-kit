# Changelog

All notable changes to `@rackmarten/ui-kit` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is 0.x, a minor bump may contain breaking changes.

## [Unreleased]

## [0.11.0] - 2026-10-13

### Added

- `createApi` and `ApiError`: a JSON API client with a base URL, per-request
  headers, request defaults, a 401 hook and an injectable `fetch`. JSON
  bodies get a content-type, native bodies (`FormData`, `Blob`, ...) pass
  through, 204 and empty bodies resolve `undefined`, and errors carry the
  status, path and parsed body.
- `usePolling`: polls a loader while the component is mounted, pauses while
  the page is hidden, never overlaps loads and keeps the last good data on
  failure.

## [0.10.0] - 2026-10-07

The first public release.

### Added

- Vue 3 + Vuetify 3 building blocks: `AppShell` (responsive nav, avatar and
  account menu, `/` search shortcut), placeholder `DashboardView` and
  `SettingsView`, a shared accent-driven theme with persisted light/dark mode
  (`createHomelabVuetify`, `homelabAccents`), `createHomelabRouter`,
  `useBackClose`, `NotificationBell` and `NotificationsView`,
  `GlobalSearch`, and a "Viewing as" banner.

### Changed

- Internal refactor to the @rackmarten/eslint-config rules; no API change.
- Renamed to the `@rackmarten` scope and published to the public npm
  registry under the MIT license.
- `homelabAccents` is keyed by colour (`green`, `coral`, `blue`, `amber`,
  `teal`, `violet`) instead of app names; the hex values are unchanged.
- `DEFAULT_AVATAR_BASE_URL` is now empty, so `AppShell` shows initials until
  an app passes `avatar-base-url`.
- Tests moved out of `src/` into `test/`, mirroring the `src/` tree.
- The package builds and tests on its own, with its own lockfile and a
  `tsconfig.json` that doesn't extend anything outside the package. The
  theme tuner page moved along with it, to `tools/theme-tuner.html`.
- ESLint (`@rackmarten/eslint-config`) and Prettier, with `lint`,
  `lint:fix` and `format` scripts; the source was reformatted by Prettier
  and `eslint --fix`, with no change in behavior.

[Unreleased]: https://github.com/rackmarten/ui-kit/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/rackmarten/ui-kit/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/rackmarten/ui-kit/releases/tag/v0.10.0
