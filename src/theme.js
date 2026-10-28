const select = document.querySelector('#theme-select');
const preference = matchMedia('(prefers-color-scheme: light)');
let theme = 'dark';
try { theme = localStorage.getItem('museum-theme') || 'dark'; } catch { /* Storage can be unavailable. */ }
if (!['dark', 'light', 'system'].includes(theme)) theme = 'dark';
function applyTheme() {
  const resolved = theme === 'system' ? (preference.matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]').content = resolved === 'light' ? '#f4f7fb' : '#090e19';
}
select.value = theme;
applyTheme();
select.addEventListener('change', () => {
  theme = select.value;
  try { localStorage.setItem('museum-theme', theme); } catch { /* Keep in memory. */ }
  applyTheme();
});
preference.addEventListener('change', () => { if (theme === 'system') applyTheme(); });
