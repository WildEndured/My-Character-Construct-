/* attributes.js — атрибуты с привязкой к КАТЕГОРИИ, группами и рандомом */
(function(global) {
  'use strict';

  const DEFAULT_SCHEMA = {
    modules: [
      {
        id: 'mod_body',
        name: 'Модуль Базовой внешности',
        icon: '🧑',
        color: '#e8b4b8',
        collapsed: false,
        groups: [
          {
            id: 'grp_hair',
            name: 'Волосы',
            collapsed: false,
            rows: [
              { id: 'hair_type', label: 'Волосы', value: '', categoryId: null },
              { id: 'hair_len', label: 'Длина волос', value: '', categoryId: null },
              { id: 'hair_color1', label: 'Цвет волос 1', value: '', categoryId: null },
              { id: 'hair_color2', label: 'Цвет волос 2', value: '', categoryId: null },
              { id: 'hair_color3', label: 'Цвет волос 3', value: '', categoryId: null },
              { id: 'hair_tex', label: 'Текстура волос', value: '', categoryId: null },
              { id: 'hair_bang', label: 'Челка', value: '', categoryId: null },
              { id: 'hair_part', label: 'Прическа', value: '', categoryId: null },
            ],
          },
          {
            id: 'grp_eyes',
            name: 'Глаза',
            collapsed: false,
            rows: [
              { id: 'eyes_shape', label: 'Форма глаз', value: '', categoryId: null },
              { id: 'eyes_color', label: 'Цвет глаз', value: '', categoryId: null },
              { id: 'eyes_pupil', label: 'Форма зрачков', value: '', categoryId: null },
            ],
          },
          {
            id: 'grp_face',
            name: 'Лицо и тело',
            collapsed: false,
            rows: [
              { id: 'face', label: 'Торс', value: '', categoryId: null },
              { id: 'skin_color', label: 'Цвет кожи', value: '', categoryId: null },
              { id: 'chest', label: 'Размер груди', value: '', categoryId: null },
            ],
          },
        ],
      },
      {
        id: 'mod_clothes',
        name: 'Модуль одежды',
        icon: '👕',
        color: '#d6e4f0',
        collapsed: false,
        groups: [
          {
            id: 'grp_style',
            name: 'Стиль',
            collapsed: false,
            rows: [
              { id: 'style', label: 'Стиль одежды', value: '', categoryId: null },
            ],
          },
          {
            id: 'grp_top',
            name: 'Верх',
            collapsed: false,
            rows: [
              { id: 'headwear', label: 'Headwear', value: '', categoryId: null },
              { id: 'neckwear', label: 'Neckwear', value: '', categoryId: null },
              { id: 'handwear', label: 'Handwear', value: '', categoryId: null },
              { id: 'topwear1', label: 'Topwear 1', value: '', categoryId: null },
              { id: 'topwear2', label: 'Topwear 2', value: '', categoryId: null },
            ],
          },
          {
            id: 'grp_bottom',
            name: 'Низ',
            collapsed: false,
            rows: [
              { id: 'bottomwear', label: 'Bottomwear', value: '', categoryId: null },
              { id: 'legwear', label: 'Legwear', value: '', categoryId: null },
              { id: 'footwear', label: 'Footwear', value: '', categoryId: null },
            ],
          },
          {
            id: 'grp_acc',
            name: 'Аксессуары',
            collapsed: false,
            rows: [
              { id: 'acc1', label: 'Accessories 1', value: '', categoryId: null },
              { id: 'acc2', label: 'Accessories 2', value: '', categoryId: null },
              { id: 'acc3', label: 'Accessories 3', value: '', categoryId: null },
              { id: 'acc4', label: 'Accessories 4', value: '', categoryId: null },
              { id: 'acc5', label: 'Accessories 5', value: '', categoryId: null },
            ],
          },
        ],
      },
      {
        id: 'mod_race',
        name: 'Модуль расы',
        icon: '🐱',
        color: '#f5e6b8',
        collapsed: false,
        groups: [
          {
            id: 'grp_race',
            name: 'Раса',
            collapsed: false,
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

  // Миграция старой схемы (rows на модуле) в новую (groups)
  function migrateSchema(data) {
    if (!data || !data.modules) return clone(DEFAULT_SCHEMA);
    for (const mod of data.modules) {
      if (!mod.groups) {
        mod.groups = [{
          id: 'grp_default_' + mod.id,
          name: 'Атрибуты',
          collapsed: false,
          rows: mod.rows || [],
        }];
        delete mod.rows;
      }
      if (mod.collapsed === undefined) mod.collapsed = false;
      if (!mod.icon) mod.icon = '📋';
      for (const grp of mod.groups) {
        if (grp.collapsed === undefined) grp.collapsed = false;
      }
    }
    return data;
  }

  function createAttributes(ctx) {
    let schema = clone(DEFAULT_SCHEMA);

    function saveToState() {
      const state = ctx.getState();
      state.attributes = clone(schema);
    }

    // Обход всех строк
    function forEachRow(callback) {
      for (const mod of schema.modules) {
        for (const grp of mod.groups) {
          for (const row of grp.rows) {
            callback(row, mod, grp);
          }
        }
      }
    }

    function findRow(attrId) {
      for (const mod of schema.modules) {
        for (const grp of mod.groups) {
          const row = grp.rows.find(r => r.id === attrId);
          if (row) return { row, module: mod, group: grp };
        }
      }
      return null;
    }

    // ============ Модули ============
    function addModule(name, icon) {
      const mod = {
        id: 'mod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: name || 'Новый модуль',
        icon: icon || '📋',
        color: '#cccccc',
        collapsed: false,
        groups: [],
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

    function toggleModuleCollapsed(moduleId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (mod) {
        mod.collapsed = !mod.collapsed;
        saveToState();
        // Не пишем в историю — это чисто UI
      }
    }

    // ============ Группы ============
    function addGroup(moduleId, name) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const grp = {
        id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: name || 'Новая группа',
        collapsed: false,
        rows: [],
      };
      mod.groups.push(grp);
      saveToState();
      ctx.onDataChanged?.('add-group');
      return grp;
    }

    function removeGroup(moduleId, groupId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      mod.groups = mod.groups.filter(g => g.id !== groupId);
      saveToState();
      ctx.onDataChanged?.('remove-group');
    }

    function renameGroup(moduleId, groupId, name) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const grp = mod.groups.find(g => g.id === groupId);
      if (grp) {
        grp.name = name;
        saveToState();
        ctx.onDataChanged?.('rename-group');
      }
    }

    function toggleGroupCollapsed(moduleId, groupId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const grp = mod.groups.find(g => g.id === groupId);
      if (grp) {
        grp.collapsed = !grp.collapsed;
        saveToState();
        // Не пишем в историю
      }
    }

    // ============ Атрибуты ============
    function addAttribute(moduleId, groupId, label) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      let grp = mod.groups.find(g => g.id === groupId);
      if (!grp) {
        if (mod.groups.length === 0) {
          grp = { id: 'grp_def_' + Date.now(), name: 'Общее', collapsed: false, rows: [] };
          mod.groups.push(grp);
        } else {
          grp = mod.groups[0];
        }
      }
      const row = {
        id: 'attr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: label || 'Новый атрибут',
        value: '',
        categoryId: null,
      };
      grp.rows.push(row);
      saveToState();
      ctx.onDataChanged?.('add-attribute');
      return row;
    }

    function removeAttribute(attrId) {
      for (const mod of schema.modules) {
        for (const grp of mod.groups) {
          const idx = grp.rows.findIndex(r => r.id === attrId);
          if (idx >= 0) {
            grp.rows.splice(idx, 1);
            saveToState();
            ctx.onDataChanged?.('remove-attribute');
            return;
          }
        }
      }
    }

    function renameAttribute(attrId, label) {
      const found = findRow(attrId);
      if (found) {
        found.row.label = label;
        saveToState();
        ctx.onDataChanged?.('rename-attribute');
      }
    }

    // ============ Значения ============
    function setAttributeValue(attrId, value) {
      const found = findRow(attrId);
      if (!found) return;
      found.row.value = value;
      saveToState();
      applyBindingsSilent(attrId);
      ctx.onDataChanged?.('set-attribute-value');
    }

    function getAttribute(attrId) {
      const found = findRow(attrId);
      if (!found) return null;
      return { row: found.row, module: found.module, group: found.group };
    }

    // ============ Привязки ============
    function bindCategory(attrId, categoryId) {
      const found = findRow(attrId);
      if (!found) return;
      found.row.categoryId = categoryId || null;
      saveToState();
      applyBindingsSilent(attrId);
      ctx.onDataChanged?.('bind-category');
    }

    function unbindCategory(attrId) {
      const found = findRow(attrId);
      if (!found) return;
      found.row.categoryId = null;
      saveToState();
      ctx.onDataChanged?.('unbind-category');
    }

    function getBoundCategory(attrId) {
      const found = findRow(attrId);
      if (!found) return null;
      return found.row.categoryId || null;
    }

    // Найти элемент по значению в категории
    function findItemForValue(cat, value) {
      if (!cat || !value) return null;
      const target = value.trim();
      const normTarget = normalizeName(target);

      let found = cat.items.find(it => it.id.toLowerCase() === target.toLowerCase());
      if (found) return found;

      found = cat.items.find(it => normalizeName(it.name) === normTarget);
      if (found) return found;

      found = cat.items.find(it =>
        normalizeName(it.name).includes(normTarget) ||
        normTarget.includes(normalizeName(it.name))
      );
      return found || null;
    }

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

    function applyAllBindings() {
      const state = ctx.getState();
      const changedCats = new Set();

      forEachRow(row => {
        if (!row.value || !row.categoryId) return;
        const cat = state.categories.find(c => c.id === row.categoryId);
        if (!cat) return;
        const foundItem = findItemForValue(cat, row.value);
        if (foundItem && state.activeItems[cat.id] !== foundItem.id) {
          state.activeItems[cat.id] = foundItem.id;
          changedCats.add(cat.id);
        }
      });

      if (changedCats.size > 0) {
        for (const catId of changedCats) ctx.invalidate?.(catId);
        ctx.onBindingsChanged?.(changedCats);
      }
      return changedCats.size;
    }

    // ============ Рандомное заполнение ============
    /**
     * Заполнить указанные атрибуты случайными значениями из привязанных категорий
     * @param {Array<string>} attrIds — если не указано, заполняем все привязанные
     */
    function randomizeAttributes(attrIds) {
      const state = ctx.getState();
      let count = 0;

      const ids = attrIds || null;
      forEachRow(row => {
        if (ids && !ids.includes(row.id)) return;
        if (!row.categoryId) return;
        const cat = state.categories.find(c => c.id === row.categoryId);
        if (!cat || cat.items.length === 0) return;
        const randomItem = cat.items[Math.floor(Math.random() * cat.items.length)];
        row.value = randomItem.name;
        count++;
      });

      if (count > 0) {
        saveToState();
        applyAllBindings();
        ctx.onDataChanged?.('randomize');
      }
      return count;
    }

    /**
     * Рандомизировать конкретный модуль
     */
    function randomizeModule(moduleId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return 0;
      const ids = [];
      for (const grp of mod.groups) {
        for (const row of grp.rows) ids.push(row.id);
      }
      return randomizeAttributes(ids);
    }

    /**
     * Рандомизировать конкретную группу
     */
    function randomizeGroup(moduleId, groupId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return 0;
      const grp = mod.groups.find(g => g.id === groupId);
      if (!grp) return 0;
      const ids = grp.rows.map(r => r.id);
      return randomizeAttributes(ids);
    }

    // ============ Статистика ============
    function getStats() {
      let total = 0;
      let bound = 0;
      let filled = 0;
      forEachRow(row => {
        total++;
        if (row.categoryId) bound++;
        if (row.value && row.value.trim()) filled++;
      });
      return { total, bound, filled };
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
      schema = migrateSchema(clone(data));
    }

    function getSchema() {
      return schema;
    }

    function reset() {
      schema = clone(DEFAULT_SCHEMA);
      saveToState();
    }

    return {
      addModule, removeModule, renameModule, toggleModuleCollapsed,
      addGroup, removeGroup, renameGroup, toggleGroupCollapsed,
      addAttribute, removeAttribute, renameAttribute,
      setAttributeValue, getAttribute,
      bindCategory, unbindCategory, getBoundCategory,
      applyBindings, applyAllBindings,
      randomizeAttributes, randomizeModule, randomizeGroup,
      getStats,
      getSchema, serialize, deserialize, reset,
      normalizeName, findItemForValue,
    };
  }

  global.createAttributes = createAttributes;
  global.DEFAULT_ATTRIBUTE_SCHEMA = DEFAULT_SCHEMA;
})(window);