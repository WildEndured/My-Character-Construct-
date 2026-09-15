/* renderer.js — рендер холста + кэш слоёв */
(function(global) {
  'use strict';

  const CANVAS_SIZE = 4096;

  function createRenderer(canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });

    // Кэш: Map<categoryId, {canvas, dirty, lastActiveId, lastOpacity, lastTransform}>
    const layerCache = new Map();

    // Финальный композит-буфер
    let composeCanvas = null;
    let composeCtx = null;

    function ensureCompose() {
      if (!composeCanvas) {
        composeCanvas = document.createElement('canvas');
        composeCanvas.width = CANVAS_SIZE;
        composeCanvas.height = CANVAS_SIZE;
        composeCtx = composeCanvas.getContext('2d');
      }
    }

    function getLayerCanvas(catId) {
      let entry = layerCache.get(catId);
      if (!entry) {
        const c = document.createElement('canvas');
        c.width = CANVAS_SIZE;
        c.height = CANVAS_SIZE;
        entry = {
          canvas: c,
          ctx: c.getContext('2d'),
          dirty: true,
          lastActiveId: null,
          lastTransform: null,
        };
        layerCache.set(catId, entry);
      }
      return entry;
    }

    function invalidate(catId) {
      if (catId) {
        const entry = layerCache.get(catId);
        if (entry) entry.dirty = true;
      } else {
        layerCache.forEach(e => e.dirty = true);
      }
    }

    function invalidateAll() {
      layerCache.clear();
    }

    /**
     * Главный рендер.
     * @param {Object} state — {categories, activeItems, canvasBg}
     */
    function render(state) {
      ensureCompose();

      // 1) Собираем активные слои в порядке categories
      const activeLayers = [];
      for (const cat of state.categories) {
        if (cat.visible === false) continue;
        const activeId = state.activeItems[cat.id];
        if (!activeId) continue;
        const item = cat.items.find(i => i.id === activeId);
        if (item && item.img) {
          activeLayers.push({ cat, item });
        }
      }

      // 2) Обновляем кэш только для изменившихся слоёв
      for (const { cat, item } of activeLayers) {
        const entry = getLayerCanvas(cat.id);
        const transform = item.transform || null;
        const transformKey = transform ? JSON.stringify(transform) : '';

        if (entry.lastActiveId !== item.id ||
            entry.lastTransformKey !== transformKey) {
          entry.dirty = true;
          entry.lastActiveId = item.id;
          entry.lastTransformKey = transformKey;
        }

        if (entry.dirty) {
          entry.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          drawItem(entry.ctx, item, transform);
          entry.dirty = false;
        }
      }

      // 3) Удаляем кэш для неиспользуемых/невидимых слоёв
      for (const [catId, entry] of layerCache) {
        const cat = state.categories.find(c => c.id === catId);
        if (!cat || cat.visible === false || !state.activeItems[catId]) {
          layerCache.delete(catId);
        }
      }

      // 4) Финальная композиция
      composeCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      if (state.canvasBg) {
        composeCtx.fillStyle = state.canvasBg;
        composeCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      for (const { cat } of activeLayers) {
        const entry = layerCache.get(cat.id);
        if (!entry) continue;
        composeCtx.globalAlpha = cat.opacity != null ? cat.opacity : 1;
        composeCtx.drawImage(entry.canvas, 0, 0);
      }
      composeCtx.globalAlpha = 1;

      // 5) Переносим на видимый холст
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(composeCanvas, 0, 0);
    }

    function drawItem(context, item, transform) {
      const img = item.img;
      if (!img) return;

      if (!transform) {
        context.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        return;
      }

      const {
        x = 0, y = 0,
        scale = 1,
        rotation = 0,
        flipX = false,
        flipY = false,
      } = transform;

      context.save();
      context.translate(CANVAS_SIZE / 2 + x, CANVAS_SIZE / 2 + y);
      context.rotate(rotation);
      context.scale(flipX ? -scale : scale, flipY ? -scale : scale);
      context.drawImage(img, -CANVAS_SIZE / 2, -CANVAS_SIZE / 2, CANVAS_SIZE, CANVAS_SIZE);
      context.restore();
    }

    /**
     * Быстрый экспорт композита как canvas (для экспорта без перерисовки).
     */
    function getComposite(state) {
      render(state);
      ensureCompose();
      return composeCanvas;
    }

    /**
     * Экспорт отдельного слоя (для PSD).
     */
    function getLayerCanvasForExport(catId) {
      const entry = layerCache.get(catId);
      return entry ? entry.canvas : null;
    }

    return {
      render,
      invalidate,
      invalidateAll,
      getComposite,
      getLayerCanvasForExport,
      CANVAS_SIZE,
    };
  }

  global.createRenderer = createRenderer;
})(window);