/* attributes.js — система атрибутов и привязок (без рекурсивных коммитов) */
(function(global) {
  'use strict';

  const DEFAULT_SCHEMA = {
    modules: [
      {
        id: 'mod_body',
        name: 'Модуль Базовой внешности',
        color: '#e8b4b8',
        rows: [
          { id: 'hair_type', label: 'Волосы', value: '', slots: 0 },
          { id: 'hair_len', label: 'Длина волос', value: '', slots: 1 },
          { id: 'hair_color1', label: 'Цвет волос 1', value: '', slots: 1 },
          { id: 'hair_color2', label: 'Цвет волос 2', value: '', slots: 1 },
          { id: 'hair_color3', label: 'Цвет волос 3', value: '', slots: 1 },
          { id: 'hair_mult', label: 'Тип мультицвет', value: '', slots: 1 },
          { id: 'hair_tex', label: 'Текстура волос', value: '', slots: 1 },
          { id: 'hair_bang', label: 'Челка', value: '', slots: 1 },
          { id: 'hair_part', label: 'Прическа', value: '', slots: 1 },
          { id: 'eyes_shape', label: 'Форма глаз', value: '', slots: 1 },
          { id: 'eyes_color', label: 'Цвет глаз', value: '', slots: 1 },
          { id: 'eyes_pupil', label: 'Форма зрачков', value: '', slots: 1 },
          { id: 'face', label: 'Торс', value: '', slots: 0 },
          { id: 'skin_color', label: 'Цвет кожи', value: '', slots: 1 },
          { id: 'chest', label: 'Размер груди', value: '', slots: 1 },
        ],
      },
      {
        id: 'mod_clothes',
        name: 'Модуль одежды',
        color: '#d6e4f0',
        rows: [
          { id: 'style', label: 'Стиль одежды', value: '', slots: 0 },
          { id: 'headwear', label: 'Одежда › Headwear', value: '', slots: 3 },
          { id: 'neckwear', label: 'Одежда › Neckwear', value: '', slots: 3 },
          { id: 'handwear', label: 'Одежда › Handwear', value: '', slots: 3 },
          { id: 'topwear1', label: 'Одежда › Topwear 1', value: '', slots: 3 },
          { id: 'topwear2', label: 'Одежда › Topwear 2', value: '', slots: 3 },
          { id: 'bottomwear', label: 'Одежда › Bottomwear', value: '', slots: 3 },
          { id: 'legwear', label: 'Одежда › Legwear', value: '', slots: 3 },
          { id: 'footwear', label: 'Одежда › Footwear', value: '', slots: 3 },
          { id: 'acc1', label: 'Одежда › Accessories 1', value: '', slots: 3 },
          { id: 'acc2', label: 'Одежда › Accessories 2', value: '', slots: 3 },
          { id: 'acc3', label: 'Одежда › Accessories 3', value: '', slots: 3 },
          { id: 'acc4', label: 'Одежда › Accessories 4', value: '', slots: 3 },
          { id: 'acc5', label: 'Одежда › Accessories 5', value: '', slots: 3 },
        ],
      },
      {
        id: 'mod_race',
        name: 'Модуль расы',
        color: '#f5e6b8',
        rows: [
          { id: 'race1', label: 'Раса: 1', value: '', slots: 1 },
          { id: 'race_trait1', label: 'Расовая черта 1', value: '', slots: 1 },
          { id: 'race_trait2', label: 'Расовая черта 2', value: '', slots: 1 },
          { id: 'race_trait3', label: 'Расовая черта 3', value: '', slots: 1 },
          { id: 'race_trait4', label: 'Расовая черта 4', value: '', slots: 1 },
          { id: 'race_trait5', label: 'Расовая черта 5', value: '', slots: 1 },
          { id: 'race_trait6', label: 'Расовая черта 6', value: '', slots: 1 },
        ],
      },
    ],
    bindings: {},
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

    function loadFromState() {
      const state = ctx.getState();
      if (state.attributes) {
        schema = clone(state.attributes);
      }
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
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const attrIds = mod.rows.map(r => r.id);
      schema.modules = schema.modules.filter(m => m.id !== moduleId);
      for (const attrId of attrIds) {
        for (const slot of [0, 1, 2]) {
          delete schema.bindings[attrId + '#' + slot];
        }
      }
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
        slots: 1,
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
      for (const slot of [0, 1, 2]) {
        delete schema.bindings[attrId + '#' + slot];
      }
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
          // Применяем привязки — но БЕЗ коммита истории
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

    // ============ Привязки ============
    function bindAttribute(attrId, categoryId, itemId, slotIndex) {
      if (slotIndex === undefined) slotIndex = 0;
      const key = attrId + '#' + slotIndex;
      schema.bindings[key] = { attrId, categoryId, itemId, slotIndex };
      saveToState();
      applyBindingsSilent(attrId);
      ctx.onDataChanged?.('bind-attribute');
    }

    function unbindAttribute(attrId, slotIndex) {
      if (slotIndex === undefined) slotIndex = 0;
      const key = attrId + '#' + slotIndex;
      delete schema.bindings[key];
      saveToState();
      ctx.onDataChanged?.('unbind-attribute');
    }

    function getBinding(attrId, slotIndex) {
      if (slotIndex === undefined) slotIndex = 0;
      return schema.bindings[attrId + '#' + slotIndex];
    }

    function getAllBindingsForAttr(attrId) {
      const result = [];
      for (const [key, b] of Object.entries(schema.bindings)) {
        if (b.attrId === attrId) result.push({ key, ...b });
      }
      return result;
    }

    // Найти элемент по значению
    function findItemForValue(cat, value) {
      if (!value) return null;
      const target = value.trim();
      const normTarget = normalizeName(target);
      let found = cat.items.find(it => it.id.toLowerCase() === target.toLowerCase());
      if (!found) found = cat.items.find(it => normalizeName(it.name) === normTarget);
      if (!found) {
        found = cat.items.find(it =>
          normalizeName(it.name).includes(normTarget) ||
          normTarget.includes(normalizeName(it.name))
        );
      }
      return found;
    }

    // Тихая версия: НЕ вызывает commit, только помечает слои
    function applyBindingsSilent(attrId) {
      const state = ctx.getState();
      const attrData = getAttribute(attrId);
      if (!attrData) return { changed: false };

      const { row } = attrData;
      const bindings = getAllBindingsForAttr(attrId);
      const changedCats = new Set();

      for (const binding of bindings) {
        const cat = state.categories.find(c => c.id === binding.categoryId);
        if (!cat) continue;

        if (!row.value) {
          if (state.activeItems[cat.id]) {
            delete state.activeItems[cat.id];
            changedCats.add(cat.id);
          }
          continue;
        }

        const foundItem = findItemForValue(cat, row.value);
        if (foundItem && state.activeItems[cat.id] !== foundItem.id) {
          state.activeItems[cat.id] = foundItem.id;
          changedCats.add(cat.id);
        }
      }

      if (changedCats.size > 0) {
        for (const catId of changedCats) {
          ctx.invalidate?.(catId);
        }
        ctx.onBindingsChanged?.(changedCats);
      }
      return { changed: changedCats.size > 0 };
    }

    // Публичная версия — используется кнопкой "Применить"
    function applyBindings(attrId) {
      const { changed } = applyBindingsSilent(attrId);
      if (changed) ctx.onDataChanged?.('apply-bindings');
    }

    // Массовое применение — ОДИН рендер в конце
    function applyAllBindings() {
      const state = ctx.getState();
      const changedCats = new Set();

      for (const mod of schema.modules) {
        for (const row of mod.rows) {
          if (!row.value) continue;
          const bindings = getAllBindingsForAttr(row.id);
          for (const binding of bindings) {
            const cat = state.categories.find(c => c.id === binding.categoryId);
            if (!cat) continue;
            const foundItem = findItemForValue(cat, row.value);
            if (foundItem && state.activeItems[cat.id] !== foundItem.id) {
              state.activeItems[cat.id] = foundItem.id;
              changedCats.add(cat.id);
            }
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
      bindAttribute, unbindAttribute,
      getBinding, getAllBindingsForAttr,
      applyBindings, applyAllBindings,
      getSchema, serialize, deserialize,
      loadFromState, reset,
      normalizeName,
    };
  }

  global.createAttributes = createAttributes;
  global.DEFAULT_ATTRIBUTE_SCHEMA = DEFAULT_SCHEMA;
})(window);