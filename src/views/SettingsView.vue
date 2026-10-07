<script setup lang="ts">
export interface SettingsSection {
  title: string;
}

withDefaults(defineProps<{ sections?: SettingsSection[] }>(), { sections: () => [] });
</script>

<template>
  <v-row>
    <v-col cols="12" md="8" lg="6">
      <v-card v-for="section in sections" :key="section.title" class="mb-4">
        <v-card-title>{{ section.title }}</v-card-title>
        <v-card-text>
          <slot :name="section.title" />
        </v-card-text>
      </v-card>
      <v-alert v-if="sections.length === 0" type="info" variant="tonal">
        No settings sections configured yet.
      </v-alert>
    </v-col>
  </v-row>
</template>
