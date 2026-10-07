export { default as AppShell } from "./layout/AppShell.vue";
export type { NavItem } from "./layout/AppShell.vue";

export { default as DashboardView } from "./views/DashboardView.vue";
export type { StatCard } from "./views/DashboardView.vue";

export { default as SettingsView } from "./views/SettingsView.vue";
export type { SettingsSection } from "./views/SettingsView.vue";

export {
  createHomelabVuetify,
  glowBackground,
  homelabAccents,
  homelabGlow,
  preferredHomelabTheme,
  persistHomelabTheme,
} from "./plugins/vuetify.js";
export type { HomelabThemeName, HomelabVuetifyOptions } from "./plugins/vuetify.js";

export { createHomelabRouter, redirectLegacyHashUrl } from "./router/homelabRouter.js";
export type { HomelabRouterOptions } from "./router/homelabRouter.js";

export { installBackClose, useBackClose } from "./composables/useBackClose.js";

export { default as NotificationBell } from "./notifications/NotificationBell.vue";
export {
  badgeContent,
  relativeTime,
  useNotificationBell,
} from "./notifications/useNotificationBell.js";
export type {
  BellNotification,
  ListOptions,
  NotificationBellOptions,
  NotificationSource,
} from "./notifications/useNotificationBell.js";
export { default as NotificationsView } from "./views/NotificationsView.vue";
export {
  useNotificationHistory,
  DEFAULT_HISTORY_PAGE,
} from "./notifications/useNotificationHistory.js";
export { createHttpNotificationSource } from "./notifications/httpNotificationSource.js";
export type { HttpNotificationSourceOptions } from "./notifications/httpNotificationSource.js";

export { default as GlobalSearch } from "./search/GlobalSearch.vue";
export { useGlobalSearch } from "./search/useGlobalSearch.js";
export type { SearchGroup, SearchProvider, SearchResult } from "./search/useGlobalSearch.js";

export { default as ViewingAsBanner } from "./identity/ViewingAsBanner.vue";
export { useHomelabUser } from "./identity/useHomelabUser.js";
export type { HomelabUser, HomelabUserOptions } from "./identity/useHomelabUser.js";
export { avatarSrc, DEFAULT_AVATAR_BASE_URL, initials } from "./identity/avatar.js";
export type { ShellUser } from "./identity/avatar.js";
