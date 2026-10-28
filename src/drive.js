const API = 'https://www.googleapis.com/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let identityScript;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (identityScript) return identityScript;
  identityScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google ログインを読み込めませんでした。'));
    script.onerror = () => { script.remove(); identityScript = undefined; reject(new Error('Google ログインを読み込めませんでした。接続を確認してください。')); };
    document.head.append(script);
  });
  return identityScript;
}

export class DriveStorage {
  constructor({ onExpired = () => {}, master = false } = {}) {
    this.folderName = master ? '3D Museum (Master)' : '3D Museum';
    this.folderMarker = master ? '3dmuseum-master-v1' : '3dmuseum-v1';
    this.modelMarker = master ? 'glb-master-v1' : 'glb-v1';
    this.onExpired = onExpired;
    this.generation = 0;
  }
  connect(clientId) {
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        include_granted_scopes: false,
        callback: (response) => {
          if (response.error || !response.access_token) return reject(new Error('Google Drive への接続が許可されませんでした。'));
          if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) return reject(new Error('ファイルの保存に必要な権限が許可されませんでした。'));
          this.clear();
          this.token = response.access_token;
          this.timer = setTimeout(() => { this.clear(); this.onExpired(); }, Math.max(1, Number(response.expires_in || 3600) - 60) * 1000);
          resolve();
        },
        error_callback: () => reject(new Error('ログインが閉じられたか、ポップアップがブロックされました。もう一度お試しください。')),
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }
  clear() {
    clearTimeout(this.timer);
    this.token = null;
    this.folderId = null;
    this.generation++;
  }
  disconnect() {
    const token = this.token;
    this.clear();
    if (token) google.accounts.oauth2.revoke(token, () => {});
  }
  async request(url, options = {}) {
    if (!this.token) throw new Error('Google Drive に接続してください。');
    const generation = this.generation;
    const response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${this.token}` } });
    if (generation !== this.generation) throw new Error('接続先が変更されました。操作をやり直してください。');
    if (response.status === 401) {
      this.clear(); this.onExpired();
      throw new Error('Google の接続期限が切れました。再接続してください。');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const reason = body.error?.errors?.[0]?.reason;
      if (reason === 'storageQuotaExceeded') throw new Error('Google Drive の空き容量が足りません。');
      if (response.status === 403) throw new Error('Google Drive の権限または API の設定を確認してください。');
      if (response.status === 404) throw new Error('ファイルが見つかりません。一覧を更新してください。');
      throw new Error('Google Drive との通信に失敗しました。時間をおいて再試行してください。');
    }
    return response;
  }
  async listAll(query, fields) {
    const files = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ q: query, fields: `nextPageToken,files(${fields})`, pageSize: '100', orderBy: 'modifiedTime desc' });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await (await this.request(`${API}/files?${params}`)).json();
      files.push(...(page.files || []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }
  async folder(create = false) {
    if (this.folderId) return this.folderId;
    const folders = await this.listAll(`trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='museumApp' and value='${this.folderMarker}' }`, 'id');
    if (folders.length) return (this.folderId = folders[0].id);
    if (!create) return null;
    const folder = await (await this.request(`${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.folderName, mimeType: 'application/vnd.google-apps.folder', appProperties: { museumApp: this.folderMarker } }),
    })).json();
    return (this.folderId = folder.id);
  }
  async list() {
    const folder = await this.folder();
    if (!folder) return [];
    return this.listAll(`'${folder}' in parents and trashed = false and appProperties has { key='museumModel' and value='${this.modelMarker}' }`, 'id,name,size,modifiedTime');
  }
  async save(file) {
    const folder = await this.folder(true);
    const boundary = `museum_${crypto.randomUUID()}`;
    const metadata = { name: file.name, parents: [folder], mimeType: 'model/gltf-binary', appProperties: { museumModel: this.modelMarker } };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: model/gltf-binary\r\n\r\n`, file, `\r\n--${boundary}--\r\n`,
    ]);
    return (await this.request(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    })).json();
  }
  async download(id) {
    return (await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob();
  }
}
