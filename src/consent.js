import { $ } from './ui.js';
import { STORAGE_KEYS } from './config.js';

const TEXT = {
  body: 'Load 3D models from Google Drive. Network data may be used.',
  agree: 'Load',
  decline: 'Cancel',
  declined: 'Loading canceled.',
};

export function declinedMessage() {
  return TEXT.declined;
}

export function ensureConsent() {
  if (localStorage.getItem(STORAGE_KEYS.consent) === 'granted') {
    return Promise.resolve(true);
  }
  const modal = $('consentModal');
  const agreeBtn = $('consentAgree');
  const declineBtn = $('consentDecline');
  $('consentBody').textContent = TEXT.body;
  agreeBtn.textContent = TEXT.agree;
  declineBtn.textContent = TEXT.decline;
  modal.classList.add('active');

  return new Promise((resolve) => {
    const finish = (granted) => {
      modal.classList.remove('active');
      agreeBtn.removeEventListener('click', onAgree);
      declineBtn.removeEventListener('click', onDecline);
      if (granted) localStorage.setItem(STORAGE_KEYS.consent, 'granted');
      resolve(granted);
    };
    const onAgree = () => finish(true);
    const onDecline = () => finish(false);
    agreeBtn.addEventListener('click', onAgree);
    declineBtn.addEventListener('click', onDecline);
  });
}
