import '@google/model-viewer';

const viewer = document.querySelector('#octahedron');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function updateRotation() { viewer.autoRotate = !reducedMotion.matches; }
updateRotation();
reducedMotion.addEventListener('change', updateRotation);
viewer.addEventListener('error', () => { document.querySelector('#octahedron-error').hidden = false; });
viewer.addEventListener('load', () => { document.querySelector('#octahedron-error').hidden = true; });
document.querySelector('#reset-octahedron').addEventListener('click', () => {
  viewer.cameraOrbit = '35deg 65deg 5.4m';
  viewer.cameraTarget = '0m 0m 0m';
  viewer.fieldOfView = '30deg';
});
