'use strict';
const choose = document.getElementById('choose');
const status = document.getElementById('status');
let database;
let started = false;
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('persona3-local-game', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('game');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other player tabs and reload.'));
  });
}
function readGame() {
  return new Promise((resolve, reject) => {
    const request = database.transaction('game').objectStore('game').get('iso');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function saveGame(file) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('game', 'readwrite');
    tx.objectStore('game').put(file, 'iso');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('Could not save the game.'));
    tx.onerror = () => reject(tx.error);
  });
}
function boot(file, remembered = true) {
  if (started) return;
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    status.textContent = 'PSP emulation needs a supported browser and the correct website settings. Try Chrome or Edge.';
    choose.disabled = false;
    return;
  }
  started = true;
  window.EJS_player = '#game';
  window.EJS_core = 'psp';
  window.EJS_gameName = 'Persona 3 Portable';
  window.EJS_gameUrl = URL.createObjectURL(file);
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_threads = true;
  window.EJS_startOnLoaded = true;
  window.EJS_color = '#40bcff';
  window.EJS_onGameStart = () => { document.getElementById('note').hidden = remembered; };
  document.getElementById('setup').hidden = true;
  document.getElementById('note').hidden = false;
  document.getElementById('note').textContent = remembered ? 'Loading… Click the game to enable play and sound.' : 'Loading… Click the game to enable play and sound. The game will download again next visit.';
  const script = document.createElement('script');
  script.src = window.EJS_pathtodata + 'loader.js';
  script.crossOrigin = 'anonymous';
  script.onerror = () => {
    document.getElementById('setup').hidden = false;
    status.textContent = 'Could not download the emulator. Check your connection and reload.';
    choose.disabled = true;
  };
  document.body.append(script);
}
choose.onclick = () => location.reload();
async function downloadGame() {
  const size = 1321861120, chunkSize = 4 * 1024 * 1024;
  const count = Math.ceil(size / chunkSize), chunks = new Array(count);
  let next = 0, loaded = 0;
  async function worker() {
    while (next < count) {
      const index = next++, start = index * chunkSize, end = Math.min(size - 1, start + chunkSize - 1);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`/api/game?start=${start}&end=${end}`);
          if (!response.ok) throw new Error('The game download is unavailable. Please try again shortly.');
          const blob = await response.blob();
          if (blob.size !== end-start+1) throw new Error('The game download is incomplete. Please try again.');
          chunks[index] = blob;
          loaded += blob.size;
          status.textContent = `Downloading game… ${Math.round(loaded / size * 100)}%`;
          lastError = null;
          break;
        } catch (error) { lastError = error; }
      }
      if (lastError) throw lastError;
    }
  }
  await Promise.all(Array.from({length:4}, worker));
  return new File(chunks, 'persona3portable.iso', {type:'application/octet-stream'});
}
(async () => {
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    status.textContent = 'This embed needs browser isolation enabled on the surrounding website. Open the player directly or update the hosting settings.';
    return;
  }
  try {
    database = await openDatabase();
    const file = await readGame();
    if (file) { boot(file); return; }
  } catch (error) { console.warn('Local game cache unavailable:', error.name); }
  try {
    status.textContent = 'Downloading game…';
    const file = await downloadGame();
    let remembered = false;
    if (database) {
      status.textContent = 'Saving for your next visit…';
      try { await saveGame(file); remembered = true; } catch (error) { console.warn('Could not cache game:', error.name); }
    }
    boot(file, remembered);
  } catch (error) {
    status.textContent = error.message;
    choose.hidden = false;
  }
})();
