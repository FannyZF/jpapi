<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">Cache Manager</h1>

    <div class="bg-white rounded-lg shadow border p-4 mb-4">
      <div class="flex gap-3 items-end">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-sm text-gray-500">Key Pattern</label>
          <input
            v-model="pattern"
            type="text"
            placeholder="e.g. addr:v1:*"
            class="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          @click="loadCache"
          class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Search
        </button>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow border p-4">
      <p class="text-sm text-gray-500 mb-3">
        {{ entries.length }} entries found
      </p>

      <div v-if="entries.length === 0" class="text-gray-400 py-8 text-center">
        No cache entries
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="border rounded p-3 hover:bg-gray-50"
        >
          <div class="flex justify-between items-start mb-2">
            <code class="text-xs bg-gray-100 px-2 py-0.5 rounded break-all">{{ entry.key }}</code>
            <button
              @click="confirmDelete(entry.key)"
              class="text-red-500 hover:text-red-700 text-sm ml-2 shrink-0"
            >
              Delete
            </button>
          </div>
          <pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">{{ JSON.stringify(entry.value, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-2">Delete Cache Entry</h3>
        <p class="text-sm text-gray-500 mb-4 break-all">
          Are you sure you want to delete <code>{{ deleteTarget }}</code>?
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="showDeleteConfirm = false"
            class="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            @click="doDelete"
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-red-500">{{ error }}</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { fetchCache, deleteCacheEntry, type CacheEntry } from "../api";

const entries = ref<CacheEntry[]>([]);
const pattern = ref("*");
const error = ref("");
const showDeleteConfirm = ref(false);
const deleteTarget = ref("");

async function loadCache() {
  try {
    const res = await fetchCache(pattern.value);
    entries.value = res.data.entries;
  } catch (e) {
    error.value = "Failed to load cache";
  }
}

function confirmDelete(key: string) {
  deleteTarget.value = key;
  showDeleteConfirm.value = true;
}

async function doDelete() {
  try {
    await deleteCacheEntry(deleteTarget.value);
    showDeleteConfirm.value = false;
    await loadCache();
  } catch (e) {
    error.value = "Failed to delete cache entry";
    showDeleteConfirm.value = false;
  }
}

onMounted(() => {
  loadCache();
});
</script>
