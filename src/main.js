import '@google/model-viewer';
import './style.css';
import './theme.js';
import './site.js';
import { MAX_MODEL_BYTES, validateGlb } from '../shared/glb.js';
import { DriveStorage, loadGoogleIdentity } from './drive.js';

const viewer = document.querySelector('#viewer');
const error = document.querySelector('#error');
const loading = document.querySelector('#loading');
const status = document.querySelector('#file-status');
let modelUrl;
let selectedFile = null;
let selectedSaved = false;

viewer.addEventListener('load', () => {
  loading.hidden = true;
  error.hidden = true;
  status.textContent = '表示の準備ができました。';
  updateDriveControls();
});
viewer.addEventListener('error', () => {
  loading.hidden = true;
  error.hidden = false;
  selectedFile = null;
  updateDriveControls();
  status.textContent = '読み込みに失敗しました。別の GLB ファイルをお試しください。';
});
document.querySelector('#rotate').addEventListener('click', (event) => {
  const button = event.currentTarget;
  viewer.autoRotate = !viewer.autoRotate;
  button.setAttribute('aria-checked', String(viewer.autoRotate));
});
document.querySelector('#reset').addEventListener('click', () => {
  viewer.cameraOrbit = '30deg 75deg auto';
  viewer.cameraTarget = 'auto auto auto';
  viewer.fieldOfView = 'auto';
});
document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((swatch) => {
      const selected = swatch === button;
      swatch.classList.toggle('selected', selected);
      swatch.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('.stage').style.backgroundColor = button.dataset.color;
    document.querySelector('.stage').classList.toggle('light', ['#ebece7', '#eee7dc', '#e2e9ef'].includes(button.dataset.color));
  });
});
let selection = 0;
async function previewFile(file, saved = false) {
  const currentSelection = ++selection;
  try {
    if (file.size > MAX_MODEL_BYTES) throw new Error('ファイルは 50 MB 以下にしてください。');
    validateGlb(await file.arrayBuffer(), file.name);
  } catch (error) {
    if (currentSelection === selection) status.textContent = error.message;
    return false;
  }
  if (currentSelection !== selection) return false;
  selectedFile = file;
  selectedSaved = saved;
  const previousUrl = modelUrl;
  modelUrl = URL.createObjectURL(file);
  error.hidden = true;
  loading.hidden = false;
  status.textContent = 'モデルを読み込んでいます…';
  viewer.src = modelUrl;
  updateDriveControls();
  viewer.alt = `${file.name} の3Dモデル`;
  document.querySelector('#model-name').textContent = file.name.replace(/\.glb$/i, '');
  document.querySelector('#model-caption').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · GLTF 2.0`;
  document.querySelector('#reset').click();
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  return true;
}
document.querySelector('#file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (file) previewFile(file);
});
const upload = document.querySelector('.upload');
upload.addEventListener('dragover', (event) => {
  event.preventDefault();
  upload.classList.add('dragging');
});
upload.addEventListener('dragleave', () => upload.classList.remove('dragging'));
upload.addEventListener('drop', (event) => {
  event.preventDefault();
  upload.classList.remove('dragging');
  if (event.dataTransfer.files.length !== 1) {
    status.textContent = 'GLB ファイルを1つ選択してください。';
    return;
  }
  previewFile(event.dataTransfer.files[0]);
});

const connect = document.querySelector('#drive-connect');
const save = document.querySelector('#drive-save');
const refresh = document.querySelector('#drive-refresh');
const disconnect = document.querySelector('#drive-disconnect');
const driveStatus = document.querySelector('#drive-status');
const files = document.querySelector('#drive-files');
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
let busy = false;
let identityReady = false;
let listing = 0;
const drive = new DriveStorage({ master: true, onExpired: () => {
  files.replaceChildren();
  listing++;
  driveStatus.textContent = 'Google の接続期限が切れました。再接続してください。';
  updateDriveControls();
} });
function updateDriveControls() {
  // A model may load before the Drive controls have been initialized.
  const button = document.querySelector('#drive-save');
  if (!button) return;
  connect.disabled = busy || !identityReady;
  connect.hidden = Boolean(drive.token);
  save.disabled = busy || !drive.token || !selectedFile || selectedSaved || !viewer.loaded;
  save.textContent = selectedSaved ? 'Drive に保存済み' : '表示中のモデルを Drive に保存';
  refresh.disabled = busy || !drive.token;
  disconnect.hidden = !drive.token;
  disconnect.disabled = busy;
}
async function showDriveFiles() {
  const request = ++listing;
  const models = await drive.list();
  if (request !== listing) return;
  files.replaceChildren();
  for (const model of models) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = model.name;
    button.title = model.name;
    button.addEventListener('click', () => runDriveTask(async () => {
      driveStatus.textContent = 'Drive からモデルを読み込んでいます…';
      if (Number(model.size) > MAX_MODEL_BYTES) throw new Error('50 MB を超えるモデルは表示できません。');
      const blob = await drive.download(model.id);
      if (!await previewFile(new File([blob], model.name, { type: 'model/gltf-binary' }), true)) throw new Error('Drive のファイルを表示できませんでした。GLB の内容を確認してください。');
      driveStatus.textContent = 'Drive から取得しました。';
    }));
    item.append(button); files.append(item);
  }
  if (!models.length) {
    const empty = document.createElement('li');
    empty.textContent = '保存した作品がここに表示されます。';
    empty.className = 'drive-empty';
    files.append(empty);
  }
}
async function runDriveTask(action) {
  if (busy) return;
  busy = true; updateDriveControls();
  files.setAttribute('aria-busy', 'true');
  try { await action(); }
  catch (error) { driveStatus.textContent = error.message || '通信に失敗しました。'; }
  finally { busy = false; files.removeAttribute('aria-busy'); updateDriveControls(); }
}
connect.addEventListener('click', () => runDriveTask(async () => {
  // requestAccessToken executes synchronously in the click handler to allow popups.
  const result = drive.connect(clientId);
  driveStatus.textContent = 'Google に接続しています…';
  await result;
  selectedSaved = false;
  await showDriveFiles();
  driveStatus.textContent = `接続しました。保存先は自分の Drive の「${drive.folderName}」です。`;
}));
save.addEventListener('click', () => runDriveTask(async () => {
  const file = selectedFile;
  if (!file) return;
  driveStatus.textContent = 'Drive に保存しています。この画面を開いたままお待ちください…';
  await drive.save(file);
  if (selectedFile === file) selectedSaved = true;
  driveStatus.textContent = 'Google Drive に保存しました。';
  try { await showDriveFiles(); }
  catch { driveStatus.textContent = '保存は完了しました。一覧の更新に失敗したため「一覧を更新」を押してください。'; }
}));
refresh.addEventListener('click', () => runDriveTask(async () => {
  await showDriveFiles();
  driveStatus.textContent = '保存済みモデルの一覧を更新しました。';
}));
disconnect.addEventListener('click', () => {
  drive.disconnect(); listing++; selectedSaved = false;
  files.replaceChildren();
  driveStatus.textContent = '接続を解除しました。Drive に保存したファイルは残ります。';
  updateDriveControls();
});
if (!clientId) {
  driveStatus.textContent = 'Google Drive 連携はサイト管理者の設定待ちです。モデルのプレビューは利用できます。';
} else {
  loadGoogleIdentity().then(() => {
    identityReady = true; updateDriveControls();
    driveStatus.textContent = 'Google に接続して、自分の Drive に保存できます。';
  }).catch((error) => { driveStatus.textContent = error.message + ' ページを再読み込みしてください。'; });
}
