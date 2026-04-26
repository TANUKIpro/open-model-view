export function extractFolderId(input) {
  const m = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  return null;
}

export async function listFolder(folderId, apiKey) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
  url.searchParams.set('fields', 'files(id,name,mimeType,size)');
  url.searchParams.set('pageSize', '1000');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive API: ${res.status} ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export const driveDownloadUrl = (id, apiKey) =>
  `https://www.googleapis.com/download/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(apiKey)}`;

export async function fetchAsBlob(url, onProgress, fallbackTotal = 0) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || Number(fallbackTotal) || 0;
  if (!res.body || !onProgress) return await res.blob();
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, total);
  }
  return new Blob(chunks);
}

export const blobUrlFor = (blob) => URL.createObjectURL(blob);
export const textFromBlob = (blob) => blob.text();
