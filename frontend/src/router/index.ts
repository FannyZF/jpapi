import { createRouter, createWebHistory } from "vue-router";
import { hasSessionKey } from "../api";
import Dashboard from "../views/Dashboard.vue";
import CacheManager from "../views/CacheManager.vue";
import Settings from "../views/Settings.vue";
import UserManager from "../views/UserManager.vue";
import Billing from "../views/Billing.vue";
import ComplianceCheck from "../views/ComplianceCheck.vue";
import ApiLogs from "../views/ApiLogs.vue";
import Login from "../views/Login.vue";

const routes = [
  { path: "/login", name: "Login", component: Login },
  { path: "/", name: "Dashboard", component: Dashboard },
  { path: "/cache", name: "CacheManager", component: CacheManager },
  { path: "/settings", name: "Settings", component: Settings },
  { path: "/users", name: "UserManager", component: UserManager },
  { path: "/billing", name: "Billing", component: Billing },
  { path: "/compliance", name: "ComplianceCheck", component: ComplianceCheck },
  { path: "/apilogs", name: "ApiLogs", component: ApiLogs },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const hasKey = hasSessionKey();
  if (to.path !== "/login" && !hasKey) {
    next("/login");
  } else if (to.path === "/login" && hasKey) {
    next("/");
  } else {
    next();
  }
});

export default router;
