/* gallery.js — галерея персонажей */
(function(global) {
  'use strict';

  /**
   * @param {Object} api — {
   *   getCurrentState,     // () => state
   *   loadState,           // (state) => void
   *   generateThumbnail,   // () => dataURL
   *   toast,               // (msg, type) => void
   *   confirm,             // (msg) => Promise<bool>
   * }
   */
  function createGallery(api) {
    const modal = document.getElementById('gallery-modal');
    const grid = document.getElementById('gallery-grid');

    const THUMB_SIZE = 256;
    const THUMB_QUALITY = 0.7;

    /**
     * Создаёт уменьшенное превью из текущего состояния.
     */
    async function makeThumbnail(state) {
      const size = THUMB_SIZE;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const cx = c.getContext('2d');

      // Фон
      cx.fillStyle = state.canvasBg || '#ffffff';
      cx.fillRect(0, 0, size, size);

      // Рисуем активные элементы
      for (const cat of state.categories) {
        if (cat.visible === false) continue;
        const activeId = state.activeItems[cat.id];
        if (!activeId) continue;
        const item = cat.items.find(i => i.id === activeId);
        if (!item || !item.img) continue;

        cx.save();
        cx.globalAlpha = cat.opacity != null ? cat.opacity : 1;

        const t = item.transform;
        if (!t) {
          cx.drawImage(item.img, 0, 0, size, size);
        } else {
          const {
            x = 0, y = 0, scale = 1, rotation = 0,
            flipX = false, flipY = false,
          } = t;
          const ratio = size / (state.canvasSize || 4096);
          cx.translate(size / 2 + x * ratio, size / 2 + y * ratio);
          cx.rotate(rotation);
          cx.scale(flipX ? -scale : scale, flipY ? -scale : scale);
          cx.drawImage(item.img, -size / 2, -size / 2, size, size);
        }
        cx.restore();
      }

      return c.toDataURL('image/jpeg', THUMB_QUALITY);
    }

    /**
     * Сохраняет текущий проект в галерею.
     */
    async function saveCurrent() {
      const state = api.getCurrentState();
      if (!state || !state.id) return;
      try {
        await Storage.saveProject(state);
      } catch (e) {
        console.error('Ошибка сохранения:', e);
      }
    }

    /**
     * Обновляет превью для указанного проекта.
     */
    async function updateThumbnail(projectId) {
      const state = api.getCurrentState();
      if (!state || state.id !== projectId) return;

      const thumb = await makeThumbnail(state);
      const proj = await Storage.getProject(projectId);
      if (!proj) return;
      proj.thumbnail = thumb;
      proj.updatedAt = Date.now();
      // img-ссылки не сохраняем в IndexedDB — вырежем
      const cleanProj = stripImages(proj);
      await Storage.saveProject(cleanProj);
    }

    function stripImages(project) {
      // Приводим проект к сериализуемому виду (без HTMLImageElement)
      return {
        ...project,
        categories: project.categories.map(cat => ({
          ...cat,
          items: cat.items.map(it => ({
            id: it.id,
            name: it.name,
            src: it.src,
            transform: it.transform || null,
          })),
        })),
      };
    }

    /**
     * Открывает галерею.
     */
    async function open() {
      modal.classList.add('open');
      await refresh();
    }

    function close() {
      modal.classList.remove('open');
    }

    /**
     * Отрисовка списка проектов.
     */
    async function refresh() {
      const projects = await Storage.getAllProjects();
      const current = api.getCurrentState();

      grid.innerHTML = '';

      if (projects.length === 0) {
        const empty = document.createElement('div');
        empty.style.gridColumn = '1 / -1';
        empty.style.textAlign = 'center';
        empty.style.color = '#888';
        empty.style.padding = '20px';
        empty.textContent = 'Пока нет сохранённых персонажей';
        grid.appendChild(empty);
        return;
      }

      for (const proj of projects) {
        const card = document.createElement('div');
        card.className = 'gallery-card' + (proj.id === current.id ? ' active' : '');

        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (proj.thumbnail) {
          const img = document.createElement('img');
          img.src = proj.thumbnail;
          thumb.appendChild(img);
        }
        card.appendChild(thumb);

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = proj.name || 'Без названия';
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = formatDate(proj.updatedAt);
        card.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const openBtn = document.createElement('button');
        openBtn.className = 'btn';
        openBtn.textContent = 'Открыть';
        openBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await loadProject(proj.id);
        });
        actions.appendChild(openBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger';
        delBtn.textContent = '×';
        delBtn.style.flex = '0';
        delBtn.style.minWidth = '36px';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await api.confirm(`Удалить "${proj.name}"?`)) {
            await deleteProject(proj.id);
          }
        });
        actions.appendChild(delBtn);

        card.appendChild(actions);

        // Клик по карточке = открыть
        card.addEventListener('click', () => loadProject(proj.id));

        grid.appendChild(card);
      }
    }

    function formatDate(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = Date.now();
      const diff = now - ts;
      if (diff < 60 * 1000) return 'только что';
      if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} мин назад`;
      if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} ч назад`;
      return d.toLocaleDateString('ru-RU');
    }

    /**
     * Загружает проект в редактор.
     */
    async function loadProject(id) {
      const proj = await Storage.getProject(id);
      if (!proj) {
        api.toast('Проект не найден', 'error');
        return;
      }

      // Загружаем изображения из base64
      const loadedCategories = [];
      for (const cat of proj.categories || []) {
        const items = [];
        for (const it of cat.items || []) {
          try {
            const img = await Exporter.loadImage(it.src);
            items.push({
              id: it.id,
              name: it.name,
              src: it.src,
              img,
              transform: it.transform || null,
            });
          } catch (e) {
            console.warn('Не удалось загрузить элемент', it.name, e);
          }
        }
        loadedCategories.push({
          id: cat.id,
          name: cat.name,
          visible: cat.visible !== false,
          opacity: cat.opacity != null ? cat.opacity : 1,
          items,
        });
      }

      const newState = {
        id: proj.id,
        name: proj.name || 'Без названия',
        canvasBg: proj.canvasBg || '#ffffff',
        categories: loadedCategories,
        activeItems: proj.activeItems || {},
        activeCategoryId: proj.activeCategoryId || (loadedCategories[0]?.id || null),
      };

      api.loadState(newState);
      close();
      api.toast(`Загружен: ${proj.name}`);
    }

    /**
     * Создаёт новый проект.
     */
    async function createNew(name) {
      const state = api.getCurrentState();
      // Отвязываем текущее состояние от проекта — генерируем новый id
      const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

      const newProj = {
        id: newId,
        name: name || `Персонаж ${new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
        canvasBg: '#ffffff',
        categories: (state.categories || []).map(cat => ({
          ...cat,
          items: cat.items.map(it => ({
            id: it.id,
            name: it.name,
            src: it.src,
            transform: it.transform || null,
          })),
        })),
        activeItems: { ...state.activeItems },
        activeCategoryId: state.activeCategoryId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await Storage.saveProject(newProj);
      api.toast('Создан новый персонаж');
      return newProj;
    }

    /**
     * Клонирует проект.
     */
    async function duplicate(id) {
      const proj = await Storage.getProject(id);
      if (!proj) return;
      const copy = {
        ...proj,
        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: (proj.name || 'Без названия') + ' (копия)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await Storage.saveProject(copy);
      api.toast('Дублировано');
      await refresh();
    }

    async function deleteProject(id) {
      await Storage.deleteProject(id);
      api.toast('Удалено');
      await refresh();
    }

    /**
     * Импорт проекта из JSON.
     */
    async function importFromJSON(jsonString) {
      try {
        const parsed = await Exporter.deserializeProject(jsonString);
        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const proj = {
          id: newId,
          name: parsed.name || 'Импортированный',
          canvasBg: parsed.canvasBg || '#ffffff',
          categories: parsed.categories.map(cat => ({
            ...cat,
            items: cat.items.map(it => ({
              id: it.id,
              name: it.name,
              src: it.src,
              transform: it.transform || null,
            })),
          })),
          activeItems: parsed.activeItems || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await Storage.saveProject(proj);
        api.toast('Проект импортирован');
        return proj;
      } catch (e) {
        console.error('Импорт не удался:', e);
        api.toast('Ошибка импорта', 'error');
        return null;
      }
    }

    return {
      open,
      close,
      refresh,
      saveCurrent,
      updateThumbnail,
      makeThumbnail,
      loadProject,
      createNew,
      duplicate,
      deleteProject,
      importFromJSON,
      stripImages,
    };
  }

  global.createGallery = createGallery;
})(window);