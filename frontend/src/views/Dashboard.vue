<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Total Requests"
        :value="stats?.total_requests ?? 0"
        icon="T"
        icon-bg="bg-blue-100 text-blue-600"
      />
      <StatCard
        label="Cache Hit Rate"
        :value="stats?.cache_hit_rate ?? 0"
        icon="%"
        icon-bg="bg-green-100 text-green-600"
      />
      <StatCard
        label="Session Total"
        :value="stats?.session?.total ?? 0"
        icon="S"
        icon-bg="bg-purple-100 text-purple-600"
      />
      <StatCard
        label="Session Live"
        :value="stats?.session?.live ?? 0"
        icon="L"
        icon-bg="bg-orange-100 text-orange-600"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">Requests by Type</h2>
        <div v-if="stats?.by_type && Object.keys(stats.by_type).length > 0" class="space-y-2">
          <div
            v-for="(count, type) in stats.by_type"
            :key="type"
            class="flex justify-between items-center"
          >
            <span class="text-gray-600">{{ type }}</span>
            <span class="font-mono font-bold">{{ count }}</span>
          </div>
        </div>
        <p v-else class="text-gray-400">No data</p>
      </div>

      <div class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">Requests by Source</h2>
        <div v-if="stats?.by_source && Object.keys(stats.by_source).length > 0" class="space-y-2">
          <div
            v-for="(count, source) in stats.by_source"
            :key="source"
            class="flex justify-between items-center"
          >
            <span class="text-gray-600">{{ source }}</span>
            <span class="font-mono font-bold">{{ count }}</span>
          </div>
        </div>
        <p v-else class="text-gray-400">No data</p>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-red-500">{{ error }}</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import StatCard from "../components/StatCard.vue";
import { fetchStatistics, type StatisticsData } from "../api";

const stats = ref<StatisticsData | null>(null);
const error = ref("");

onMounted(async () => {
  try {
    const res = await fetchStatistics();
    stats.value = res.data.data;
  } catch (e) {
    error.value = "Failed to load statistics";
  }
});
</script>
