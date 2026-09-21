/* app.js — редактор персонажа (финальная версия) */
(function() {
  'use strict';

  const CANVAS_SIZE = 4096;

  // ============================================================
  //  СОСТОЯНИЕ
  // ============================================================
  let state = {
    id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: 'Новый персонаж',
    canvasBg: '#ffffff',
    categories: [],
    activeItems: {},
    activeCategoryId: null,
    attributes: null,
  };

  const view = {
    scale: 1, offsetX: 0, offsetY: 0,
    minScale: 0.05, maxScale: 4,
    gridOn: false, checkerOn: false, centerOn: false,
  };

  // Уникальные ID с timestamp
  let uid = 1;
  const nextId = () => 'id_' + Date.now().toString(36) + '_' + (uid++).toString(36);

  function syncUidFromState() {
    let max = 0;
    for (const cat of state.categories) {
      for (const part of String(cat.id).split(/[^0-9a-z]+/i)) {
        const n = parseInt(part, 36);
        if (!isNaN(n) && n > max && n < Date.now()) max = n;
      }
      for (const it of cat.items) {
        for (const part of String(it.id).split(/[^0-9a-z]+/i)) {
          const n = parseInt(part, 36);
          if (!isNaN(n) && n > max && n < Date.now()) max = n;
        }
      }
    }
    uid = max + 1;
  }

  // ============================================================
  //  DOM
  // ============================================================
  const $ = (id) => document.getElementById(id);

  const canvas = $('canvas');
  const canvasWrap = $('canvas-wrap');
  const categoriesEl = $('categories');
  const itemsPanel = $('items-panel');
  const itemsList = $('items-list');
  const itemsTitle = $('items-title');
  const zoomInfo = $('zoom-info');
  const gridOverlay = $('grid-overlay');
  const centerMarker = $('center-marker');
  const toastsEl = $('toasts');

  const renderer = createRenderer(canvas);

  // ============================================================
  //  УТИЛИТЫ
  // ============================================================
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    toastsEl.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2000);
  }

  const confirmDialog = (msg) => Promise.resolve(window.confirm(msg));

  const progressOverlay = $('progress-overlay');
  const progressLabel = $('progress-label');
  const progressFill = $('progress-fill');

  function showProgress(label, percent) {
    progressOverlay.classList.add('show');
    progressLabel.textContent = label;
    progressFill.style.width = (percent || 0) + '%';
  }
  function updateProgress(percent, label) {
    if (label) progressLabel.textContent = label;
    progressFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  function hideProgress() {
    progressOverlay.classList.remove('show');
    progressFill.style.width = '0%';
  }

  const nextFrame = () => new Promise(r => requestAnimationFrame(r));

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ============================================================
  //  ИСТОРИЯ
  // ============================================================
  const history = createHistory(({ canUndo, canRedo }) => {
    $('btn-undo').disabled = !canUndo;
    $('btn-redo').disabled = !canRedo;
  });

  function snapshot() {
    return {
      categories: state.categories,
      activeItems: state.activeItems,
      activeCategoryId: state.activeCategoryId,
      canvasBg: state.canvasBg,
      attributes: state.attributes,
    };
  }

  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderAll();
    });
  }

  let historyTimer = null;
  let historyLabel = null;
  function scheduleHistory(label) {
    historyLabel = label;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      if (historyLabel) {
        history.push(snapshot(), historyLabel);
        historyLabel = null;
      }
    }, 400);
  }

  function commit(label) {
    clearTimeout(historyTimer);
    historyLabel = null;
    history.push(snapshot(), label);
    autoSaver.schedule();
    scheduleRender();
  }

  function restoreFromSnapshot(snap) {
    if (!snap) return;
    state.categories = snap.categories;
    state.activeItems = snap.activeItems;
    state.activeCategoryId = snap.activeCategoryId;
    state.canvasBg = snap.canvasBg;
    if (snap.attributes && attributes) {
      state.attributes = snap.attributes;
      attributes.deserialize(snap.attributes);
    }
    renderer.invalidateAll();
    renderCategories();
    if (state.activeCategoryId) renderItems();
    scheduleRender();
  }

  // ============================================================
  //  АТРИБУТЫ
  // ============================================================
  const attributes = createAttributes({
    getState: () => state,
    invalidate: (catId) => renderer.invalidate(catId),
    onBindingsChanged: () => {
      scheduleRender();
      autoSaver.schedule();
    },
    onDataChanged: (label) => {
      scheduleHistory(label);
      autoSaver.schedule();
      scheduleRender();
    },
  });

  // ============================================================
  //  АВТОСОХРАНЕНИЕ
  // ============================================================
  const autoSaver = Storage.createAutoSaver(() => {
    return {
      ...state,
      attributes: attributes.serialize(),
      categories: state.categories.map(cat => ({
        ...cat,
        items: cat.items.map(it => ({
          id: it.id,
          name: it.name,
          src: it.src,
          transform: it.transform || null,
        })),
      })),
    };
  }, 5000);

  // ============================================================
  //  РЕНДЕР
  // ============================================================
  function renderAll() {
    renderer.render({
      categories: state.categories,
      activeItems: state.activeItems,
      canvasBg: state.canvasBg,
    });
    applyTransform();
  }

  function applyTransform() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    const sw = CANVAS_SIZE * view.scale;
    const sh = CANVAS_SIZE * view.scale;
    const x = (w - sw) / 2 + view.offsetX;
    const y = (h - sh) / 2 + view.offsetY;

    canvas.style.width = sw + 'px';
    canvas.style.height = sh + 'px';
    canvas.style.left = x + 'px';
    canvas.style.top = y + 'px';

    if (view.gridOn) {
      gridOverlay.classList.add('show');
      gridOverlay.style.left = x + 'px';
      gridOverlay.style.top = y + 'px';
      gridOverlay.style.width = sw + 'px';
      gridOverlay.style.height = sh + 'px';
    } else {
      gridOverlay.classList.remove('show');
    }

    if (view.centerOn) {
      centerMarker.classList.add('show');
      centerMarker.style.left = (x + sw / 2) + 'px';
      centerMarker.style.top = (y + sh / 2) + 'px';
    } else {
      centerMarker.classList.remove('show');
    }

    zoomInfo.textContent = `4096×4096 · 300 DPI · ${Math.round(view.scale * 100)}%`;
  }

  function setScale(newScale, cx, cy) {
    newScale = Math.max(view.minScale, Math.min(view.maxScale, newScale));
    if (cx === undefined) cx = canvasWrap.clientWidth / 2;
    if (cy === undefined) cy = canvasWrap.clientHeight / 2;
    const ratio = newScale / view.scale;
    view.offsetX = (view.offsetX - (cx - canvasWrap.clientWidth / 2)) * ratio + (cx - canvasWrap.clientWidth / 2);
    view.offsetY = (view.offsetY - (cy - canvasWrap.clientHeight / 2)) * ratio + (cy - canvasWrap.clientHeight / 2);
    view.scale = newScale;
    applyTransform();
  }

  function fitToScreen() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    const s = Math.min((w - 40) / CANVAS_SIZE, (h - 40) / CANVAS_SIZE);
    view.scale = s;
    view.offsetX = 0;
    view.offsetY = 0;
    applyTransform();
  }

  // ============================================================
  //  ЖЕСТЫ КАНВАСА
  // ============================================================
  let touches = {};
  let lastDist = 0;
  let lastMid = { x: 0, y: 0 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let lastTapTime = 0;
  let lastTapPos = { x: 0, y: 0 };

  canvasWrap.addEventListener('touchstart', (e) => {
    const rect = canvasWrap.getBoundingClientRect();
    for (const t of e.changedTouches) {
      touches[t.identifier] = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    const ids = Object.keys(touches);
    if (ids.length === 1) {
      isPanning = true;
      panStart = {
        x: touches[ids[0]].x, y: touches[ids[0]].y,
        offsetX: view.offsetX, offsetY: view.offsetY,
      };
    } else if (ids.length === 2) {
      isPanning = false;
      const [a, b] = ids.map(id => touches[id]);
      lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }, { passive: false });

  canvasWrap.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (touches[t.identifier]) {
        touches[t.identifier].x = t.clientX - rect.left;
        touches[t.identifier].y = t.clientY - rect.top;
      }
    }
    const ids = Object.keys(touches);
    if (ids.length === 1 && isPanning) {
      const t = touches[ids[0]];
      view.offsetX = panStart.offsetX + (t.x - panStart.x);
      view.offsetY = panStart.offsetY + (t.y - panStart.y);
      applyTransform();
    } else if (ids.length === 2) {
      const [a, b] = ids.map(id => touches[id]);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastDist > 0) {
        setScale(view.scale * (dist / lastDist), mid.x, mid.y);
        view.offsetX += mid.x - lastMid.x;
        view.offsetY += mid.y - lastMid.y;
        applyTransform();
      }
      lastDist = dist;
      lastMid = mid;
    }
  }, { passive: false });

  const endTouch = (e) => {
    for (const t of e.changedTouches) delete touches[t.identifier];
    const ids = Object.keys(touches);
    if (ids.length === 0) {
      isPanning = false;
      lastDist = 0;
      const now = Date.now();
      const t = e.changedTouches[0];
      if (now - lastTapTime < 300) {
        const dx = t.clientX - lastTapPos.x;
        const dy = t.clientY - lastTapPos.y;
        if (Math.hypot(dx, dy) < 30) {
          const rect = canvasWrap.getBoundingClientRect();
          const target = view.scale > 0.5 ? 0.15 : 0.8;
          setScale(target, t.clientX - rect.left, t.clientY - rect.top);
        }
      }
      lastTapTime = now;
      lastTapPos = { x: t.clientX, y: t.clientY };
    } else if (ids.length === 1) {
      isPanning = true;
      const t = touches[ids[0]];
      panStart = { x: t.x, y: t.y, offsetX: view.offsetX, offsetY: view.offsetY };
      lastDist = 0;
    }
  };
  canvasWrap.addEventListener('touchend', endTouch, { passive: false });
  canvasWrap.addEventListener('touchcancel', endTouch, { passive: false });

  let mouseDown = false;
  let mouseStart = { x: 0, y: 0 };
  let mouseOffsetStart = { x: 0, y: 0 };
  canvasWrap.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseStart = { x: e.clientX, y: e.clientY };
    mouseOffsetStart = { x: view.offsetX, y: view.offsetY };
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    view.offsetX = mouseOffsetStart.x + (e.clientX - mouseStart.x);
    view.offsetY = mouseOffsetStart.y + (e.clientY - mouseStart.y);
    applyTransform();
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    setScale(view.scale * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  // ============================================================
  //  КАТЕГОРИИ
  // ============================================================
  function renderCategories() {
    categoriesEl.innerHTML = '';
    for (const cat of state.categories) {
      const tab = document.createElement('div');
      tab.className = 'cat-tab' + (cat.id === state.activeCategoryId ? ' active' : '');
      tab.dataset.id = cat.id;

      // Видимость
      const vis = document.createElement('div');
      vis.className = 'visibility-btn' + (cat.visible === false ? ' off' : '');
      vis.textContent = cat.visible === false ? '○' : '●';
      vis.addEventListener('click', (e) => {
        e.stopPropagation();
        cat.visible = cat.visible === false ? true : false;
        renderer.invalidate(cat.id);
        commit('visibility');
        renderCategories();
      });
      tab.appendChild(vis);

      if (cat.icon) {
        const icon = document.createElement('span');
        icon.className = 'cat-icon';
        icon.textContent = cat.icon;
        tab.appendChild(icon);
      }

      const name = document.createElement('span');
      name.textContent = cat.name;
      tab.appendChild(name);

      // Кнопка редактирования
      const editBtn = document.createElement('div');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(10);
        openCategoryEdit(cat.id);
      });
      tab.appendChild(editBtn);

      // Кнопка удаления
      const del = document.createElement('div');
      del.className = 'del-x';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(cat.id);
      });
      tab.appendChild(del);

      // Тап = открыть категорию
      let startX = 0, startY = 0, moved = false;
      let longPressTimer = null;

      const onStart = (e) => {
        if (e.target.closest('.del-x, .visibility-btn, .edit-btn')) return;
        moved = false;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (!moved && navigator.vibrate) navigator.vibrate(20);
        }, 900);
      };

      const onMove = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
          moved = true;
          clearTimeout(longPressTimer);
        }
      };

      const onEnd = (e) => {
        clearTimeout(longPressTimer);
        if (moved) return;
        if (e.target.closest('.del-x, .visibility-btn, .edit-btn')) return;
        openCategory(cat.id);
      };

      tab.addEventListener('touchstart', onStart, { passive: true });
      tab.addEventListener('touchmove', onMove, { passive: true });
      tab.addEventListener('touchend', onEnd);
      tab.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
      tab.addEventListener('mousedown', onStart);
      tab.addEventListener('mousemove', onMove);
      tab.addEventListener('mouseup', onEnd);

      categoriesEl.appendChild(tab);
    }
  }

  function openCategoryEdit(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    editingCategoryId = catId;
    $('cat-edit-name').value = cat.name;
    $('cat-edit-icon').value = cat.icon || '';
    updateCategoryEditPosition();
    $('modal-cat-edit').classList.add('open');
    setTimeout(() => {
      const inp = $('cat-edit-name');
      inp.focus();
      inp.select();
    }, 50);
  }

  let editingCategoryId = null;

  function updateCategoryEditPosition() {
    const idx = state.categories.findIndex(c => c.id === editingCategoryId);
    const total = state.categories.length;
    const el = $('cat-edit-position');
    if (!el) return;
    el.textContent = `${idx + 1} из ${total}`;
    if ($('cat-edit-left')) $('cat-edit-left').disabled = idx <= 0;
    if ($('cat-edit-right')) $('cat-edit-right').disabled = idx >= total - 1;
  }

  function moveCategoryBy(direction) {
    const idx = state.categories.findIndex(c => c.id === editingCategoryId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= state.categories.length) return;
    const [moved] = state.categories.splice(idx, 1);
    state.categories.splice(newIdx, 0, moved);
    renderer.invalidateAll();
    renderCategories();
    updateCategoryEditPosition();
    commit('move-category');
  }

  function saveCategoryEdit() {
    if (!editingCategoryId) return;
    const cat = state.categories.find(c => c.id === editingCategoryId);
    if (!cat) return;
    const newName = $('cat-edit-name').value.trim();
    const newIcon = $('cat-edit-icon').value.trim();
    if (!newName) { toast('Введите название', 'error'); return; }
    const changed = cat.name !== newName || (cat.icon || '') !== newIcon;
    cat.name = newName;
    cat.icon = newIcon || undefined;
    if (changed) {
      commit('rename-category');
      toast('Категория обновлена', 'success');
    }
    closeCategoryEdit();
  }

  function closeCategoryEdit() {
    $('modal-cat-edit').classList.remove('open');
    editingCategoryId = null;
    renderCategories();
  }

  function openCategory(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    state.activeCategoryId = catId;
    renderCategories();
    renderItems();
    itemsPanel.classList.add('open');
    itemsTitle.textContent = cat.name;
  }

  function addCategory(name, icon) {
    const trimmed = (name || '').trim();
    if (!trimmed) { toast('Введите название', 'error'); return null; }

    const cat = {
      id: nextId(),
      name: trimmed,
      icon: icon || undefined,
      visible: true,
      opacity: 1,
      items: [],
    };
    state.categories.push(cat);
    state.activeCategoryId = cat.id;
    renderCategories();
    openCategory(cat.id);
    commit('add-category');
    return cat;
  }

  function deleteCategory(catId) {
    if (!confirmDialog('Удалить категорию и все её элементы?')) return;
    state.categories = state.categories.filter(c => c.id !== catId);
    delete state.activeItems[catId];
    renderer.invalidate(catId);
    if (state.activeCategoryId === catId) {
      state.activeCategoryId = state.categories[0]?.id || null;
      if (state.activeCategoryId) openCategory(state.activeCategoryId);
      else itemsPanel.classList.remove('open');
    }
    renderCategories();
    commit('delete-category');
  }

  // ============================================================
  //  ЭЛЕМЕНТЫ (упрощённая логика через меню)
  // ============================================================
  function renderItems() {
    itemsList.innerHTML = '';
    const cat = state.categories.find(c => c.id === state.activeCategoryId);
    if (!cat) return;

    for (const item of cat.items) {
      const card = document.createElement('div');
      card.className = 'item-card' + (state.activeItems[cat.id] === item.id ? ' active' : '');
      card.dataset.itemId = item.id;

      if (item.img) {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name;
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        card.textContent = item.name;
      }

      const label = document.createElement('div');
      label.className = 'item-name-label';
      label.textContent = item.name;
      card.appendChild(label);

      // Кнопка удаления — отдельный тап
      const delBtn = document.createElement('div');
      delBtn.className = 'del-x';
      delBtn.textContent = '×';
      card.appendChild(delBtn);

      // === Вся карточка = открыть меню ===
      // Используем только click — он работает и на тач, и на мышь,
      // если убрать touch-action manipulation с родителя
      card.addEventListener('click', (e) => {
        // Если тап по кнопке удаления — не открываем меню
        if (e.target === delBtn || delBtn.contains(e.target)) {
          e.stopPropagation();
          deleteItem(cat.id, item.id);
          return;
        }
        openItemActionMenu(cat.id, item.id);
      });

      itemsList.appendChild(card);
    }

    // Кнопка добавления
    const addBtn = document.createElement('div');
    addBtn.className = 'item-card add-item-btn';
    addBtn.textContent = '＋';
    addBtn.addEventListener('click', () => openModalItem(cat.id));
    itemsList.appendChild(addBtn);
  }

  // ============================================================
  //  МЕНЮ ДЕЙСТВИЙ
  // ============================================================
  let actionMenuData = null;

  function openItemActionMenu(catId, itemId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;

    actionMenuData = { catId, itemId };
    const modal = $('modal-item-actions');

    const preview = $('item-action-preview');
    const nameEl = $('item-action-name');
    const selectBtn = $('item-action-select');
    const isActive = state.activeItems[catId] === itemId;

    preview.innerHTML = '';
    if (item.src) {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.name;
      preview.appendChild(img);
    }

    nameEl.textContent = item.name || 'Без названия';

    if (isActive) {
      selectBtn.textContent = '✕ Снять выбор';
      selectBtn.className = 'btn item-action-big';
    } else {
      selectBtn.textContent = '✓ Выбрать';
      selectBtn.className = 'btn primary item-action-big';
    }

    modal.classList.add('open');
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function closeItemActionMenu() {
    $('modal-item-actions').classList.remove('open');
    actionMenuData = null;
  }

  function toggleItem(catId, itemId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;

    if (state.activeItems[catId] === itemId) {
      delete state.activeItems[catId];
    } else {
      state.activeItems[catId] = itemId;
    }

    // Обновляем только подсветку карточек
    const cards = itemsList.querySelectorAll('.item-card[data-item-id]');
    cards.forEach(c => {
      c.classList.toggle('active', state.activeItems[catId] === c.dataset.itemId);
    });

    renderer.invalidate(catId);
    scheduleHistory('toggle-item');
    autoSaver.schedule();
    scheduleRender();
  }

  function deleteItem(catId, itemId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    cat.items = cat.items.filter(i => i.id !== itemId);
    if (state.activeItems[catId] === itemId) delete state.activeItems[catId];
    renderer.invalidate(catId);
    renderItems();
    commit('delete-item');
  }

  function duplicateItem(catId, itemId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;

    const copy = {
      id: nextId(),
      name: item.name + ' (копия)',
      src: item.src,
      img: item.img,
      transform: item.transform ? { ...item.transform } : null,
    };
    const idx = cat.items.indexOf(item);
    cat.items.splice(idx + 1, 0, copy);
    renderItems();
    commit('duplicate-item');
    toast('Дублировано');
  }

  // ============================================================
  //  МОДАЛКА ДОБАВЛЕНИЯ
  // ============================================================
  let pendingFiles = [];
  let pendingTargetCatId = null;

  function openModalItem(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) {
      toast('Категория не найдена', 'error');
      return;
    }

    pendingTargetCatId = catId;
    pendingFiles = [];

    $('item-file').value = '';
    $('item-files-list').innerHTML = '';
    $('item-files-list-wrap').style.display = 'none';
    $('item-files-count').textContent = '';
    $('item-save').disabled = true;

    const hintEl = document.querySelector('#modal-item .hint');
    if (hintEl) {
      hintEl.textContent = `Будут добавлены в категорию: «${cat.name}»`;
    }

    $('modal-item').classList.add('open');
  }

  function renderPendingFilesList() {
    const list = $('item-files-list');
    const wrap = $('item-files-list-wrap');
    const count = $('item-files-count');
    const saveBtn = $('item-save');

    list.innerHTML = '';

    if (pendingFiles.length === 0) {
      wrap.style.display = 'none';
      saveBtn.disabled = true;
      return;
    }

    wrap.style.display = 'block';
    count.textContent = `(${pendingFiles.length})`;
    saveBtn.disabled = false;

    pendingFiles.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'item-file-row';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      if (item.thumbSrc) {
        const img = document.createElement('img');
        img.src = item.thumbSrc;
        thumb.appendChild(img);
      }
      row.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'info';

      const origName = document.createElement('div');
      origName.className = 'original-name';
      origName.textContent = item.file.name;
      info.appendChild(origName);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'name-input';
      nameInput.value = item.name;
      nameInput.placeholder = 'Название элемента';
      nameInput.addEventListener('input', () => {
        pendingFiles[idx].name = nameInput.value;
      });
      info.appendChild(nameInput);

      row.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-file';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        pendingFiles.splice(idx, 1);
        renderPendingFilesList();
      });
      row.appendChild(removeBtn);

      list.appendChild(row);
    });
  }

  function setupItemFileInput() {
    const input = $('item-file');
    if (!input) return;

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;

      showProgress('Чтение файлов…', 0);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateProgress((i / files.length) * 100, `Чтение ${i + 1}/${files.length}`);
        await nextFrame();

        const originalName = file.name.replace(/\.[^.]+$/, '');
        let src = null;
        let thumbSrc = null;

        try {
          src = await readFileAsDataURL(file);
          thumbSrc = await makeThumbnailFromDataURL(src, 128);
        } catch (e) {
          console.warn('Ошибка чтения', file.name, e);
          continue;
        }

        pendingFiles.push({ file, src, thumbSrc, name: originalName });
      }

      hideProgress();
      input.value = '';
      renderPendingFilesList();
    });
  }

  function makeThumbnailFromDataURL(dataUrl, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          const ratio = img.width / img.height;
          let w = size, h = size;
          if (ratio > 1) h = Math.round(size / ratio);
          else w = Math.round(size * ratio);
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.7));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function setupItemNamesActions() {
    const clearBtn = $('item-names-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        pendingFiles.forEach(f => { f.name = ''; });
        renderPendingFilesList();
      });
    }

    const stripBtn = $('item-names-strip-ext');
    if (stripBtn) {
      stripBtn.addEventListener('click', () => {
        pendingFiles.forEach(f => {
          f.name = f.file.name.replace(/\.[^.]+$/, '');
        });
        renderPendingFilesList();
      });
    }

    const numberBtn = $('item-names-number');
    if (numberBtn) {
      numberBtn.addEventListener('click', () => {
        const prefix = pendingFiles.length > 0 && pendingFiles[0].name
          ? pendingFiles[0].name.replace(/\s*\d+\s*$/, '')
          : 'Элемент';
        pendingFiles.forEach((f, i) => {
          f.name = `${prefix} ${i + 1}`;
        });
        renderPendingFilesList();
      });
    }
  }

  async function addItemsFromPrepared(catId, items) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) {
      toast('Категория не найдена', 'error');
      return;
    }
    if (!items || items.length === 0) return;

    showProgress('Добавление...', 0);

    for (let i = 0; i < items.length; i++) {
      const { name, src } = items[i];
      updateProgress((i / items.length) * 100, `${i + 1} / ${items.length}`);
      await nextFrame();

      try {
        const img = await Exporter.loadImage(src);
        const item = {
          id: nextId(),
          name: name || 'Элемент',
          src,
          img,
          transform: null,
        };
        cat.items.push(item);

        // Автовыбор — только если в этой категории нет активного
        if (i === 0 && !state.activeItems[cat.id]) {
          state.activeItems[cat.id] = item.id;
        }
      } catch (e) {
        console.warn('Ошибка загрузки', name, e);
      }
    }

    updateProgress(100);
    hideProgress();
    renderer.invalidate(catId);
    renderItems();
    commit('add-items');
    toast(`Добавлено: ${items.length} в «${cat.name}»`);
  }

  // ============================================================
  //  ПЕРЕИМЕНОВАНИЕ ЭЛЕМЕНТА
  // ============================================================
  let renamingItemRef = null;

  function openItemRename(catId, itemId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;

    renamingItemRef = { catId, itemId };
    $('item-rename-name').value = item.name || '';
    $('modal-item-rename').classList.add('open');
    setTimeout(() => {
      const inp = $('item-rename-name');
      inp.focus();
      inp.select();
    }, 100);
  }

  function saveItemRename() {
    if (!renamingItemRef) return;
    const { catId, itemId } = renamingItemRef;
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;

    const newName = $('item-rename-name').value.trim();
    if (!newName) { toast('Введите название', 'error'); return; }

    if (item.name !== newName) {
      item.name = newName;
      renderItems();
      commit('rename-item');
      toast('Переименовано', 'success');
    }

    $('modal-item-rename').classList.remove('open');
    renamingItemRef = null;
  }

  // ============================================================
  //  СЛОИ
  // ============================================================
  const layersModal = $('modal-layers');
  const layersList = $('layers-list');

  function openLayers() {
    renderLayers();
    layersModal.classList.add('open');
  }

  function renderLayers() {
    layersList.innerHTML = '';
    const ordered = [...state.categories].reverse();

    for (const cat of ordered) {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.dataset.id = cat.id;

      const handle = document.createElement('div');
      handle.className = 'handle';
      handle.textContent = '⠿';
      row.appendChild(handle);

      const name = document.createElement('div');
      name.className = 'layer-name';
      name.textContent = (cat.icon ? cat.icon + ' ' : '') + cat.name;
      if (cat.visible === false) name.style.opacity = '0.4';
      row.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'layer-actions';

      const visBtn = document.createElement('button');
      visBtn.className = 'btn';
      visBtn.textContent = cat.visible === false ? '○' : '●';
      visBtn.addEventListener('click', () => {
        cat.visible = cat.visible === false ? true : false;
        renderer.invalidateAll();
        commit('visibility');
        renderLayers();
        renderCategories();
      });
      actions.appendChild(visBtn);

      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', () => {
        layersModal.classList.remove('open');
        openCategoryEdit(cat.id);
      });
      actions.appendChild(editBtn);

      const upBtn = document.createElement('button');
      upBtn.className = 'btn';
      upBtn.textContent = '↑';
      upBtn.disabled = state.categories.indexOf(cat) === state.categories.length - 1;
      upBtn.addEventListener('click', () => moveLayer(cat.id, +1));
      actions.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.className = 'btn';
      downBtn.textContent = '↓';
      downBtn.disabled = state.categories.indexOf(cat) === 0;
      downBtn.addEventListener('click', () => moveLayer(cat.id, -1));
      actions.appendChild(downBtn);

      row.appendChild(actions);
      layersList.appendChild(row);
    }
  }

  function moveLayer(catId, direction) {
    const i = state.categories.findIndex(c => c.id === catId);
    if (i < 0) return;
    const j = i + direction;
    if (j < 0 || j >= state.categories.length) return;
    [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
    renderer.invalidateAll();
    commit('move-layer');
    renderLayers();
    renderCategories();
  }

  // ============================================================
  //  ЭКСПОРТ
  // ============================================================
  function openExportModal() {
    $('modal-export').classList.add('open');
  }

  async function doExport(format, size, transparent) {
    showProgress('Подготовка…', 5);
    await nextFrame();

    try {
      if (format === 'png') {
        const composite = renderer.getComposite({
          categories: state.categories,
          activeItems: state.activeItems,
          canvasBg: transparent ? null : state.canvasBg,
        });
        updateProgress(40, 'Масштабирование…');
        await nextFrame();
        const resized = Exporter.resizeCanvas(composite, size);
        updateProgress(70, 'Кодирование PNG…');
        await nextFrame();
        const blob = await Exporter.canvasToPngWithDpi(resized, Exporter.DPI);
        updateProgress(95);
        Exporter.download(blob, `character_${size}x${size}_300dpi.png`);
        toast('PNG экспортирован', 'success');
      } else if (format === 'psd') {
        updateProgress(20, 'Сбор слоёв…');
        await nextFrame();
        const layers = [];
        if (!transparent) {
          const bg = document.createElement('canvas');
          bg.width = CANVAS_SIZE;
          bg.height = CANVAS_SIZE;
          const bgx = bg.getContext('2d');
          bgx.fillStyle = state.canvasBg || '#ffffff';
          bgx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          layers.push({ name: 'Фон', canvas: bg });
        }
        for (const cat of state.categories) {
          if (cat.visible === false) continue;
          const activeId = state.activeItems[cat.id];
          if (!activeId) continue;
          const item = cat.items.find(i => i.id === activeId);
          if (!item || !item.img) continue;
          const lc = document.createElement('canvas');
          lc.width = CANVAS_SIZE;
          lc.height = CANVAS_SIZE;
          const lx = lc.getContext('2d');
          drawItemWithTransform(lx, item);
          layers.push({ name: cat.name, canvas: lc });
        }
        updateProgress(60, 'Кодирование PSD…');
        await nextFrame();
        const blob = await Exporter.buildPSD(layers, CANVAS_SIZE, CANVAS_SIZE);
        updateProgress(95);
        Exporter.download(blob, 'character.psd');
        toast('PSD экспортирован', 'success');
      } else if (format === 'json') {
        const json = Exporter.serializeProject({
          ...state,
          attributes: attributes.serialize(),
          categories: state.categories,
        });
        const blob = new Blob([json], { type: 'application/json' });
        Exporter.download(blob, `character_${Date.now()}.json`);
        toast('JSON экспортирован', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Ошибка экспорта: ' + e.message, 'error');
    } finally {
      hideProgress();
    }
  }

  function drawItemWithTransform(context, item) {
    const img = item.img;
    if (!img) return;
    const t = item.transform;
    if (!t) {
      context.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      return;
    }
    const { x = 0, y = 0, scale = 1, rotation = 0, flipX = false, flipY = false } = t;
    context.save();
    context.translate(CANVAS_SIZE / 2 + x, CANVAS_SIZE / 2 + y);
    context.rotate(rotation);
    context.scale(flipX ? -scale : scale, flipY ? -scale : scale);
    context.drawImage(img, -CANVAS_SIZE / 2, -CANVAS_SIZE / 2, CANVAS_SIZE, CANVAS_SIZE);
    context.restore();
  }

  // ============================================================
  //  ГАЛЕРЕЯ
  // ============================================================
  const gallery = createGallery({
    getCurrentState: () => state,
    loadState: (newState) => {
      renderer.invalidateAll();
      state = { ...newState };
      syncUidFromState();
      if (state.attributes) {
        attributes.deserialize(state.attributes);
      } else {
        attributes.reset();
      }
      renderCategories();
      if (state.activeCategoryId) openCategory(state.activeCategoryId);
      else itemsPanel.classList.remove('open');
      history.reset(snapshot());
      scheduleRender();
      setTimeout(() => {
        try { attributes.applyAllBindings(); } catch (e) { console.warn(e); }
      }, 500);
      autoSaver.schedule();
    },
    toast,
    confirm: confirmDialog,
  });

  // ============================================================
  //  BINDINGS UI
  // ============================================================
  let bindingsUI = null;
  function getBindingsUI() {
    if (!bindingsUI) {
      bindingsUI = createBindingsUI(attributes, {
        getState: () => state,
        toast,
      });
    }
    return bindingsUI;
  }

  // ============================================================
  //  МОДАЛКИ — общие обработчики
  // ============================================================
  function setupModals() {
    document.querySelectorAll('.modal-bg').forEach(bg => {
      bg.addEventListener('click', (e) => {
        if (e.target === bg) {
          if (bindingsUI) bindingsUI.closeAutocomplete();
          bg.classList.remove('open');
        }
      });
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (bindingsUI) bindingsUI.closeAutocomplete();
        btn.closest('.modal-bg').classList.remove('open');
      });
    });
  }

  // ============================================================
  //  UI — обработчики
  // ============================================================
  function bindUI() {
    setupItemFileInput();
    setupItemNamesActions();

    // === Undo/Redo ===
    $('btn-undo').addEventListener('click', () => {
      const s = history.undo();
      if (s) restoreFromSnapshot(s);
    });
    $('btn-redo').addEventListener('click', () => {
      const s = history.redo();
      if (s) restoreFromSnapshot(s);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        $('btn-undo').click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        $('btn-redo').click();
      }
    });

    // === Меню действий с элементом ===
    $('item-action-select').addEventListener('click', () => {
      if (!actionMenuData) return;
      const { catId, itemId } = actionMenuData;
      toggleItem(catId, itemId);
      closeItemActionMenu();
    });

    $('item-action-rename').addEventListener('click', () => {
      if (!actionMenuData) return;
      const { catId, itemId } = actionMenuData;
      closeItemActionMenu();
      setTimeout(() => openItemRename(catId, itemId), 200);
    });

    $('item-action-duplicate').addEventListener('click', () => {
      if (!actionMenuData) return;
      const { catId, itemId } = actionMenuData;
      closeItemActionMenu();
      duplicateItem(catId, itemId);
    });

    $('item-action-delete').addEventListener('click', () => {
      if (!actionMenuData) return;
      const { catId, itemId } = actionMenuData;
      closeItemActionMenu();
      deleteItem(catId, itemId);
    });

    $('item-action-cancel').addEventListener('click', closeItemActionMenu);

    // === Атрибуты ===
    $('btn-attributes').addEventListener('click', () => {
      getBindingsUI().open();
    });

    const attrAddModule = $('attr-add-module');
    if (attrAddModule) {
      attrAddModule.addEventListener('click', () => {
        const name = prompt('Название модуля:', 'Новый модуль');
        if (name === null) return;
        attributes.addModule(name);
        getBindingsUI().scheduleRender();
      });
    }

    const catPickerCancel = $('category-picker-cancel');
    if (catPickerCancel) {
      catPickerCancel.addEventListener('click', () => {
        $('modal-category-picker').classList.remove('open');
      });
    }

    // === Галерея ===
    $('btn-gallery').addEventListener('click', () => gallery.open());
    $('gallery-new').addEventListener('click', async () => {
      const name = prompt('Название персонажа:', 'Персонаж');
      if (name === null) return;
      const proj = await gallery.createNew(name);
      state.id = proj.id;
      state.name = proj.name;
      autoSaver.schedule();
      toast('Новый персонаж создан');
      gallery.close();
    });
    $('gallery-import').addEventListener('click', () => {
      $('modal-import').classList.add('open');
    });

    // === Слои ===
    $('btn-layers').addEventListener('click', openLayers);

    // === Новая категория ===
    $('btn-add-cat').addEventListener('click', () => {
      $('cat-name').value = '';
      $('modal-cat').classList.add('open');
      setTimeout(() => $('cat-name').focus(), 50);
    });
    $('cat-save').addEventListener('click', () => {
      const name = $('cat-name').value.trim();
      if (!name) { toast('Введите название', 'error'); return; }
      addCategory(name);
      $('modal-cat').classList.remove('open');
    });

    // === Сохранение элементов ===
    $('item-save').addEventListener('click', async () => {
      const catId = pendingTargetCatId;
      if (!catId) {
        toast('Категория не выбрана', 'error');
        return;
      }
      if (!state.categories.find(c => c.id === catId)) {
        toast('Категория была удалена', 'error');
        pendingTargetCatId = null;
        pendingFiles = [];
        $('modal-item').classList.remove('open');
        return;
      }
      if (pendingFiles.length === 0) {
        toast('Выберите изображения', 'error');
        return;
      }

      const itemsToAdd = pendingFiles.map(pf => ({
        name: pf.name.trim() || pf.file.name.replace(/\.[^.]+$/, ''),
        src: pf.src,
      }));

      $('modal-item').classList.remove('open');
      await addItemsFromPrepared(catId, itemsToAdd);

      pendingFiles = [];
      pendingTargetCatId = null;
    });

    // === Переименование ===
    const itemRenameSave = $('item-rename-save');
    if (itemRenameSave) itemRenameSave.addEventListener('click', saveItemRename);
    const itemRenameInput = $('item-rename-name');
    if (itemRenameInput) {
      itemRenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveItemRename();
        }
      });
    }

    // === Экспорт/импорт ===
    $('btn-export').addEventListener('click', openExportModal);
    setupExportModal();

    $('btn-import').addEventListener('click', () => {
      $('import-file').value = '';
      $('modal-import').classList.add('open');
    });
    $('import-confirm').addEventListener('click', async () => {
      const file = $('import-file').files[0];
      if (!file) { toast('Выберите файл', 'error'); return; }
      const text = await file.text();
      const proj = await gallery.importFromJSON(text);
      if (proj) {
        $('modal-import').classList.remove('open');
        await gallery.loadProject(proj.id);
      }
    });

    // === Новый проект ===
    $('btn-new').addEventListener('click', async () => {
      if (!await confirmDialog('Создать нового персонажа? Текущий сохранится в галерее.')) return;
      const name = prompt('Название персонажа:', 'Персонаж');
      if (name === null) return;
      const proj = await gallery.createNew(name);
      renderer.invalidateAll();
      state.categories = [];
      state.activeItems = {};
      state.activeCategoryId = null;
      state.id = proj.id;
      state.name = proj.name;
      state.canvasBg = '#ffffff';
      state.attributes = null;
      attributes.reset();
      uid = 1;
      renderCategories();
      itemsPanel.classList.remove('open');
      history.reset(snapshot());
      scheduleRender();
      toast('Новый персонаж создан');
    });

    $('btn-close-items').addEventListener('click', () => {
      itemsPanel.classList.remove('open');
    });

    // === Зум ===
    $('zoom-in').addEventListener('click', () => setScale(view.scale * 1.25));
    $('zoom-out').addEventListener('click', () => setScale(view.scale * 0.8));
    $('zoom-100').addEventListener('click', () => {
      view.offsetX = 0;
      view.offsetY = 0;
      setScale(1);
    });
    $('zoom-fit').addEventListener('click', fitToScreen);

    // === Инструменты ===
    $('tool-grid').addEventListener('click', (e) => {
      view.gridOn = !view.gridOn;
      e.currentTarget.classList.toggle('active', view.gridOn);
      applyTransform();
    });
    $('tool-checker').addEventListener('click', (e) => {
      view.checkerOn = !view.checkerOn;
      e.currentTarget.classList.toggle('active', view.checkerOn);
      canvasWrap.classList.toggle('checker', view.checkerOn);
    });
    $('tool-center').addEventListener('click', (e) => {
      view.centerOn = !view.centerOn;
      e.currentTarget.classList.toggle('active', view.centerOn);
      applyTransform();
    });

    // === Редактирование категории ===
    $('cat-edit-save').addEventListener('click', saveCategoryEdit);
    $('cat-edit-left').addEventListener('click', () => moveCategoryBy(-1));
    $('cat-edit-right').addEventListener('click', () => moveCategoryBy(+1));
    $('cat-edit-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveCategoryEdit(); }
    });
  }

  // ============================================================
  //  ЭКСПОРТ МОДАЛКА
  // ============================================================
  let exportFormat = 'png';
  let exportSize = 4096;

  function setupExportModal() {
    const formatPresets = document.querySelectorAll('#export-format-presets .export-preset');
    formatPresets.forEach(p => {
      p.addEventListener('click', () => {
        formatPresets.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        exportFormat = p.dataset.format;
        $('export-png-opts').style.display = exportFormat === 'png' ? '' : 'none';
        $('export-psd-opts').style.display = exportFormat === 'psd' ? '' : 'none';
        $('export-json-opts').style.display = exportFormat === 'json' ? '' : 'none';
      });
    });
    const sizePresets = document.querySelectorAll('#export-size-presets .export-preset');
    sizePresets.forEach(p => {
      p.addEventListener('click', () => {
        sizePresets.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        exportSize = parseInt(p.dataset.size, 10);
      });
    });
    $('export-confirm').addEventListener('click', async () => {
      const transparent = $('export-transparent').checked;
      $('modal-export').classList.remove('open');
      await doExport(exportFormat, exportSize, transparent);
    });
  }

  // ============================================================
  //  ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  async function init() {
    setupModals();
    bindUI();

    try {
      const projects = await Storage.getAllProjects();
      if (projects.length > 0) {
        await gallery.loadProject(projects[0].id);
        syncUidFromState();
      } else {
        addCategory('Тело');
        addCategory('Глаза');
        addCategory('Рот');
        addCategory('Одежда');
        state.activeCategoryId = state.categories[0].id;
        renderCategories();
        history.reset(snapshot());
        const proj = await gallery.createNew(state.name);
        state.id = proj.id;
        autoSaver.schedule();
      }
    } catch (e) {
      console.error('Ошибка инициализации:', e);
      renderCategories();
    }

    requestAnimationFrame(fitToScreen);

    window.addEventListener('resize', () => applyTransform());
    window.addEventListener('orientationchange', () => setTimeout(applyTransform, 300));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        autoSaver.flush();
      }
    });
  }

  init();
})();