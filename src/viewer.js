import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { SCENE_BG } from './config.js';

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG.light);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10000);
  camera.position.set(0, 0, 3);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 3.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.staticMoving = false;
  controls.dynamicDampingFactor = 0.15;

  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(2, 3, 4);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.9);
  dir2.position.set(-3, -1, -2);
  scene.add(dir2);
  const dir3 = new THREE.DirectionalLight(0xffffff, 0.6);
  dir3.position.set(0, -3, 2);
  scene.add(dir3);

  let currentObject = null;

  // Volume centroid via the divergence theorem: each triangle (a,b,c) forms a
  // signed tetrahedron with the origin; weighting tetrahedron centroids by their
  // signed volume yields the centroid of the enclosed solid (uniform density).
  // Falls back to null when the mesh isn't closed enough to have a stable volume.
  function computeVolumeCentroid(root) {
    root.updateMatrixWorld(true);
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const cross = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const sum = new THREE.Vector3();
    let totalVolume = 0;

    root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      const pos = mesh.geometry.attributes.position;
      if (!pos) return;
      const idx = mesh.geometry.index;
      const m = mesh.matrixWorld;
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      for (let i = 0; i < triCount; i++) {
        const ia = idx ? idx.getX(i * 3)     : i * 3;
        const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
        const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
        va.fromBufferAttribute(pos, ia).applyMatrix4(m);
        vb.fromBufferAttribute(pos, ib).applyMatrix4(m);
        vc.fromBufferAttribute(pos, ic).applyMatrix4(m);
        cross.crossVectors(vb, vc);
        const v = va.dot(cross) / 6;
        totalVolume += v;
        tmp.copy(va).add(vb).add(vc).multiplyScalar(v / 4);
        sum.add(tmp);
      }
    });

    if (Math.abs(totalVolume) < 1e-10) return null;
    return sum.divideScalar(totalVolume);
  }

  function fitCameraToObject(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const bboxCenter = box.getCenter(new THREE.Vector3());
    const pivot = computeVolumeCentroid(obj) || bboxCenter;
    obj.position.sub(pivot);
    obj.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3().setFromObject(obj);
    const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
    const radius = sphere.center.length() + sphere.radius;

    const fov = camera.fov * (Math.PI / 180);
    const dist = radius / Math.tan(fov / 2) * 1.2;
    camera.position.set(0, 0, dist);
    camera.near = dist / 1000;
    camera.far = dist * 1000;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function disposeObject(obj) {
    obj.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }

  function setObject(obj) {
    if (currentObject) {
      scene.remove(currentObject);
      disposeObject(currentObject);
    }
    currentObject = obj;
    scene.add(obj);
    fitCameraToObject(obj);
  }

  function setSceneBackground(themeKey) {
    scene.background = new THREE.Color(SCENE_BG[themeKey]);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  return { scene, camera, controls, renderer, setObject, setSceneBackground };
}
