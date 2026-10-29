import './fullscreen.css';

for (const frame of document.querySelectorAll('[data-model-fullscreen]')) {
  const button = frame.querySelector('[data-fullscreen-toggle]');
  const label = button.querySelector('[data-fullscreen-label]');
  const message = frame.querySelector('[data-fullscreen-message]');
  let expanded = false, fallback = false, pending = false, previousFocus, exiting = false, savedScroll;
  let inertNodes = [];
  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const active = () => fallback || nativeElement() === frame;
  const isHidden = () => Boolean(frame.closest('[hidden]') || frame.querySelector('model-viewer')?.hidden);
  function sync() {
    const current = active();
    if (current && isHidden()) { leave(); return; }
    button.setAttribute('aria-pressed', String(current));
    button.setAttribute('aria-label', current ? '全画面表示を解除' : 'モデルを全画面表示');
    button.title = current ? '全画面表示を解除' : 'モデルを全画面表示';
    label.textContent = current ? '全画面解除' : '全画面表示';
    frame.classList.toggle('model-fullscreen-active', current);
    if (expanded && !current && previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus({ preventScroll:true });
    expanded = current;
  }
  function restoreWindow() {
    fallback = false;
    frame.classList.remove('model-fullscreen-window');
    document.body.classList.remove('model-fullscreen-open');
    for (const [node, value] of inertNodes) node.inert = value;
    inertNodes = [];
    if (savedScroll) window.scrollTo({ left:savedScroll[0], top:savedScroll[1], behavior:'instant' });
  }
  function expandWindow() {
    savedScroll = [window.scrollX, window.scrollY];
    // Keep background controls out of keyboard navigation in browsers without native fullscreen.
    for (let node = frame; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node) { inertNodes.push([sibling, sibling.inert]); sibling.inert = true; }
      }
    }
    fallback = true;
    frame.classList.add('model-fullscreen-window');
    document.body.classList.add('model-fullscreen-open');
  }
  async function leave() {
    if (exiting) return;
    exiting = true;
    try {
    if (fallback) restoreWindow();
    else if (nativeElement() === frame) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try { await exit.call(document); }
      catch { message.textContent = '全画面表示を解除できませんでした。もう一度押すか、Escキーで解除してください。'; }
    }
    sync();
    } finally { exiting = false; }
  }
  button.hidden = false;
  button.addEventListener('click', async () => {
    if (pending) return;
    if (!active()) previousFocus = document.activeElement;
    pending = true; button.disabled = true; message.textContent = '';
    try {
      if (active()) await leave();
      else {
        const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
        if (request) {
          try { await request.call(frame); }
          catch { if (nativeElement() !== frame && !isHidden()) expandWindow(); }
        } else if (!isHidden()) expandWindow();
        sync();
      }
    } finally { pending = false; button.disabled = false; if (active()) button.focus({preventScroll:true}); else if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus({preventScroll:true}); }
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', event => {
    if (fallback && event.key === 'Escape') { event.preventDefault(); leave(); }
  });
  // A hidden model must never remain visible in fullscreen.
  const hidden = new MutationObserver(() => {
    if (active() && isHidden()) leave();
  });
  hidden.observe(document.body, { subtree:true, attributes:true, attributeFilter:['hidden'] });
  window.addEventListener('session-ended', () => { if (active()) leave(); });
  window.addEventListener('pagehide', () => { if (active()) leave(); });
  sync();
}
