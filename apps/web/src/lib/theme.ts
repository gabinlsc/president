import { ref, watch } from 'vue';

export type Theme = 'dark' | 'light';
const KEY = 'president-theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Storage unavailable: fall back to the default night table.
  }
  return 'dark';
}

/** Night table by default; the choice is remembered per browser. */
export const theme = ref<Theme>(initial());

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // Not persisted: the theme still applies for this visit.
    }
  },
  { immediate: true },
);

export const toggleTheme = (): void => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
};
