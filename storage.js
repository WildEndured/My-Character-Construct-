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

  // ============ Автосохранение с дебаунсом + хеш-проверкой ============
  function createAutoSaver(getState, delay = 5000) {
    let timer = null;
    let pending = false;
    let lastHash = null;
    let lastSavedAt = 0;

    const indicator = document.getElementById('save-indicator');

    function showIndicator() {
      if (!indicator) return;
      indicator.classList.add('show');
      clearTimeout(showIndicator._t);
      showIndicator._t = setTimeout(() => {
        indicator.classList.remove('show');
      }, 1000);
    }

    // Быстрый хеш состояния (FNV-1a)
    function hashState(state) {
      let h = 0x811c9dc5;
      const cats = state.categories || [];
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        const catKey = `${cat.id}|${cat.name}|${cat.icon || ''}|${cat.visible !== false ? 1 : 0}|${cat.opacity != null ? cat.opacity : 1}|${cat.items.length}`;
        for (let j = 0; j < catKey.length; j++) {
          h ^= catKey.charCodeAt(j);
          h = (h * 0x01000193) >>> 0;
        }
        const active = state.activeItems?.[cat.id] || '';
        for (let j = 0; j < active.length; j++) {
          h ^= active.charCodeAt(j);
          h = (h * 0x01000193) >>> 0;
        }
        for (const it of cat.items) {
          const t = it.transform;
          const tKey = t
            ? `${it.id}|${t.x || 0}|${t.y || 0}|${t.scale || 1}|${t.rotation || 0}|${t.flipX ? 1 : 0}|${t.flipY ? 1 : 0}`
            : `${it.id}|-`;
          for (let j = 0; j < tKey.length; j++) {
            h ^= tKey.charCodeAt(j);
            h = (h * 0x01000193) >>> 0;
          }
        }
      }
      const bg = state.canvasBg || '';
      for (let j = 0; j < bg.length; j++) {
        h ^= bg.charCodeAt(j);
        h = (h * 0x01000193) >>> 0;
      }
      return h.toString(36);
    }

    function schedule() {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(doSave, delay);
    }

    async function doSave() {
      if (!pending) return;
      pending = false;

      try {
        const state = getState();
        const newHash = hashState(state);

        // Ничего не изменилось — не пишем в БД
        if (newHash === lastHash) return;

        // Слишком часто — не пишем чаще, чем раз в 3 сек
        const now = Date.now();
        if (now - lastSavedAt < 3000 && lastHash !== null) {
          schedule();
          return;
        }

        await saveProject(state);
        lastHash = newHash;
        lastSavedAt = now;
        showIndicator();
      } catch (e) {
        console.error('[AutoSave] Ошибка:', e);
      }
    }

    async function flush() {
      if (!pending) return;
      clearTimeout(timer);
      await doSave();
    }

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && pending) {
        flush();
      }
    });

    return { schedule, flush, forceSave: () => { pending = true; doSave(); } };
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