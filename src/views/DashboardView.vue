<script setup lang="ts">
export interface StatCard {
  label: string;
  value: string | number;
  icon?: string;
}

withDefaults(defineProps<{ stats?: StatCard[] }>(), { stats: () => [] });
</script>

<template>
  <v-row>
    <v-col v-for="stat in stats" :key="stat.label" cols="12" sm="6" md="4">
      <v-card>
        <v-card-item>
          <template v-if="stat.icon" #prepend>
            <v-icon :icon="stat.icon" size="large" />
          </template>
          <v-card-title>{{ stat.value }}</v-card-title>
          <v-card-subtitle>{{ stat.label }}</v-card-subtitle>
        </v-card-item>
      </v-card>
    </v-col>
    <v-col v-if="stats.length === 0" cols="12">
      <slot>
        <v-alert type="info" variant="tonal">No stats configured for this dashboard yet.</v-alert>
      </slot>
    </v-col>
  </v-row>
</template>
