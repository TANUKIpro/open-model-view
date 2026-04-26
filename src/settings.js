import { $ } from './ui.js';
import { STORAGE_KEYS } from './config.js';

export function initSettings({ onThemeChange }) {
  const themeSelect = $('themeSelect');
  const settingsModal = $('settingsModal');

  function applyTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    themeSelect.value = t;
    onThemeChange?.(t);
  }
  applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || 'light');

  themeSelect.addEventListener('change', () => {
    const t = themeSelect.value;
    localStorage.setItem(STORAGE_KEYS.theme, t);
    applyTheme(t);
  });

  const open = () => settingsModal.classList.add('active');
  const close = () => settingsModal.classList.remove('active');
  $('settingsBtn').addEventListener('click', open);
  $('settingsCloseBtn').addEventListener('click', close);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal.classList.contains('active')) close();
  });
}
