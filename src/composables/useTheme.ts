import { ref, watch } from "vue";

type Theme = "light" | "dark";

function getInitial(): Theme {
  const stored = localStorage.getItem("orb_theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Module-level singleton — shared across all components
const theme = ref<Theme>(getInitial());

watch(
  theme,
  (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("orb_theme", t);
  },
  { immediate: true }
);

export function useTheme() {
  function toggle() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  return { theme, toggle };
}
