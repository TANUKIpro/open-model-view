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

const viewer = createViewer($('viewer'));

initSettings({
  onThemeChange: (t) => viewer.setSceneBackground(t),
});

const presetSelect = $('presetSelect');

const resolveApiKey = () => EMBEDDED_API_KEY;

for (const p of PRESETS) {
  const opt = document.createElement('option');
  opt.value = p.url;
  opt.textContent = p.name;
  presetSelect.appendChild(opt);
}
presetSelect.addEventListener('change', () => {
  if (!presetSelect.value) return;
  loadFolder(presetSelect.value);
});

async function downloadResources(files, objId, apiKey, totalCount) {
  const resourceMap = {};
  let doneCount = 0;
  for (const f of files) {
    if (f.id === objId) continue;
    const idx = doneCount + 1;
    updateLoadingLabel(`Downloading: ${f.name}`, `(${idx}/${totalCount}) files`);
    setStatus(`Downloading: ${f.name}`);
    setLoadingProgress(0, 0);
    const blob = await fetchAsBlob(driveDownloadUrl(f.id, apiKey), (r, t) => {
      const mb = `${(r / 1024 / 1024).toFixed(1)}/${(t / 1024 / 1024).toFixed(1)} MB`;
      updateLoadingLabel(`Downloading: ${f.name}`, `(${idx}/${totalCount}) ${mb}`);
      setStatus(`Downloading: ${f.name} (${mb})`);
      setLoadingProgress(r, t);
    }, Number(f.size) || 0);
    resourceMap[f.name] = blob;
    doneCount++;
  }
  return { resourceMap, doneCount };
}

async function buildMaterials(mtlFile, resourceMap) {
  if (!mtlFile) return { materials: null, mtlText: null };
  const mtlText = await textFromBlob(resourceMap[mtlFile.name]);
  const rewritten = mtlText.replace(/^(\s*map_\w+\s+)(.+)$/gim, (_, prefix, ref) => {
    const base = ref.trim().split(/[\\/]/).pop();
    const blob = resourceMap[base];
    if (!blob) return `${prefix}${ref}`;
    return `${prefix}${blobUrlFor(blob)}`;
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

  presetSelect.disabled = true;
  hideModelInfo();
  showLoading('Fetching folder contents...');

  try {
    setStatus('Fetching folder contents...');
    const files = await listFolder(folderId, apiKey);
    if (!files.length) throw new Error('Folder is empty or not publicly shared');

    const byExt = (ext) => files.find((f) => f.name.toLowerCase().endsWith(ext));
    const obj = byExt('.obj');
    const mtl = byExt('.mtl');
    if (!obj) throw new Error('.obj file not found');

    const totalCount = files.length;
    const { resourceMap, doneCount } = await downloadResources(files, obj.id, apiKey, totalCount);

    updateLoadingLabel('Preparing materials...', '');
    setLoadingProgress(0, 0);
    const { materials, mtlText } = await buildMaterials(mtl, resourceMap);

    const objIdx = doneCount + 1;
    updateLoadingLabel(`Downloading: ${obj.name}`, `(${objIdx}/${totalCount}) files`);
    setStatus(`Downloading: ${obj.name}`);
    setLoadingProgress(0, 0);
    const objBlob = await fetchAsBlob(driveDownloadUrl(obj.id, apiKey), (r, t) => {
      const mb = `${(r / 1024 / 1024).toFixed(1)}/${(t / 1024 / 1024).toFixed(1)} MB`;
      updateLoadingLabel(`Downloading: ${obj.name}`, `(${objIdx}/${totalCount}) ${mb}`);
      setStatus(`Downloading: ${obj.name} (${mb})`);
      setLoadingProgress(r, t);
    }, Number(obj.size) || 0);
    const objText = await textFromBlob(objBlob);

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

const defaultPreset = PRESETS.find((p) => p.name === DEFAULT_PRESET_NAME) || PRESETS[0];
if (defaultPreset) {
  presetSelect.value = defaultPreset.url;
  loadFolder(defaultPreset.url);
}
