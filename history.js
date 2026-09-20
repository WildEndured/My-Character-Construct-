/* history.js — Undo/Redo стек (без утечек памяти) */
(function(global) {
  'use strict';

  const MAX_HISTORY = 20;

  function createHistory(onChange) {
    let past = [];
    let future = [];
    let current = null;

    function cloneSnapshot(snap) {
      return {
        categories: snap.categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          visible: cat.visible !== false,
          opacity: cat.opacity != null ? cat.opacity : 1,
          items: cat.items.map(it => ({
            id: it.id,
            name: it.name,
            src: it.src,
            img: it.img,
            transform: it.transform ? { ...it.transform } : null,
          })),
        })),
        activeItems: { ...snap.activeItems },
        activeCategoryId: snap.activeCategoryId,
        canvasBg: snap.canvasBg || '#ffffff',
        attributes: snap.attributes ? JSON.parse(JSON.stringify(snap.attributes)) : null,
      };
    }

    // Для сравнения — БЕЗ src, БЕЗ img (экономия памяти и CPU)
    function stripForCompare(state) {
      return {
        categories: state.categories.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          visible: c.visible,
          opacity: c.opacity,
          itemCount: c.items.length,
          itemIds: c.items.map(i => i.id + ':' + (i.transform ? JSON.stringify(i.transform) : '')).join(','),
        })),
        activeItems: state.activeItems,
        activeCategoryId: state.activeCategoryId,
        canvasBg: state.canvasBg,
      };
    }

    function serializeForCompare(state) {
      try {
        return JSON.stringify(stripForCompare(state));
      } catch (e) {
        return Math.random().toString();
      }
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
      const a = serializeForCompare(current);
      const b = serializeForCompare(newState);
      if (a === b) return;

      past.push(current);
      if (past.length > MAX_HISTORY) {
        const removed = past.shift();
        // Освобождаем память
        removed.categories = null;
      }
      current = cloneSnapshot(newState);
      future = [];
      notify();
    }

    function undo() {
      if (past.length === 0) return null;
      future.push(current);
      if (future.length > MAX_HISTORY) {
        const removed = future.shift();
        removed.categories = null;
      }
      current = past.pop();
      notify();
      return current;
    }

    function redo() {
      if (future.length === 0) return null;
      past.push(current);
      if (past.length > MAX_HISTORY) {
        const removed = past.shift();
        removed.categories = null;
      }
      current = future.pop();
      notify();
      return current;
    }

    function canUndo() { return past.length > 0; }
    function canRedo() { return future.length > 0; }
    function getCurrent() { return current; }

    function clear() {
      past = [];
      future = [];
      current = null;
      notify();
    }

    function notify() {
      if (onChange) onChange({ canUndo: canUndo(), canRedo: canRedo() });
    }

    return { reset, push, undo, redo, canUndo, canRedo, getCurrent, clear };
  }

  global.createHistory = createHistory;
})(window);