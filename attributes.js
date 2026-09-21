/* attributes.js — система атрибутов с привязкой к КАТЕГОРИИ (не к элементу) */
(function(global) {
  'use strict';

  const DEFAULT_SCHEMA = {
    modules: [
      {
        id: 'mod_body',
        name: 'Модуль Базовой внешности',
        color: '#e8b4b8',
        rows: [
          { id: 'hair_type', label: 'Волосы', value: '', categoryId: null },
          { id: 'hair_len', label: 'Длина волос', value: '', categoryId: null },
          { id: 'hair_color1', label: 'Цвет волос 1', value: '', categoryId: null },
          { id: 'hair_color2', label: 'Цвет волос 2', value: '', categoryId: null },
          { id: 'hair_color3', label: 'Цвет волос 3', value: '', categoryId: null },
          { id: 'hair_mult', label: 'Тип мультицвет', value: '', categoryId: null },
          { id: 'hair_tex', label: 'Текстура волос', value: '', categoryId: null },
          { id: 'hair_bang', label: 'Челка', value: '', categoryId: null },
          { id: 'hair_part', label: 'Прическа', value: '', categoryId: null },
          { id: 'eyes_shape', label: 'Форма глаз', value: '', categoryId: null },
          { id: 'eyes_color', label: 'Цвет глаз', value: '', categoryId: null },
          { id: 'eyes_pupil', label: 'Форма зрачков', value: '', categoryId: null },
          { id: 'face', label: 'Торс', value: '', categoryId: null },
          { id: 'skin_color', label: 'Цвет кожи', value: '', categoryId: null },
          { id: 'chest', label: 'Размер груди', value: '', categoryId: null },
        ],
      },
      {
        id: 'mod_clothes',
        name: 'Модуль одежды',
        color: '#d6e4f0',
        rows: [
          { id: 'style', label: 'Стиль одежды', value: '', categoryId: null },
          { id: 'headwear', label: 'Одежда › Headwear', value: '', categoryId: null },
          { id: 'neckwear', label: 'Одежда › Neckwear', value: '', categoryId: null },
          { id: 'handwear', label: 'Одежда › Handwear', value: '', categoryId: null },
          { id: 'topwear1', label: 'Одежда › Topwear 1', value: '', categoryId: null },
          { id: 'topwear2', label: 'Одежда › Topwear 2', value: '', categoryId: null },
          { id: 'bottomwear', label: 'Одежда › Bottomwear', value: '', categoryId: null },
          { id: 'legwear', label: 'Одежда › Legwear', value: '', categoryId: null },
          { id: 'footwear', label: 'Одежда › Footwear', value: '', categoryId: null },
          { id: 'acc1', label: 'Одежда › Accessories 1', value: '', categoryId: null },
          { id: 'acc2', label: 'Одежда › Accessories 2', value: '', categoryId: null },
          { id: 'acc3', label: 'Одежда › Accessories 3', value: '', categoryId: null },
          { id: 'acc4', label: 'Одежда › Accessories 4', value: '', categoryId: null },
          { id: 'acc5', label: 'Одежда › Accessories 5', value: '', categoryId: null },
        ],
      },
      {
        id: 'mod_race',
        name: 'Модуль расы',
        color: '#f5e6b8',
        rows: [
          { id: 'race1', label: 'Раса: 1', value: '', categoryId: null },
          { id: 'race_trait1', label: 'Расовая черта 1', value: '', categoryId: null },
          { id: 'race_trait2', label: 'Расовая черта 2', value: '', categoryId: null },
          { id: 'race_trait3', label: 'Расовая черта 3', value: '', categoryId: null },
          { id: 'race_trait4', label: 'Расовая черта 4', value: '', categoryId: null },
          { id: 'race_trait5', label: 'Расовая черта 5', value: '', categoryId: null },
          { id: 'race_trait6', label: 'Расовая черта 6', value: '', categoryId: null },
        ],
      },
    ],
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeName(str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[\s_\-]+/g, '');
  }

  function createAttributes(ctx) {
    let schema = clone(DEFAULT_SCHEMA);

    function saveToState() {
      const state = ctx.getState();
      state.attributes = clone(schema);
    }

    // ============ Модули ============
    function addModule(name) {
      const mod = {
        id: 'mod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: name || 'Новый модуль',
        color: '#cccccc',
        rows: [],
      };
      schema.modules.push(mod);
      saveToState();
      ctx.onDataChanged?.('add-module');
      return mod;
    }

    function removeModule(moduleId) {
      schema.modules = schema.modules.filter(m => m.id !== moduleId);
      saveToState();
      ctx.onDataChanged?.('remove-module');
    }

    function renameModule(moduleId, name) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (mod) {
        mod.name = name;
        saveToState();
        ctx.onDataChanged?.('rename-module');
      }
    }

    // ============ Атрибуты ============
    function addAttribute(moduleId, label) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const row = {
        id: 'attr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: label || 'Новый атрибут',
        value: '',
        categoryId: null,
      };
      mod.rows.push(row);
      saveToState();
      ctx.onDataChanged?.('add-attribute');
      return row;
    }

    function removeAttribute(moduleId, attrId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      mod.rows = mod.rows.filter(r => r.id !== attrId);
      saveToState();
      ctx.onDataChanged?.('remove-attribute');
    }

    function renameAttribute(moduleId, attrId, label) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const row = mod.rows.find(r => r.id === attrId);
      if (row) {
        row.label = label;
        saveToState();
        ctx.onDataChanged?.('rename-attribute');
      }
    }

    // ============ Значения ============
    function setAttributeValue(attrId, value) {
      for (const mod of schema.modules) {
        const row = mod.rows.find(r => r.id === attrId);
        if (row) {
          row.value = value;
          saveToState();
          applyBindingsSilent(attrId);
          ctx.onDataChanged?.('set-attribute-value');
          return;
        }
      }
    }

    function getAttribute(attrId) {
      for (const mod of schema.modules) {
        const row = mod.rows.find(r => r.id === attrId);
        if (row) return { row, module: mod };
      }
      return null;
    }

    // ============ Привязка к КАТЕГОРИИ ============
    /**
     * Привязать атрибут к категории
     * @param {string} attrId
     * @param {string} categoryId — id категории в редакторе (state.categories)
     */
    function bindCategory(attrId, categoryId) {
      const attrData = getAttribute(attrId);
      if (!attrData) return;
      attrData.row.categoryId = categoryId || null;
      saveToState();
      applyBindingsSilent(attrId);
      ctx.onDataChanged?.('bind-category');
    }

    function unbindCategory(attrId) {
      const attrData = getAttribute(attrId);
      if (!attrData) return;
      attrData.row.categoryId = null;
      saveToState();
      ctx.onDataChanged?.('unbind-category');
    }

    function getBoundCategory(attrId) {
      const attrData = getAttribute(attrId);
      if (!attrData) return null;
      return attrData.row.categoryId || null;
    }

    // Найти элемент по значению в категории
    function findItemForValue(cat, value) {
      if (!cat || !value) return null;
      const target = value.trim();
      const normTarget = normalizeName(target);

      // 1. Точное совпадение id
      let found = cat.items.find(it => it.id.toLowerCase() === target.toLowerCase());
      if (found) return found;

      // 2. Точное совпадение нормализованного имени
      found = cat.items.find(it => normalizeName(it.name) === normTarget);
      if (found) return found;

      // 3. Частичное вхождение
      found = cat.items.find(it =>
        normalizeName(it.name).includes(normTarget) ||
        normTarget.includes(normalizeName(it.name))
      );
      return found || null;
    }

    // Тихая версия: НЕ вызывает commit, только помечает слои
    function applyBindingsSilent(attrId) {
      const state = ctx.getState();
      const attrData = getAttribute(attrId);
      if (!attrData) return { changed: false };

      const { row } = attrData;
      if (!row.categoryId) return { changed: false };

      const cat = state.categories.find(c => c.id === row.categoryId);
      if (!cat) return { changed: false };

      let changed = false;

      if (!row.value) {
        // Пустое значение — снять активный элемент в этой категории
        if (state.activeItems[cat.id]) {
          delete state.activeItems[cat.id];
          changed = true;
        }
      } else {
        const foundItem = findItemForValue(cat, row.value);
        if (foundItem && state.activeItems[cat.id] !== foundItem.id) {
          state.activeItems[cat.id] = foundItem.id;
          changed = true;
        }
      }

      if (changed) {
        ctx.invalidate?.(cat.id);
        ctx.onBindingsChanged?.(new Set([cat.id]));
      }
      return { changed };
    }

    function applyBindings(attrId) {
      const { changed } = applyBindingsSilent(attrId);
      if (changed) ctx.onDataChanged?.('apply-bindings');
    }

    // Массовое применение — один рендер в конце
    function applyAllBindings() {
      const state = ctx.getState();
      const changedCats = new Set();

      for (const mod of schema.modules) {
        for (const row of mod.rows) {
          if (!row.value || !row.categoryId) continue;
          const cat = state.categories.find(c => c.id === row.categoryId);
          if (!cat) continue;
          const foundItem = findItemForValue(cat, row.value);
          if (foundItem && state.activeItems[cat.id] !== foundItem.id) {
            state.activeItems[cat.id] = foundItem.id;
            changedCats.add(cat.id);
          }
        }
      }

      if (changedCats.size > 0) {
        for (const catId of changedCats) {
          ctx.invalidate?.(catId);
        }
        ctx.onBindingsChanged?.(changedCats);
      }
      return changedCats.size;
    }

    // ============ Сериализация ============
    function serialize() {
      return clone(schema);
    }

    function deserialize(data) {
      if (!data || !data.modules) {
        schema = clone(DEFAULT_SCHEMA);
        return;
      }
      schema = clone(data);

      // Миграция: если где-то ещё есть старый формат "bindings" — игнорируем
      if (data.bindings) {
        // Старые привязки к элементам → не переносим
      }
    }

    function getSchema() {
      return schema;
    }

    function reset() {
      schema = clone(DEFAULT_SCHEMA);
      saveToState();
    }

    return {
      addModule, removeModule, renameModule,
      addAttribute, removeAttribute, renameAttribute,
      setAttributeValue, getAttribute,
      // Привязки к категориям
      bindCategory, unbindCategory, getBoundCategory,
      applyBindings, applyAllBindings,
      getSchema, serialize, deserialize, reset,
      normalizeName,
    };
  }

  global.createAttributes = createAttributes;
  global.DEFAULT_ATTRIBUTE_SCHEMA = DEFAULT_SCHEMA;
})(window);