/* app.js — сборка редактора (с фиксами производительности) */
(function() {
  'use strict';

  const CANVAS_SIZE = 4096;

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

  let uid = 1;
  const nextId = () => 'id_' + (uid++);

  const canvas = document.getElementById('canvas');
  const canvasWrap = document.getElementById('canvas-wrap');
  const categoriesEl = document.getElementById('categories');
  const itemsPanel = document.getElementById('items-panel');
  const itemsList = document.getElementById('items-list');
  const itemsTitle = document.getElementById('items-title');
  const zoomInfo = document.getElementById('zoom-info');
  const gridOverlay = document.getElementById('grid-overlay');
  const centerMarker = document.getElementById('center-marker');

  const renderer = createRenderer(canvas);

  // ============ Тост ============
  const toastsEl = document.getElementById('toasts');
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    toastsEl.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2200);
  }

  function confirmDialog(msg) {
    return Promise.resolve(window.confirm(msg));
  }

  // ============ Прогресс ============
  const progressOverlay = document.getElementById('progress-overlay');
  const progressLabel = document.getElementById('progress-label');
  const progressFill = document.getElementById('progress-fill');

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

  function nextFrame() {
    return new Promise(r => requestAnimationFrame(() => r()));
  }

  // ============ История ============
  const history = createHistory(({ canUndo, canRedo }) => {
    document.getElementById('btn-undo').disabled = !canUndo;
    document.getElementById('btn-redo').disabled = !canRedo;
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

  // Debounce рендера — единый кадр
  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderAll();
    });
  }

  function commit(label) {
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

  // ============ Атрибуты ============
  let attributesReady = false;

  const attributes = createAttributes({
    getState: () => state,
    invalidate: (catId) => renderer.invalidate(catId),
    // Лёгкий колбэк — только рендер без истории
    onBindingsChanged: (changedCats) => {
      scheduleRender();
      autoSaver.schedule();
    },
    // Тяжёлый — с историей (для явных действий пользователя)
    onDataChanged: (label) => {
      history.push(snapshot(), label);
      autoSaver.schedule();
      scheduleRender();
    },
  });
  attributesReady = true;

  // ============ Автосохранение ============
  const autoSaver = Storage.createAutoSaver(() => {
    const clean = {
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
    return clean;
  }, 5000);

  // ============ Рендер ============
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
    const scaledW = CANVAS_SIZE * view.scale;
    const scaledH = CANVAS_SIZE * view.scale;
    const x = (w - scaledW) / 2 + view.offsetX;
    const y = (h - scaledH) / 2 + view.offsetY;

    canvas.style.width = scaledW + 'px';
    canvas.style.height = scaledH + 'px';
    canvas.style.left = x + 'px';
    canvas.style.top = y + 'px';

    if (view.gridOn) {
      gridOverlay.classList.add('show');
      gridOverlay.style.left = x + 'px';
      gridOverlay.style.top = y + 'px';
      gridOverlay.style.width = scaledW + 'px';
      gridOverlay.style.height = scaledH + 'px';
    } else {
      gridOverlay.classList.remove('show');
    }

    if (view.centerOn) {
      centerMarker.classList.add('show');
      centerMarker.style.left = (x + scaledW / 2) + 'px';
      centerMarker.style.top = (y + scaledH / 2) + 'px';
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

  // ============ Жесты ============
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
          const cx = t.clientX - rect.left;
          const cy = t.clientY - rect.top;
          const target = view.scale > 0.5 ? 0.15 : 0.8;
          setScale(target, cx, cy);
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
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setScale(view.scale * (e.deltaY < 0 ? 1.15 : 0.87), cx, cy);
  }, { passive: false });

  // ============ Категории ============
  function renderCategories() {
    categoriesEl.innerHTML = '';
    for (const cat of state.categories) {
      const tab = document.createElement('div');
      tab.className = 'cat-tab' + (cat.id === state.activeCategoryId ? ' active' : '');
      tab.dataset.id = cat.id;

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

      const editBtn = document.createElement('div');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(10);
        openCategoryEdit(cat.id);
      });
      tab.appendChild(editBtn);

      const del = document.createElement('div');
      del.className = 'del-x';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(cat.id);
      });
      tab.appendChild(del);

      const badge = document.createElement('div');
      badge.className = 'edit-badge';
      badge.textContent = '✎';
      tab.appendChild(badge);

      let longPressTimer = null;
      let longPressFired = false;
      let startX = 0, startY = 0, moved = false;

      const cancelLongPress = () => {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      };

      const onPointerStart = (e) => {
        if (e.target.closest('.del-x, .visibility-btn, .edit-btn')) return;
        longPressFired = false;
        moved = false;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        cancelLongPress();
        longPressTimer = setTimeout(() => {
          if (moved) return;
          longPressFired = true;
          if (navigator.vibrate) navigator.vibrate(20);
          openCategoryEdit(cat.id);
        }, 900);
      };

      const onPointerMove = (e) => {
        if (longPressFired) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = Math.abs(touch.clientX - startX);
        const dy = Math.abs(touch.clientY - startY);
        if (dx > 10 || dy > 10) {
          moved = true;
          cancelLongPress();
        }
      };

      const onPointerEnd = (e) => {
        cancelLongPress();
        if (longPressFired) return;
        if (moved) return;
        if (e.target && e.target.closest && e.target.closest('.del-x, .visibility-btn, .edit-btn')) return;
        openCategory(cat.id);
      };

      tab.addEventListener('touchstart', onPointerStart, { passive: true });
      tab.addEventListener('touchmove', onPointerMove, { passive: true });
      tab.addEventListener('touchend', onPointerEnd);
      tab.addEventListener('touchcancel', cancelLongPress);
      tab.addEventListener('mousedown', onPointerStart);
      tab.addEventListener('mousemove', onPointerMove);
      tab.addEventListener('mouseup', onPointerEnd);

      attachCategoryDrag(tab, cat.id);
      categoriesEl.appendChild(tab);
    }
  }

  function attachCategoryDrag(tab, catId) {
    let dragging = false;
    let startX = 0;
    let currentTarget = null;
    let longPressDragTimer = null;

    const getTabUnder = (clientX) => {
      const tabs = [...categoriesEl.querySelectorAll('.cat-tab')];
      return tabs.find(t => {
        if (t === tab) return false;
        const r = t.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right;
      });
    };

    const onDragStart = (e) => {
      if (e.target.closest('.del-x, .visibility-btn, .edit-btn')) return;
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      longPressDragTimer = setTimeout(() => {
        dragging = true;
        tab.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(20);
      }, 1000);
    };

    const onDragMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      if (!dragging) {
        if (Math.abs(touch.clientX - startX) > 12) {
          clearTimeout(longPressDragTimer);
        }
        return;
      }
      e.preventDefault();
      const target = getTabUnder(touch.clientX);
      if (currentTarget && currentTarget !== target) {
        currentTarget.classList.remove('drag-over-left', 'drag-over-right');
      }
      currentTarget = target;
      if (target) {
        const r = target.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        target.classList.remove('drag-over-left', 'drag-over-right');
        target.classList.add(touch.clientX < mid ? 'drag-over-left' : 'drag-over-right');
      }
      const rect = categoriesEl.getBoundingClientRect();
      if (touch.clientX < rect.left + 30) categoriesEl.scrollLeft -= 8;
      else if (touch.clientX > rect.right - 30) categoriesEl.scrollLeft += 8;
    };

    const onDragEnd = (e) => {
      clearTimeout(longPressDragTimer);
      if (!dragging) return;
      dragging = false;
      tab.classList.remove('dragging');
      const touch = e.changedTouches ? e.changedTouches[0] : e;
      const target = currentTarget || getTabUnder(touch.clientX);
      if (target) {
        const targetId = target.dataset.id;
        const fromIdx = state.categories.findIndex(c => c.id === catId);
        const toIdx = state.categories.findIndex(c => c.id === targetId);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          const r = target.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          const insertAfter = touch.clientX >= mid;
          const [movedItem] = state.categories.splice(fromIdx, 1);
          let newIdx = toIdx;
          if (fromIdx < toIdx) newIdx--;
          if (insertAfter) newIdx++;
          newIdx = Math.max(0, Math.min(state.categories.length, newIdx));
          state.categories.splice(newIdx, 0, movedItem);
          renderer.invalidateAll();
          commit('reorder-categories');
          renderCategories();
          toast('Порядок изменён');
        }
      }
      if (currentTarget) {
        currentTarget.classList.remove('drag-over-left', 'drag-over-right');
        currentTarget = null;
      }
    };

    tab.addEventListener('touchstart', onDragStart, { passive: true });
    tab.addEventListener('touchmove', onDragMove, { passive: false });
    tab.addEventListener('touchend', onDragEnd);
    tab.addEventListener('touchcancel', onDragEnd);
    tab.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  // ============ Редактирование категории ============
  let editingCategoryId = null;

  function openCategoryEdit(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    editingCategoryId = catId;
    document.getElementById('cat-edit-name').value = cat.name;
    document.getElementById('cat-edit-icon').value = cat.icon || '';
    updateCategoryEditPosition();
    document.getElementById('modal-cat-edit').classList.add('open');
    setTimeout(() => {
      const inp = document.getElementById('cat-edit-name');
      inp.focus();
      inp.select();
    }, 50);
    const tab = categoriesEl.querySelector(`.cat-tab[data-id="${catId}"]`);
    if (tab) tab.classList.add('edit-mode');
  }

  function updateCategoryEditPosition() {
    const idx = state.categories.findIndex(c => c.id === editingCategoryId);
    const total = state.categories.length;
    const el = document.getElementById('cat-edit-position');
    if (!el) return;
    el.textContent = `${idx + 1} из ${total}`;
    const leftBtn = document.getElementById('cat-edit-left');
    const rightBtn = document.getElementById('cat-edit-right');
    if (leftBtn) leftBtn.disabled = idx <= 0;
    if (rightBtn) rightBtn.disabled = idx >= total - 1;
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
    const newName = document.getElementById('cat-edit-name').value.trim();
    const newIcon = document.getElementById('cat-edit-icon').value.trim();
    if (!newName) {
      toast('Введите название', 'error');
      return;
    }
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
    document.getElementById('modal-cat-edit').classList.remove('open');
    const tab = categoriesEl.querySelector('.cat-tab.edit-mode');
    if (tab) tab.classList.remove('edit-mode');
    editingCategoryId = null;
    renderCategories();
  }

  function openCategory(catId) {
    state.activeCategoryId = catId;
    renderCategories();
    renderItems();
    itemsPanel.classList.add('open');
    const cat = state.categories.find(c => c.id === catId);
    itemsTitle.textContent = cat ? cat.name : '';
    requestAnimationFrame(() => {
      const tab = categoriesEl.querySelector(`.cat-tab[data-id="${catId}"]`);
      if (tab) tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  function addCategory(name, icon) {
    const cat = {
      id: nextId(),
      name: name.trim() || 'Без названия',
      icon: icon || undefined,
      visible: true,
      opacity: 1,
      items: []
    };
    state.categories.push(cat);
    state.activeCategoryId = cat.id;
    renderCategories();
    openCategory(cat.id);
    commit('add-category');
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

  // ============ Элементы ============
  function renderItems() {
    itemsList.innerHTML = '';
    const cat = state.categories.find(c => c.id === state.activeCategoryId);
    if (!cat) return;

    for (const item of cat.items) {
      const card = document.createElement('div');
      card.className = 'item-card' + (state.activeItems[cat.id] === item.id ? ' active' : '');

      if (item.img) {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name;
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        card.textContent = item.name;
      }

      const del = document.createElement('div');
      del.className = 'del-x';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(cat.id, item.id);
      });
      card.appendChild(del);

      card.addEventListener('click', () => {
        if (state.activeItems[cat.id] === item.id) {
          delete state.activeItems[cat.id];
        } else {
          state.activeItems[cat.id] = item.id;
        }
        renderer.invalidate(cat.id);
        renderItems();
        commit('toggle-item');
      });

      itemsList.appendChild(card);
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'item-card add-item-btn';
    addBtn.textContent = '＋';
    addBtn.addEventListener('click', () => openModalItem(cat.id));
    itemsList.appendChild(addBtn);
  }

  async function addItemsFromFiles(catId, files, baseName) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    if (!files || files.length === 0) return;

    showProgress('Загрузка...', 0);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      updateProgress((i / files.length) * 100, `Загрузка ${i + 1}/${files.length}`);
      await nextFrame();
      const src = await readFileAsDataURL(file);
      const img = await Exporter.loadImage(src);
      const item = {
        id: nextId(),
        name: file.name.replace(/\.[^.]+$/, '') || baseName || 'Элемент',
        src,
        img,
        transform: null,
      };
      cat.items.push(item);
      if (i === 0 && !state.activeItems[cat.id]) {
        state.activeItems[cat.id] = item.id;
      }
    }
    updateProgress(100);
    hideProgress();
    renderer.invalidate(catId);
    renderItems();
    commit('add-items');
    toast(`Добавлено: ${files.length}`);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
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

  // ============ Слои ============
  const layersModal = document.getElementById('modal-layers');
  const layersList = document.getElementById('layers-list');

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
      attachLayerDragHandlers(row, cat.id);
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

  function attachLayerDragHandlers(row, catId) {
    let dragging = false;

    const onStart = () => {
      dragging = true;
      row.classList.add('dragging');
    };

    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const y = touch.clientY;
      const rows = [...layersList.querySelectorAll('.layer-row')];
      const target = rows.find(r => {
        if (r === row) return false;
        const rect = r.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      });
      rows.forEach(r => r.classList.remove('drag-over'));
      if (target) target.classList.add('drag-over');
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      row.classList.remove('dragging');
      const rows = [...layersList.querySelectorAll('.layer-row')];
      const overRow = rows.find(r => r.classList.contains('drag-over'));
      rows.forEach(r => r.classList.remove('drag-over'));

      if (overRow && overRow !== row) {
        const targetId = overRow.dataset.id;
        const fromIdx = state.categories.findIndex(c => c.id === catId);
        const toIdx = state.categories.findIndex(c => c.id === targetId);
        if (fromIdx >= 0 && toIdx >= 0) {
          const [moved] = state.categories.splice(fromIdx, 1);
          state.categories.splice(toIdx, 0, moved);
          renderer.invalidateAll();
          commit('reorder-layers');
          renderLayers();
          renderCategories();
        }
      }
    };

    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove', onMove, { passive: false });
    row.addEventListener('touchend', onEnd);
    row.addEventListener('mousedown', onStart);
    row.addEventListener('mousemove', (e) => { if (dragging) onMove(e); });
    row.addEventListener('mouseup', onEnd);
  }

  // ============ Экспорт ============
  function openExportModal() {
    document.getElementById('modal-export').classList.add('open');
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

  // ============ Галерея ============
  const gallery = createGallery({
    getCurrentState: () => state,
    loadState: (newState) => {
      // Выгружаем старые canvas ПЕРЕД загрузкой
      renderer.invalidateAll();
      state = { ...newState };
      if (state.attributes) {
        attributes.deserialize(state.attributes);
      } else {
        attributes.reset();
      }
      renderCategories();
      if (state.activeCategoryId) openCategory(state.activeCategoryId);
      else itemsPanel.classList.remove('open');
      history.reset(snapshot());
      // Один рендер
      scheduleRender();
      // Применяем привязки с задержкой, чтобы не тормозить
      setTimeout(() => {
        try {
          attributes.applyAllBindings();
        } catch (e) {
          console.warn('applyAllBindings error:', e);
        }
      }, 500);
      autoSaver.schedule();
    },
    toast,
    confirm: confirmDialog,
  });

  // ============ Bindings UI ============
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

  // ============ Модальные окна ============
  function setupModals() {
    document.querySelectorAll('.modal-bg').forEach(bg => {
      bg.addEventListener('click', (e) => {
        if (e.target === bg) bg.classList.remove('open');
      });
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-bg').classList.remove('open');
      });
    });
  }

  // ============ UI ============
  function bindUI() {
    document.getElementById('btn-undo').addEventListener('click', () => {
      const s = history.undo();
      if (s) restoreFromSnapshot(s);
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      const s = history.redo();
      if (s) restoreFromSnapshot(s);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('btn-undo').click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        document.getElementById('btn-redo').click();
      }
    });

    // Атрибуты
    document.getElementById('btn-attributes').addEventListener('click', () => {
      getBindingsUI().open();
    });
    document.getElementById('attr-add-module').addEventListener('click', () => {
      const name = prompt('Название модуля:', 'Новый модуль');
      if (name === null) return;
      attributes.addModule(name);
      getBindingsUI().scheduleRender();
    });
    document.getElementById('binding-cancel').addEventListener('click', () => {
      document.getElementById('modal-binding').classList.remove('open');
    });

    // Галерея
    document.getElementById('btn-gallery').addEventListener('click', () => gallery.open());
    document.getElementById('gallery-new').addEventListener('click', async () => {
      const name = prompt('Название персонажа:', 'Персонаж');
      if (name === null) return;
      const proj = await gallery.createNew(name);
      state.id = proj.id;
      state.name = proj.name;
      autoSaver.schedule();
      toast('Новый персонаж создан');
      gallery.close();
    });
    document.getElementById('gallery-import').addEventListener('click', () => {
      document.getElementById('modal-import').classList.add('open');
    });

    document.getElementById('btn-layers').addEventListener('click', openLayers);

    document.getElementById('btn-add-cat').addEventListener('click', () => {
      document.getElementById('cat-name').value = '';
      document.getElementById('modal-cat').classList.add('open');
      setTimeout(() => document.getElementById('cat-name').focus(), 50);
    });
    document.getElementById('cat-save').addEventListener('click', () => {
      const name = document.getElementById('cat-name').value.trim();
      if (!name) { toast('Введите название', 'error'); return; }
      addCategory(name);
      document.getElementById('modal-cat').classList.remove('open');
    });

    document.getElementById('item-save').addEventListener('click', async () => {
      const catId = state.activeCategoryId;
      const files = document.getElementById('item-file').files;
      if (!catId || !files || files.length === 0) {
        toast('Выберите изображения', 'error');
        return;
      }
      const name = document.getElementById('item-name').value;
      document.getElementById('modal-item').classList.remove('open');
      await addItemsFromFiles(catId, files, name);
    });

    document.getElementById('btn-export').addEventListener('click', openExportModal);
    setupExportModal();

    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file').value = '';
      document.getElementById('modal-import').classList.add('open');
    });
    document.getElementById('import-confirm').addEventListener('click', async () => {
      const file = document.getElementById('import-file').files[0];
      if (!file) { toast('Выберите файл', 'error'); return; }
      const text = await file.text();
      const proj = await gallery.importFromJSON(text);
      if (proj) {
        document.getElementById('modal-import').classList.remove('open');
        await gallery.loadProject(proj.id);
      }
    });

    document.getElementById('btn-new').addEventListener('click', async () => {
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
      renderCategories();
      itemsPanel.classList.remove('open');
      history.reset(snapshot());
      scheduleRender();
      toast('Новый персонаж создан');
    });

    document.getElementById('btn-close-items').addEventListener('click', () => {
      itemsPanel.classList.remove('open');
    });

    document.getElementById('zoom-in').addEventListener('click', () => setScale(view.scale * 1.25));
    document.getElementById('zoom-out').addEventListener('click', () => setScale(view.scale * 0.8));
    document.getElementById('zoom-100').addEventListener('click', () => {
      view.offsetX = 0;
      view.offsetY = 0;
      setScale(1);
    });
    document.getElementById('zoom-fit').addEventListener('click', fitToScreen);

    document.getElementById('tool-grid').addEventListener('click', (e) => {
      view.gridOn = !view.gridOn;
      e.currentTarget.classList.toggle('active', view.gridOn);
      applyTransform();
    });
    document.getElementById('tool-checker').addEventListener('click', (e) => {
      view.checkerOn = !view.checkerOn;
      e.currentTarget.classList.toggle('active', view.checkerOn);
      canvasWrap.classList.toggle('checker', view.checkerOn);
    });
    document.getElementById('tool-center').addEventListener('click', (e) => {
      view.centerOn = !view.centerOn;
      e.currentTarget.classList.toggle('active', view.centerOn);
      applyTransform();
    });

    const saveBtn = document.getElementById('cat-edit-save');
    if (saveBtn) saveBtn.addEventListener('click', saveCategoryEdit);
    const leftBtn = document.getElementById('cat-edit-left');
    if (leftBtn) leftBtn.addEventListener('click', () => moveCategoryBy(-1));
    const rightBtn = document.getElementById('cat-edit-right');
    if (rightBtn) rightBtn.addEventListener('click', () => moveCategoryBy(+1));
    const nameInput = document.getElementById('cat-edit-name');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveCategoryEdit(); }
      });
    }
    const closeBtn = document.querySelector('#modal-cat-edit [data-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeCategoryEdit);
    const editModal = document.getElementById('modal-cat-edit');
    if (editModal) {
      editModal.addEventListener('click', (e) => {
        if (e.target.id === 'modal-cat-edit') closeCategoryEdit();
      });
    }
  }

  let exportFormat = 'png';
  let exportSize = 4096;

  function setupExportModal() {
    const formatPresets = document.querySelectorAll('#export-format-presets .export-preset');
    formatPresets.forEach(p => {
      p.addEventListener('click', () => {
        formatPresets.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        exportFormat = p.dataset.format;
        document.getElementById('export-png-opts').style.display = exportFormat === 'png' ? '' : 'none';
        document.getElementById('export-psd-opts').style.display = exportFormat === 'psd' ? '' : 'none';
        document.getElementById('export-json-opts').style.display = exportFormat === 'json' ? '' : 'none';
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
    document.getElementById('export-confirm').addEventListener('click', async () => {
      const transparent = document.getElementById('export-transparent').checked;
      document.getElementById('modal-export').classList.remove('open');
      await doExport(exportFormat, exportSize, transparent);
    });
  }

  function openModalItem(catId) {
    document.getElementById('item-name').value = '';
    document.getElementById('item-file').value = '';
    document.getElementById('modal-item').classList.add('open');
  }

  // ============ Инициализация ============
  async function init() {
    setupModals();
    bindUI();

    try {
      const projects = await Storage.getAllProjects();
      if (projects.length > 0) {
        await gallery.loadProject(projects[0].id);
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