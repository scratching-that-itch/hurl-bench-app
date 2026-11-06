import { ref } from "vue";

const THEME_KEY = "hurl-bench-theme";

export type Theme = "dark" | "light";

function initial(): Theme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export const theme = ref<Theme>(initial());

export function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme.value);
  document.documentElement.classList.toggle("dark", theme.value === "dark");
}
