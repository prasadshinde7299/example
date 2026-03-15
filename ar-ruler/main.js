import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.161.0/examples/jsm/webxr/ARButton.js';

let camera;
let scene;
let renderer;
let controller;
let reticle;
let hitTestSource = null;
let localSpace = null;
let viewerSpace = null;
let hitTestSourceRequested = false;

let firstPointMesh = null;
let secondPointMesh = null;
let measurementLine = null;
let currentDistanceMeters = 0;
let selectedUnit = 'm'; // 'm' | 'cm' | 'in'

const distanceEl = document.getElementById('distance');
const resetBtn = document.getElementById('resetBtn');
const unitBtn = document.getElementById('unitBtn');

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.0);
  scene.add(light);

  // Reticle
  const ringGeo = new THREE.RingGeometry(0.06, 0.065, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3bd1c6, side: THREE.DoubleSide });
  reticle = new THREE.Mesh(ringGeo, ringMat);
  reticle.matrixAutoUpdate = false;
  reticle.rotation.x = -Math.PI / 2; // lay flat
  reticle.visible = false;
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'bounded-floor'],
    domOverlay: { root: document.body }
  });
  document.body.appendChild(button);

  resetBtn.addEventListener('click', resetMeasurement);
  unitBtn.addEventListener('click', () => {
    selectedUnit = selectedUnit === 'm' ? 'cm' : selectedUnit === 'cm' ? 'in' : 'm';
    unitBtn.textContent = `Units: ${selectedUnit}`;
    updateDistanceLabel();
  });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
  if (!reticle.visible) return;

  const position = new THREE.Vector3();
  position.setFromMatrixPosition(reticle.matrix);

  // Place first or second point
  const pointMesh = createPointMarker();
  pointMesh.position.copy(position);
  scene.add(pointMesh);

  if (!firstPointMesh) {
    firstPointMesh = pointMesh;
    distanceEl.textContent = 'First point set. Tap second point.';
  } else if (!secondPointMesh) {
    secondPointMesh = pointMesh;
    drawOrUpdateLine();
  } else {
    // Start a new measurement after two points already placed
    resetMeasurement();
    firstPointMesh = pointMesh;
    scene.add(firstPointMesh);
    distanceEl.textContent = 'First point set. Tap second point.';
  }
}

function createPointMarker() {
  const geo = new THREE.SphereGeometry(0.01, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  return new THREE.Mesh(geo, mat);
}

function drawOrUpdateLine() {
  if (!firstPointMesh || !secondPointMesh) return;

  const start = firstPointMesh.position.clone();
  const end = secondPointMesh.position.clone();

  if (!measurementLine) {
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffc107, linewidth: 2 });
    measurementLine = new THREE.Line(geometry, material);
    scene.add(measurementLine);
  } else {
    const arr = new Float32Array([
      start.x, start.y, start.z,
      end.x, end.y, end.z
    ]);
    measurementLine.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    measurementLine.geometry.computeBoundingSphere();
    measurementLine.geometry.attributes.position.needsUpdate = true;
  }

  currentDistanceMeters = start.distanceTo(end);
  updateDistanceLabel();
}

function updateDistanceLabel() {
  if (!currentDistanceMeters || !isFinite(currentDistanceMeters)) return;
  const text = formatDistance(currentDistanceMeters, selectedUnit);
  distanceEl.textContent = text;
}

function formatDistance(meters, unit) {
  switch (unit) {
    case 'cm':
      return `${(meters * 100).toFixed(1)} cm`;
    case 'in': {
      const inches = meters * 39.37007874;
      return `${inches.toFixed(2)} in`;
    }
    case 'm':
    default:
      return `${meters.toFixed(3)} m`;
  }
}

function resetMeasurement() {
  if (firstPointMesh) {
    scene.remove(firstPointMesh);
    firstPointMesh.geometry.dispose();
    firstPointMesh.material.dispose();
    firstPointMesh = null;
  }
  if (secondPointMesh) {
    scene.remove(secondPointMesh);
    secondPointMesh.geometry.dispose();
    secondPointMesh.material.dispose();
    secondPointMesh = null;
  }
  if (measurementLine) {
    scene.remove(measurementLine);
    measurementLine.geometry.dispose();
    measurementLine.material.dispose();
    measurementLine = null;
  }
  currentDistanceMeters = 0;
  distanceEl.textContent = 'Tap to place two points';
}

function animate() {
  renderer.setAnimationLoop(renderXR);
}

function renderXR(timestamp, frame) {
  const session = renderer.xr.getSession();
  if (session) {
    if (!hitTestSourceRequested) {
      session.addEventListener('end', onSessionEnd);
      session.requestReferenceSpace('local').then((space) => {
        localSpace = space;
      });
      session.requestReferenceSpace('viewer').then((space) => {
        viewerSpace = space;
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      hitTestSourceRequested = true;
    }

    if (frame && hitTestSource && localSpace) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(localSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function onSessionEnd() {
  hitTestSourceRequested = false;
  hitTestSource = null;
  viewerSpace = null;
  localSpace = null;
}

