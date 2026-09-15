/* storage.js — IndexedDB + автосохранение проектов */
(function(global) {
  'use strict';

  const DB_NAME = 'character_editor';
  const DB_VERSION = 1;
  const STORE_PROJECTS = 'projects';
  const STORE_SETTINGS = 'settings';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ============ Projects ============
  async function saveProject(project) {
    const store = await tx(STORE_PROJECTS, 'readwrite');
    project.updatedAt = Date.now();
    await reqToPromise(store.put(project));
    return project;
  }

  async function getProject(id) {
    const store = await tx(STORE_PROJECTS, 'readonly');
    return reqToPromise(store.get(id));
  }

  async function getAllProjects() {
    const store = await tx(STORE_PROJECTS, 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function deleteProject(id) {
    const store = await tx(STORE_PROJECTS, 'readwrite');
    return reqToPromise(store.delete(id));
  }

  // ============ Settings ============
  async function setSetting(key, value) {
    const store = await tx(STORE_SETTINGS, 'readwrite');
    return reqToPromise(store.put({ key, value }));
  }

  async function getSetting(key, defaultValue = null) {
    const store = await tx(STORE_SETTINGS, 'readonly');
    const res = await reqToPromise(store.get(key));
    return res ? res.value : defaultValue;
  }

  // ============ Автосохранение с дебаунсом ============
  function createAutoSaver(getState, delay = 1200) {
    let timer = null;
    let pending = false;

    const indicator = document.getElementById('save-indicator');

    function showIndicator() {
      if (!indicator) return;
      indicator.classList.add('show');
      clearTimeout(showIndicator._t);
      showIndicator._t = setTimeout(() => {
        indicator.classList.remove('show');
      }, 1200);
    }

    function schedule() {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!pending) return;
        pending = false;
        try {
          const state = getState();
          await saveProject(state);
          showIndicator();
        } catch (e) {
          console.error('[AutoSave] Ошибка:', e);
        }
      }, delay);
    }

    async function flush() {
      if (!pending) return;
      clearTimeout(timer);
      pending = false;
      try {
        const state = getState();
        await saveProject(state);
      } catch (e) {
        console.error('[AutoSave] Ошибка flush:', e);
      }
    }

    // Сохраняем при уходе со страницы
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return { schedule, flush };
  }

  global.Storage = {
    saveProject,
    getProject,
    getAllProjects,
    deleteProject,
    setSetting,
    getSetting,
    createAutoSaver,
  };
})(window);