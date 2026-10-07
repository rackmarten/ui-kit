<script setup lang="ts">
import type { ShellUser } from "./avatar.js";

// Shown only while an admin views the app as someone else (the auth gate's view-as),
// so they don't mistake that person's data for their own. Writes are refused
// server-side meanwhile; the banner says so.
defineProps<{ user: ShellUser | null }>();
</script>

<template>
  <v-alert
    v-if="user?.actor"
    type="warning"
    variant="tonal"
    density="compact"
    rounded="0"
    icon="mdi-eye-outline"
    data-testid="viewing-as"
  >
    Viewing as <strong>{{ user.name }}</strong> (read-only). You are {{ user.actor.name }}; end
    view-as to make changes.
  </v-alert>
</template>
