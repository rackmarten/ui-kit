<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDisplay, useTheme } from "vuetify";
import { glowBackground, persistHomelabTheme, type HomelabThemeName } from "../plugins/vuetify.js";
import { useBackClose } from "../composables/useBackClose.js";
import ViewingAsBanner from "../identity/ViewingAsBanner.vue";
import { useHomelabUser } from "../identity/useHomelabUser.js";
import {
  avatarSrc,
  DEFAULT_AVATAR_BASE_URL,
  initials,
  type ShellUser,
} from "../identity/avatar.js";

export interface NavItem {
  label: string;
  // Shown in the mobile bottom nav instead of `label` when space is tight -
  // falls back to `label` if omitted.
  shortLabel?: string;
  icon?: string;
  to: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    navItems?: NavItem[];
    // server-kit's /api/me, for an app on the jwt strategy: shows the
    // "Viewing as" banner while an admin views as someone. Unset = no call.
    meUrl?: string;
    // Who you are, for an app with its own /api/me. Wins over meUrl,
    // which is then not fetched.
    user?: ShellUser | null;
    // Avatar image is `<avatarBaseUrl><user id>` unless user.avatarUrl is set.
    avatarBaseUrl?: string;
    // Route of the app's own profile page; adds "Profile" to the account menu.
    profileTo?: string;
  }>(),
  {
    navItems: () => [],
    meUrl: undefined,
    user: undefined,
    avatarBaseUrl: DEFAULT_AVATAR_BASE_URL,
    profileTo: undefined,
  },
);

const { mobile } = useDisplay();
const fetched =
  props.meUrl && props.user === undefined ? useHomelabUser({ url: props.meUrl }).user : ref(null);
const user = computed<ShellUser | null>(() =>
  props.user === undefined ? fetched.value : props.user,
);
const avatarImage = computed(() =>
  user.value ? avatarSrc(user.value, props.avatarBaseUrl) : undefined,
);
// A missing or broken image falls back to initials; a new URL gets a new try.
const avatarFailed = ref(false);
watch(avatarImage, () => (avatarFailed.value = false));
const isAdmin = computed(() => user.value?.roles?.includes("admin") ?? false);
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);
// Inline rather than a <style> block: ui-kit ships no CSS file of its own.
const appStyle = computed(() => ({
  background: glowBackground(isDark.value),
  backgroundAttachment: "fixed",
}));

// Material Design's own bottom-nav guidance tops out around 5 items - past
// that it gets cramped/unreadable on a phone (first hit by an app with 7
// nav items). A service with that many surfaces gets a slide-out drawer on
// mobile instead - the same drawer already used on desktop - rather than
// every consumer having to opt in individually.
const MOBILE_NAV_DRAWER_THRESHOLD = 5;
const useMobileDrawer = computed(
  () => mobile.value && props.navItems.length > MOBILE_NAV_DRAWER_THRESHOLD,
);
const showBottomNav = computed(
  () => mobile.value && !useMobileDrawer.value && props.navItems.length > 0,
);
const mobileDrawerOpen = ref(false);
const accountMenuOpen = ref(false);
// Back closes the drawer/menu first instead of leaving the page (or the PWA).
useBackClose(mobileDrawerOpen);
useBackClose(accountMenuOpen);

// The permanent desktop drawer must stay visible regardless of
// mobileDrawerOpen's value - Vuetify only auto-opens a `permanent` drawer
// when its v-model is left unbound (null), so binding v-model directly to
// mobileDrawerOpen (needed for the mobile hamburger toggle) left the
// desktop drawer closed on load, with no hamburger there to reopen it.
const drawerOpen = computed({
  get: () => !mobile.value || mobileDrawerOpen.value,
  set: (value: boolean) => {
    mobileDrawerOpen.value = value;
  },
});

const toggleTheme = (): void => {
  const next: HomelabThemeName = isDark.value ? "homelabLight" : "homelabDark";
  theme.global.name.value = next;
  persistHomelabTheme(next);
};
</script>

<template>
  <v-app :style="appStyle">
    <v-app-bar>
      <v-app-bar-nav-icon v-if="useMobileDrawer" @click="mobileDrawerOpen = !mobileDrawerOpen" />
      <v-toolbar-title>{{ title }}</v-toolbar-title>
      <slot name="app-bar-actions" />
      <v-menu v-model="accountMenuOpen">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-if="user"
            v-bind="menuProps"
            :icon="mobile"
            :variant="mobile ? undefined : 'text'"
            :aria-label="`Account: ${user.name}`"
            class="text-none"
            data-testid="account-activator"
          >
            <v-avatar size="32" color="primary">
              <img
                v-if="avatarImage && !avatarFailed"
                :src="avatarImage"
                :alt="user.name"
                style="width: 100%; height: 100%; object-fit: cover"
                @error="avatarFailed = true"
              />
              <span v-else class="text-body-2">{{ initials(user.name) }}</span>
            </v-avatar>
            <span v-if="!mobile" class="ml-2" data-testid="account-name">{{ user.name }}</span>
          </v-btn>
          <v-btn
            v-else
            icon="mdi-account-circle-outline"
            v-bind="menuProps"
            data-testid="account-activator"
          />
        </template>
        <v-list density="compact">
          <template v-if="user">
            <v-list-item data-testid="account-header">
              <v-list-item-title class="d-flex align-center ga-2">
                {{ user.name }}
                <v-chip v-if="isAdmin" size="x-small" color="primary" label>Admin</v-chip>
              </v-list-item-title>
              <v-list-item-subtitle v-if="user.deviceName">{{
                user.deviceName
              }}</v-list-item-subtitle>
              <v-list-item-subtitle v-if="user.actor"
                >Viewing as {{ user.name }} (you are {{ user.actor.name }})</v-list-item-subtitle
              >
            </v-list-item>
            <v-divider />
          </template>
          <v-list-item
            v-if="profileTo"
            :to="profileTo"
            prepend-icon="mdi-account-outline"
            title="Profile"
          />
          <v-list-item
            :prepend-icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
            :title="isDark ? 'Light mode' : 'Dark mode'"
            @click="toggleTheme"
          />
          <slot name="account-menu-items" />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-if="navItems.length > 0 && (!mobile || useMobileDrawer)"
      v-model="drawerOpen"
      :permanent="!mobile"
      :temporary="mobile"
    >
      <v-list nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.label"
          rounded="lg"
          @click="mobileDrawerOpen = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <ViewingAsBanner v-if="user" :user="user" />
      <v-container fluid :class="{ 'pb-16': showBottomNav }">
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="showBottomNav" grow color="primary">
      <v-btn v-for="item in navItems" :key="item.to" :to="item.to" :value="item.to">
        <v-icon>{{ item.icon }}</v-icon>
        <span>{{ item.shortLabel ?? item.label }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
