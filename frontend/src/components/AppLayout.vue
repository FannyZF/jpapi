<template>
  <div class="flex h-screen">
    <aside class="w-64 bg-slate-800 text-white flex flex-col">
      <div class="p-4 text-xl font-bold border-b border-slate-700">
        {{ $t('app.title') }}
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <router-link to="/" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.dashboard') }}
        </router-link>
        <router-link to="/compliance" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.compliance') }}
        </router-link>
        <router-link to="/address-upload" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.address') }}
        </router-link>
        <router-link to="/billing" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.billing') }}
        </router-link>
        <router-link to="/cache" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.cache') }}
        </router-link>
        <router-link to="/apilogs" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.apilogs') }}
        </router-link>
        <router-link to="/users" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.users') }}
        </router-link>
        <router-link to="/settings" class="block px-3 py-2 rounded hover:bg-slate-700 transition-colors" active-class="bg-slate-700">
          {{ $t('nav.settings') }}
        </router-link>
      </nav>
      <div class="p-4 border-t border-slate-700 space-y-2">
        <div class="flex gap-1">
          <button @click="setLang('zh')" class="px-2 py-1 text-xs rounded" :class="$i18n.locale === 'zh' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'">中文</button>
          <button @click="setLang('en')" class="px-2 py-1 text-xs rounded" :class="$i18n.locale === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'">EN</button>
        </div>
        <a href="#" @click.prevent="logout" class="block px-3 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          {{ $t('app.logout') }}
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
import api, { clearSessionKey } from "../api";
import { setLang } from "../i18n";

const router = useRouter();

function logout() {
  clearSessionKey();
  router.push("/login");
}
</script>
