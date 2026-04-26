export const $ = (id) => document.getElementById(id);

const statusEl = $('status');
const overlayEl = $('loadingOverlay');
const overlayLabel = $('loadingLabel');
const overlayProgress = $('loadingProgress');
const overlayProgressBar = overlayProgress.firstElementChild;
const overlaySub = $('loadingSub');

export const setStatus = (msg, isError = false) => {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
};

export const showLoading = (label, sub = '') => {
  overlayLabel.textContent = label;
  overlaySub.textContent = sub;
  overlayProgress.classList.add('indeterminate');
  overlayProgressBar.style.width = '';
  overlayEl.classList.add('active');
};

export const updateLoadingLabel = (label, sub = '') => {
  overlayLabel.textContent = label;
  overlaySub.textContent = sub;
};

export const setLoadingProgress = (received, total) => {
  if (!total) {
    overlayProgress.classList.add('indeterminate');
    overlayProgressBar.style.width = '';
    return;
  }
  overlayProgress.classList.remove('indeterminate');
  const pct = Math.min(100, (received / total) * 100);
  overlayProgressBar.style.width = pct + '%';
};

export const hideLoading = () => {
  overlayEl.classList.remove('active');
};
