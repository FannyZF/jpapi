<template>
  <div class="flex items-center gap-4 p-4 bg-white rounded-lg shadow border">
    <div
      class="w-12 h-12 rounded-full flex items-center justify-center"
      :class="iconBg"
    >
      <span class="text-xl">{{ icon }}</span>
    </div>
    <div>
      <div class="text-sm text-gray-500">{{ label }}</div>
      <div class="text-2xl font-bold">{{ formattedValue }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value: string | number;
  icon: string;
  iconBg?: string;
}>();

const formattedValue = computed(() => {
  if (typeof props.value === "number" && props.label.toLowerCase().includes("rate")) {
    return `${props.value}%`;
  }
  return String(props.value);
});
</script>
