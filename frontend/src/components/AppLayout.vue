<template>
  <div class="flex h-screen">
    <aside class="w-64 bg-slate-800 text-white flex flex-col">
      <div class="p-4 text-xl font-bold border-b border-slate-700">
        Customs API Hub
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <router-link to="/" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Dashboard
        </router-link>
        <router-link to="/compliance" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Compliance
        </router-link>
        <router-link to="/billing" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Billing
        </router-link>
        <router-link to="/cache" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Cache Manager
        </router-link>
        <router-link to="/apilogs" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          API Logs
        </router-link>
        <router-link to="/users" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Users
        </router-link>
        <router-link to="/settings" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          Settings
        </router-link>
      </nav>
      <div class="p-4 border-t border-slate-700">
        <a
          href="#"
          @click.prevent="logout"
          class="block px-3 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          Logout
        </a>
      </div>
    </aside>
    <main class="flex-1 overflow-auto p-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import api from "../api";

const router = useRouter();

function logout() {
  localStorage.removeItem("admin_api_key");
  delete api.defaults.headers.common["X-API-Key"];
  router.push("/login");
}
</script>
