export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pipntick_theme";

/**
 * Given whatever was in localStorage (if anything), decide which theme to use. An explicit
 * stored choice wins; otherwise default to dark — the app's original, only look. Deliberately
 * ignores prefers-color-scheme: dark is the default even for a visitor whose OS prefers light,
 * light is opt-in only via the toggle (confirmed decision, not an oversight). Pure function so
 * it's unit-testable and so the logic has one source of truth even though THEME_INIT_SCRIPT below
 * has to duplicate it inline (a blocking pre-hydration <script> can't import a module).
 */
export function resolveInitialTheme(stored: string | null): Theme {
  return stored === "light" || stored === "dark" ? stored : "dark";
}

// Sets data-theme on <html> before first paint, so there's no flash of the wrong theme. Injected
// as a blocking inline <script> in layout.tsx — see resolveInitialTheme above for the same logic
// as a real, testable function. Keep the two in sync if this ever changes.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
