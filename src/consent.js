import { $ } from './ui.js';
import { STORAGE_KEYS } from './config.js';

const STRINGS = {
  ja: {
    body: '本サイトは外部ストレージから3Dモデルデータ（数十MB）を読み込みます。続行しますか？',
    agree: '同意して読み込む',
    decline: '同意しない',
    declined: 'プレゼンテーションにて実際にご確認ください',
  },
  en: {
    body: 'This site will load 3D model data (tens of MB) from external storage. Continue?',
    agree: 'Agree and load',
    decline: 'Decline',
    declined: 'Please check it in person at the presentation.',
  },
};

function pickLocale() {
  const lang = (navigator.language || 'en').toLowerCase();
  return lang.startsWith('ja') ? 'ja' : 'en';
}

export function declinedMessage() {
  return STRINGS[pickLocale()].declined;
}

export function ensureConsent() {
  if (localStorage.getItem(STORAGE_KEYS.consent) === 'granted') {
    return Promise.resolve(true);
  }
  const t = STRINGS[pickLocale()];
  const modal = $('consentModal');
  const agreeBtn = $('consentAgree');
  const declineBtn = $('consentDecline');
  $('consentBody').textContent = t.body;
  agreeBtn.textContent = t.agree;
  declineBtn.textContent = t.decline;
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
