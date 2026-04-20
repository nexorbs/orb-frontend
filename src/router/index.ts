import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const routes = [
  {
    path: "/",
    component: () => import("../views/Login.vue"),
    meta: { public: true },
  },
  {
    path: "/app",
    component: () => import("../views/AppLayout.vue"),
    children: [
      { path: "", redirect: "/app/pos" },
      { path: "pos", component: () => import("../views/POS.vue") },
      { path: "cash", component: () => import("../views/CashSessions.vue") },
      { path: "sales", component: () => import("../views/Sales.vue") },
      { path: "products", component: () => import("../views/Products.vue") },
      { path: "categories", component: () => import("../views/Categories.vue") },
      { path: "inventory", component: () => import("../views/Inventory.vue") },
      { path: "reports", component: () => import("../views/Reports.vue") },
      { path: "customers", component: () => import("../views/Customers.vue") },
      { path: "settings", component: () => import("../views/Settings.vue") },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isLoggedIn) return "/";
  if (to.path === "/" && auth.isLoggedIn) return "/app/pos";
});

export default router;
