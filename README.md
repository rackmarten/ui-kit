# @rackmarten/ui-kit

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/rackmarten)

Vue 3 + Vuetify 3 building blocks for the frontend of a small self-hosted
web app: an app shell, a shared theme, routing, notifications, global search
and identity helpers. Its backend counterpart is
[`@rackmarten/server-kit`](https://www.npmjs.com/package/@rackmarten/server-kit).

> **Heads-up:** this kit exists to serve the maintainer's own self-hosted
> apps, and new features land when one of those apps needs them. It is
> published in case it is useful to you too, but the API may change between
> 0.x minor versions. Pin a version range and read `CHANGELOG.md` before
> bumping.

```bash
npm i @rackmarten/ui-kit
```

No `.npmrc` or token is needed; it is public on the npm registry.

## Usage

Vue 3 + Vuetify 3 + TypeScript, built as an ES module. `vue`, `vuetify` and
`vue-router` are peer dependencies, so your app's own instances are used.

```ts
import { createApp } from "vue";
import { createHomelabRouter, createHomelabVuetify, homelabAccents } from "@rackmarten/ui-kit";
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

const router = createHomelabRouter([
  { path: "/", component: DashboardPage },
  { path: "/items/:id", component: ItemPage },
]);

createApp(App)
  .use(router)
  .use(createHomelabVuetify({ accent: homelabAccents.blue }))
  .mount("#app");
```

```vue
<AppShell title="My app" :nav-items="navItems" me-url="/api/me">
  <template #app-bar-actions>
    <GlobalSearch :provider="search" placeholder="Search..." />
    <NotificationBell :source="notifications" see-all-to="/notifications" />
  </template>
  <router-view />
</AppShell>
```

What it exports:

- **`AppShell`**: responsive layout. A permanent nav drawer on desktop; on
  mobile a bottom navigation bar, or a slide-out drawer when there are more
  than 5 `navItems`. The account button shows the user's avatar (from
  `me-url`, or the `user` prop) and opens a menu with name, device, an
  "Admin" chip, a light/dark toggle, an optional "Profile" link
  (`profile-to`) and an `account-menu-items` slot. Avatars are
  `<avatar-base-url><user id>` (no default, so initials until you set one)
  or `user.avatarUrl`. `/` opens the global search unless focus is in a form
  field.
- **`DashboardView`, `SettingsView`**: placeholder pages you configure or
  replace through slots.
- **Theme** (`createHomelabVuetify`, `homelabAccents`, `homelabGlow`,
  `glowBackground`, `preferredHomelabTheme`, `persistHomelabTheme`):
  light/dark themes with the choice persisted in `localStorage` (falling
  back to the OS preference), `@mdi/font` icons, and an `accent` the rest is
  derived from: app bar gradient, controls, and a background glow AppShell
  paints behind every page. `homelabAccents` is a palette of tuned accents
  (`green`, `coral`, `blue`, `amber`, `teal`, `violet`); any hex works.
  `overrides` is deep-merged into the Vuetify options.
  `tools/theme-tuner.html` is a standalone page (no build step) for tuning
  these values.
- **Routing** (`createHomelabRouter`, `redirectLegacyHashUrl`): web history,
  matching server-kit's `registerSpa`. Old `/#/path` links are rewritten to
  `/path` at boot.
- **`useBackClose(openRef)`, `installBackClose(router)`**: the back button
  closes the topmost dialog/drawer/menu instead of leaving the page (or, on
  an installed PWA's first page, closing the app).
- **`NotificationBell`, `NotificationsView`** (+ `useNotificationBell`,
  `useNotificationHistory`, `createHttpNotificationSource`): an app-bar bell
  and a full history page over a small `NotificationSource` adapter
  (`list`, `unreadCount`, `markRead`, `markAllRead`, optional `subscribe`).
  `createHttpNotificationSource()` is the whole adapter for an app using
  server-kit's notification routes.
- **`GlobalSearch`** (+ `useGlobalSearch`): a debounced search dialog over
  `provider: (term) => Promise<SearchGroup[]>`, ignoring stale answers.
- **Identity** (`useHomelabUser`, `ViewingAsBanner`, `avatarSrc`,
  `initials`): load the caller from server-kit's `/api/me` and show a
  "Viewing as" banner while an admin views as someone else.

Don't import ui-kit's `.vue` sources out of `node_modules`; use the built
package entry point.

## Development

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run lint       # lint:fix and format apply the automatic fixes
```

Tests live in `test/`, mirroring `src/` (`src/auth/jwt.ts` ->
`test/auth/jwt.test.ts`); shared test-only helpers go in `test/helpers/`.
They run on Vitest with jsdom. The build writes `.d.ts` files with vue-tsc
and the JS bundle with Vite into the same `dist/`, which is why
`vite.config.ts` sets `build.emptyOutDir: false`.

## Support this project

If ui-kit saves you time, you can support its development on
[Ko-fi](https://ko-fi.com/rackmarten):

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/rackmarten)

Bug reports, ideas and pull requests
are just as welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

See `CONTRIBUTING.md` for how to contribute and `CHANGELOG.md` for what
changed in each release. Licensed under the [MIT License](LICENSE).
