import * as THREE from 'three';
import { $ } from './ui.js';

const modelInfoEl = $('modelInfo');
const modelInfoListEl = $('modelInfoList');
const modelInfoToggleEl = $('modelInfoToggle');

function setModelInfoCollapsed(collapsed) {
  modelInfoEl.classList.toggle('collapsed', collapsed);
  modelInfoToggleEl.textContent = collapsed ? '+' : '\u2212';
  modelInfoToggleEl.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
}

modelInfoToggleEl.addEventListener('click', () => {
  setModelInfoCollapsed(!modelInfoEl.classList.contains('collapsed'));
});

const formatBytes = (n) => {
  if (!n && n !== 0) return '\u2014';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
const formatNum = (n) => Number(n).toLocaleString();
const formatDim = (n) => Number(n).toPrecision(4);

export function computeModelStats(root, files, objFile, mtlFile, mtlText, objText) {
  let vertices = 0, triangles = 0, meshes = 0;
  const matNames = new Set();
  root.traverse((c) => {
    if (!c.isMesh || !c.geometry) return;
    meshes++;
    const pos = c.geometry.attributes.position;
    if (pos) vertices += pos.count;
    if (c.geometry.index) triangles += c.geometry.index.count / 3;
    else if (pos) triangles += pos.count / 3;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) if (m && m.name) matNames.add(m.name);
  });

  const textureFiles = new Set();
  if (mtlText) {
    const re = /^\s*map_\w+\s+(.+?)\s*$/gim;
    for (const m of mtlText.matchAll(re)) {
      const base = m[1].trim().split(/[\\/]/).pop();
      if (base) textureFiles.add(base);
    }
  }

  const totalBytes = files.reduce((s, f) => s + (Number(f.size) || 0), 0);
  const objBytes = Number(objFile.size) || (objText ? new Blob([objText]).size : 0);
  const mtlBytes = mtlFile ? (Number(mtlFile.size) || 0) : 0;

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  return {
    name: objFile.name,
    mtlName: mtlFile ? mtlFile.name : null,
    fileCount: files.length,
    totalBytes,
    objBytes,
    mtlBytes,
    meshes,
    vertices,
    triangles: Math.round(triangles),
    materials: matNames.size,
    textures: textureFiles.size,
    size,
  };
}

export function renderModelInfo(stats) {
  const rows = [
    ['Name', stats.name],
    ['Files', `${formatNum(stats.fileCount)} (${formatBytes(stats.totalBytes)})`],
    ['OBJ size', formatBytes(stats.objBytes)],
  ];
  if (stats.mtlName) rows.push(['MTL', `${stats.mtlName} (${formatBytes(stats.mtlBytes)})`]);
  rows.push(
    { section: 'Geometry' },
    ['Meshes', formatNum(stats.meshes)],
    ['Vertices', formatNum(stats.vertices)],
    ['Triangles', formatNum(stats.triangles)],
    { section: 'Appearance' },
    ['Materials', formatNum(stats.materials)],
    ['Textures', formatNum(stats.textures)],
    { section: 'Bounds (units)' },
    ['Width (X)', formatDim(stats.size.x)],
    ['Height (Y)', formatDim(stats.size.y)],
    ['Depth (Z)', formatDim(stats.size.z)],
  );

  modelInfoListEl.replaceChildren();
  for (const row of rows) {
    if (row.section) {
      const h = document.createElement('div');
      h.className = 'mi-section';
      h.textContent = row.section;
      modelInfoListEl.appendChild(h);
      continue;
    }
    const dt = document.createElement('dt');
    dt.textContent = row[0];
    const dd = document.createElement('dd');
    dd.textContent = row[1];
    modelInfoListEl.appendChild(dt);
    modelInfoListEl.appendChild(dd);
  }
  setModelInfoCollapsed(true);
  modelInfoEl.hidden = false;
}

export function hideModelInfo() {
  modelInfoEl.hidden = true;
  modelInfoListEl.replaceChildren();
}
