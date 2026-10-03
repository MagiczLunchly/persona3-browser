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
  document.getElementById('note').textContent = remembered ? 'Loading… Click the game to enable play and sound.' : 'Game could not be remembered. Select it again next time. Click to enable play and sound.';
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
function downloadGame() {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', '/persona3portable.iso');
    request.responseType = 'blob';
    request.onprogress = event => {
      const size = event.lengthComputable ? event.total : 1321861120;
      status.textContent = `Downloading game… ${Math.min(100, Math.round(event.loaded / size * 100))}%`;
    };
    request.onload = () => {
      if (request.status !== 200 || !request.response || request.response.size !== 1321861120) {
        reject(new Error('The game download is unavailable or incomplete. Please try again.'));
      } else resolve(new File([request.response], 'persona3portable.iso', {type:'application/octet-stream'}));
    };
    request.onerror = () => reject(new Error('Could not download the game. Check your connection and try again.'));
    request.send();
  });
}
(async () => {
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
