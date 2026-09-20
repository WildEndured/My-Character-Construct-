/* attributes.js — система атрибутов и привязок атрибут → элемент */
(function(global) {
  'use strict';

  // ============ Схема по умолчанию ============
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
    // Привязки: attributeId → { categoryId, itemId }
    bindings: {},
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ============ Публичный API ============
  function createAttributes(ctx) {
    // ctx = { getState, setState, renderAll, toast, commit }
    let schema = clone(DEFAULT_SCHEMA);

    // Загружаем из основного state
    function loadFromState() {
      const state = ctx.getState();
      if (state.attributes) {
        schema = clone(state.attributes);
      }
    }

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
      ctx.commit('add-module');
      return mod;
    }

    function removeModule(moduleId) {
      schema.modules = schema.modules.filter(m => m.id !== moduleId);
      // Удаляем привязки, связанные с этим модулем
      for (const rowId of Object.keys(schema.bindings)) {
        const belongs = !schema.modules.some(m =>
          m.rows.some(r => r.id === rowId)
        );
        if (belongs) delete schema.bindings[rowId];
      }
      saveToState();
      ctx.commit('remove-module');
    }

    function renameModule(moduleId, name) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (mod) {
        mod.name = name;
        saveToState();
        ctx.commit('rename-module');
      }
    }

    // ============ Атрибуты (строки) ============
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
      ctx.commit('add-attribute');
      return row;
    }

    function removeAttribute(moduleId, attrId) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      mod.rows = mod.rows.filter(r => r.id !== attrId);
      delete schema.bindings[attrId];
      saveToState();
      ctx.commit('remove-attribute');
    }

    function renameAttribute(moduleId, attrId, label) {
      const mod = schema.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const row = mod.rows.find(r => r.id === attrId);
      if (row) {
        row.label = label;
        saveToState();
        ctx.commit('rename-attribute');
      }
    }

    // ============ Значения (значение из таблицы) ============
    function setAttributeValue(attrId, value) {
      for (const mod of schema.modules) {
        const row = mod.rows.find(r => r.id === attrId);
        if (row) {
          row.value = value;
          saveToState();
          ctx.commit('set-attribute-value');
          // Применяем привязки автоматически
          applyBindings(attrId);
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
    /**
     * Привязать атрибут к элементу в категории
     * @param {string} attrId — id строки в модуле
     * @param {string} categoryId — id категории в редакторе
     * @param {string} itemId — id элемента
     * @param {number} slotIndex — индекс слота (0..slots-1)
     */
    function bindAttribute(attrId, categoryId, itemId, slotIndex) {
      if (slotIndex === undefined) slotIndex = 0;
      const key = attrId + '#' + slotIndex;
      schema.bindings[key] = { attrId, categoryId, itemId, slotIndex };
      saveToState();
      ctx.commit('bind-attribute');
      applyBindings(attrId);
    }

    function unbindAttribute(attrId, slotIndex) {
      if (slotIndex === undefined) slotIndex = 0;
      const key = attrId + '#' + slotIndex;
      delete schema.bindings[key];
      saveToState();
      ctx.commit('unbind-attribute');
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

    /**
     * Применить привязки к state — установить активные элементы.
     * Логика:
     * 1. Если у атрибута есть значение (например "cat tail")
     * 2. Ищем элемент с таким именем (или id) в категории из привязки
     * 3. Активируем его
     */
    function applyBindings(attrId) {
      const state = ctx.getState();
      const attrData = getAttribute(attrId);
      if (!attrData) return;

      const { row } = attrData;
      const bindings = getAllBindingsForAttr(attrId);

      for (const binding of bindings) {
        const cat = state.categories.find(c => c.id === binding.categoryId);
        if (!cat) continue;

        // Ищем элемент по имени (case-insensitive) или по id
        const targetValue = (row.value || '').trim().toLowerCase();
        if (!targetValue) {
          // Пустое значение → снять активный элемент
          if (state.activeItems[cat.id]) {
            delete state.activeItems[cat.id];
          }
          continue;
        }

        const foundItem = cat.items.find(it =>
          it.id.toLowerCase() === targetValue ||
          it.name.toLowerCase() === targetValue
        );

        if (foundItem) {
          state.activeItems[cat.id] = foundItem.id;
        }
      }

      ctx.commit('apply-bindings');
    }

    /**
     * Применить ВСЕ привязки (после загрузки проекта)
     */
    function applyAllBindings() {
      for (const mod of schema.modules) {
        for (const row of mod.rows) {
          if (row.value) applyBindings(row.id);
        }
      }
    }

    // ============ Сериализация ============
    function serialize() {
      return clone(schema);
    }

    function deserialize(data) {
      if (!data) return;
      schema = clone(data);
      saveToState();
    }

    function getSchema() {
      return schema;
    }

    return {
      // Модули
      addModule,
      removeModule,
      renameModule,
      // Атрибуты
      addAttribute,
      removeAttribute,
      renameAttribute,
      // Значения
      setAttributeValue,
      getAttribute,
      // Привязки
      bindAttribute,
      unbindAttribute,
      getBinding,
      getAllBindingsForAttr,
      applyBindings,
      applyAllBindings,
      // Данные
      getSchema,
      serialize,
      deserialize,
    };
  }

  global.createAttributes = createAttributes;
  global.DEFAULT_ATTRIBUTE_SCHEMA = DEFAULT_SCHEMA;
})(window);