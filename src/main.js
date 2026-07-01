import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

import { EMBEDDED_API_KEY, PRESETS, DEFAULT_PRESET_NAME } from './config.js';
import {
  extractFolderId,
  listFolder,
  driveDownloadUrl,
  fetchAsBlob,
  blobUrlFor,
  textFromBlob,
} from './drive-api.js';
import {
  $,
  setStatus,
  showLoading,
  updateLoadingLabel,
  setLoadingProgress,
  hideLoading,
} from './ui.js';
import { createViewer } from './viewer.js';
import { computeModelStats, renderModelInfo, hideModelInfo } from './model-info.js';
import { initSettings } from './settings.js';
import { ensureConsent, declinedMessage } from './consent.js';

const viewer = createViewer($('viewer'));

initSettings({
  onThemeChange: (t) => viewer.setSceneBackground(t),
});

const presetSelect = $('presetSelect');
const presetsByName = [...PRESETS].sort((a, b) => a.name.localeCompare(b.name));
const folderCache = new Map();

const resolveApiKey = () => EMBEDDED_API_KEY;

for (const p of presetsByName) {
  const opt = document.createElement('option');
  opt.value = p.url;
  opt.textContent = p.name;
  presetSelect.appendChild(opt);
}
presetSelect.addEventListener('change', () => {
  if (!presetSelect.value) return;
  startLoad(presetSelect.value);
});

async function startLoad(url) {
  const granted = await ensureConsent();
  if (!granted) {
    hideLoading();
    setStatus(declinedMessage());
    hideModelInfo();
    return;
  }
  loadFolder(url);
}

function getFolderCache(folderId) {
  let cache = folderCache.get(folderId);
  if (!cache) {
    cache = {
      files: null,
      blobs: new Map(),
      texts: new Map(),
      objectUrls: new Map(),
    };
    folderCache.set(folderId, cache);
  }
  return cache;
}

function getObjectUrlForFile(file, blob, cache) {
  let url = cache.objectUrls.get(file.id);
  if (!url) {
    url = blobUrlFor(blob);
    cache.objectUrls.set(file.id, url);
  }
  return url;
}

async function fetchFileBlob(file, apiKey, cache, idx, totalCount) {
  const cached = cache.blobs.get(file.id);
  if (cached) return cached;

  updateLoadingLabel(`Downloading: ${file.name}`, `(${idx}/${totalCount}) files`);
  setStatus(`Downloading: ${file.name}`);
  setLoadingProgress(0, 0);
  const blob = await fetchAsBlob(driveDownloadUrl(file.id, apiKey), (r, t) => {
    const mb = `${(r / 1024 / 1024).toFixed(1)}/${(t / 1024 / 1024).toFixed(1)} MB`;
    updateLoadingLabel(`Downloading: ${file.name}`, `(${idx}/${totalCount}) ${mb}`);
    setStatus(`Downloading: ${file.name} (${mb})`);
    setLoadingProgress(r, t);
  }, Number(file.size) || 0);
  cache.blobs.set(file.id, blob);
  return blob;
}

async function textForFile(file, blob, cache) {
  let text = cache.texts.get(file.id);
  if (text === undefined) {
    text = await textFromBlob(blob);
    cache.texts.set(file.id, text);
  }
  return text;
}

function hasFullBlobCache(cache) {
  return Boolean(cache.files?.length) && cache.files.every((f) => cache.blobs.has(f.id));
}

async function prepareResources(files, objId, apiKey, totalCount, cache) {
  const resourceMap = {};
  const resourceFilesByName = new Map();
  let processedCount = 0;
  for (const f of files) {
    if (f.id === objId) continue;
    const idx = processedCount + 1;
    const blob = await fetchFileBlob(f, apiKey, cache, idx, totalCount);
    resourceMap[f.name] = blob;
    resourceFilesByName.set(f.name, f);
    processedCount++;
  }
  return { resourceMap, resourceFilesByName, processedCount };
}

async function buildMaterials(mtlFile, resourceMap, resourceFilesByName, cache) {
  if (!mtlFile) return { materials: null, mtlText: null };
  const mtlText = await textForFile(mtlFile, resourceMap[mtlFile.name], cache);
  const rewritten = mtlText.replace(/^(\s*map_\w+\s+)(.+)$/gim, (_, prefix, ref) => {
    const base = ref.trim().split(/[\\/]/).pop();
    const blob = resourceMap[base];
    if (!blob) return `${prefix}${ref}`;
    const file = resourceFilesByName.get(base);
    if (!file) return `${prefix}${blobUrlFor(blob)}`;
    return `${prefix}${getObjectUrlForFile(file, blob, cache)}`;
  });
  const materials = new MTLLoader().parse(rewritten, '');
  materials.preload();
  return { materials, mtlText };
}

async function loadFolder(folderInput) {
  const apiKey = resolveApiKey();
  if (!apiKey) { setStatus('Please set an API key', true); return; }
  if (!folderInput) { setStatus('No folder specified', true); return; }
  const folderId = extractFolderId(folderInput);
  if (!folderId) { setStatus('Could not parse folder URL', true); return; }
  const cache = getFolderCache(folderId);
  const isFullyCached = hasFullBlobCache(cache);
  const hasCachedFileList = Boolean(cache.files);

  presetSelect.disabled = true;
  hideModelInfo();
  showLoading(
    isFullyCached ? 'Loading cached model...' :
      hasCachedFileList ? 'Resuming cached download...' : 'Fetching folder contents...'
  );

  try {
    setStatus(
      isFullyCached ? 'Loading from cache...' :
        hasCachedFileList ? 'Resuming download...' : 'Fetching folder contents...'
    );
    let files = cache.files;
    if (!files) {
      files = await listFolder(folderId, apiKey);
      cache.files = files;
    }
    if (!files.length) throw new Error('Folder is empty or not publicly shared');

    const byExt = (ext) => files.find((f) => f.name.toLowerCase().endsWith(ext));
    const obj = byExt('.obj');
    const mtl = byExt('.mtl');
    if (!obj) throw new Error('.obj file not found');

    const totalCount = files.length;
    const { resourceMap, resourceFilesByName, processedCount } = await prepareResources(files, obj.id, apiKey, totalCount, cache);

    updateLoadingLabel('Preparing materials...', '');
    setLoadingProgress(0, 0);
    const { materials, mtlText } = await buildMaterials(mtl, resourceMap, resourceFilesByName, cache);

    const objIdx = processedCount + 1;
    const objBlob = await fetchFileBlob(obj, apiKey, cache, objIdx, totalCount);
    const objText = await textForFile(obj, objBlob, cache);

    updateLoadingLabel('Parsing model...', '');
    setLoadingProgress(0, 0);
    const objLoader = new OBJLoader();
    if (materials) objLoader.setMaterials(materials);
    const root = objLoader.parse(objText);

    viewer.setObject(root);
    renderModelInfo(computeModelStats(root, files, obj, mtl, mtlText, objText));
    setStatus(`Loaded: ${obj.name}`);
    hideLoading();
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message}`, true);
    hideLoading();
  } finally {
    presetSelect.disabled = false;
  }
}

const defaultPreset = presetsByName.find((p) => p.name === DEFAULT_PRESET_NAME) || presetsByName[0];
if (defaultPreset) {
  presetSelect.value = defaultPreset.url;
  startLoad(defaultPreset.url);
}
