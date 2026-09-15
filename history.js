/* history.js — Undo/Redo стек */
(function(global) {
  'use strict';

  const MAX_HISTORY = 50;

  function createHistory(onChange) {
    let past = [];
    let future = [];
    let current = null;

    function cloneSnapshot(snap) {
      // Глубокая копия, но img (HTMLImageElement) передаём по ссылке
      return {
        categories: snap.categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          visible: cat.visible !== false,
          opacity: cat.opacity != null ? cat.opacity : 1,
          items: cat.items.map(it => ({
            id: it.id,
            name: it.name,
            src: it.src,
            img: it.img, // ссылка
            transform: it.transform ? { ...it.transform } : null,
          })),
        })),
        activeItems: { ...snap.activeItems },
        activeCategoryId: snap.activeCategoryId,
        canvasBg: snap.canvasBg || '#ffffff',
      };
    }

    function reset(initialState) {
      past = [];
      future = [];
      current = cloneSnapshot(initialState);
      notify();
    }

    function push(newState, label) {
      if (!current) {
        reset(newState);
        return;
      }
      // Если ничего не изменилось — не пушим
      if (JSON.stringify(stripImgs(current)) === JSON.stringify(stripImgs(newState))) {
        return;
      }
      past.push(current);
      if (past.length > MAX_HISTORY) past.shift();
      current = cloneSnapshot(newState);
      future = [];
      notify();
    }

    function stripImgs(state) {
      // Для сравнения игнорируем img-ссылки
      return {
        categories: state.categories.map(c => ({
          id: c.id, name: c.name, visible: c.visible, opacity: c.opacity,
          items: c.items.map(i => ({ id: i.id, name: i.name, transform: i.transform })),
        })),
        activeItems: state.activeItems,
        activeCategoryId: state.activeCategoryId,
        canvasBg: state.canvasBg,
      };
    }

    function undo() {
      if (past.length === 0) return null;
      future.push(current);
      current = past.pop();
      notify();
      return current;
    }

    function redo() {
      if (future.length === 0) return null;
      past.push(current);
      current = future.pop();
      notify();
      return current;
    }

    function canUndo() { return past.length > 0; }
    function canRedo() { return future.length > 0; }
    function getCurrent() { return current; }

    function notify() {
      if (onChange) onChange({ canUndo: canUndo(), canRedo: canRedo() });
    }

    return { reset, push, undo, redo, canUndo, canRedo, getCurrent };
  }

  global.createHistory = createHistory;
})(window);