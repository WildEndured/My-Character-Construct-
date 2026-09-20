/* bindings-ui.js — UI окна атрибутов и привязок */
(function(global) {
  'use strict';

  function createBindingsUI(attributes, ctx) {
    const modal = document.getElementById('modal-attributes');
    const list = document.getElementById('attributes-list');
    const bindingModal = document.getElementById('modal-binding');
    const bindingList = document.getElementById('binding-list');
    const bindingSearch = document.getElementById('binding-search');

    let currentAttrId = null;
    let currentSlotIndex = 0;

    // ============ Рендер модулей и атрибутов ============
    function render() {
      list.innerHTML = '';
      const schema = attributes.getSchema();

      for (const mod of schema.modules) {
        const modEl = document.createElement('div');
        modEl.className = 'attr-module';
        modEl.style.borderLeftColor = mod.color || '#4a7cff';

        // Заголовок модуля
        const header = document.createElement('div');
        header.className = 'attr-module-header';
        header.style.background = mod.color || '#4a7cff';

        const title = document.createElement('input');
        title.className = 'attr-module-title';
        title.value = mod.name;
        title.addEventListener('change', () => {
          attributes.renameModule(mod.id, title.value);
        });
        header.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'attr-module-actions';

        const addBtn = document.createElement('button');
        addBtn.className = 'attr-icon-btn';
        addBtn.textContent = '＋';
        addBtn.title = 'Добавить атрибут';
        addBtn.addEventListener('click', () => {
          const label = prompt('Название атрибута:', 'Новый атрибут');
          if (label === null) return;
          attributes.addAttribute(mod.id, label);
          render();
        });
        actions.appendChild(addBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'attr-icon-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Удалить модуль';
        delBtn.addEventListener('click', () => {
          if (!confirm(`Удалить модуль "${mod.name}"?`)) return;
          attributes.removeModule(mod.id);
          render();
        });
        actions.appendChild(delBtn);

        header.appendChild(actions);
        modEl.appendChild(header);

        // Строки атрибутов
        for (const row of mod.rows) {
          const rowEl = document.createElement('div');
          rowEl.className = 'attr-row';

          // Название
          const label = document.createElement('input');
          label.className = 'attr-row-label';
          label.value = row.label;
          label.addEventListener('change', () => {
            attributes.renameAttribute(mod.id, row.id, label.value);
          });
          rowEl.appendChild(label);

          // Значение
          const valueInput = document.createElement('input');
          valueInput.className = 'attr-row-value';
          valueInput.value = row.value || '';
          valueInput.placeholder = '—';
          valueInput.dataset.attrId = row.id;
          valueInput.addEventListener('change', () => {
            attributes.setAttributeValue(row.id, valueInput.value);
            updateBindingIndicators();
          });
          rowEl.appendChild(valueInput);

          // Индикатор привязок
          const bindings = attributes.getAllBindingsForAttr(row.id);
          const bindBadge = document.createElement('button');
          bindBadge.className = 'attr-bind-badge' +
            (bindings.length ? ' has-bindings' : '');
          bindBadge.textContent = bindings.length || '⚭';
          bindBadge.title = 'Настроить привязки';
          bindBadge.addEventListener('click', () => {
            openBindingEditor(row.id, 0);
          });
          rowEl.appendChild(bindBadge);

          // Удаление атрибута
          const delBtn2 = document.createElement('button');
          delBtn2.className = 'attr-icon-btn small';
          delBtn2.textContent = '×';
          delBtn2.addEventListener('click', () => {
            if (!confirm(`Удалить атрибут "${row.label}"?`)) return;
            attributes.removeAttribute(mod.id, row.id);
            render();
          });
          rowEl.appendChild(delBtn2);

          modEl.appendChild(rowEl);
        }

        list.appendChild(modEl);
      }
    }

    function updateBindingIndicators() {
      const schema = attributes.getSchema();
      const inputs = list.querySelectorAll('.attr-row-value');
      inputs.forEach(inp => {
        const attrId = inp.dataset.attrId;
        const bindings = attributes.getAllBindingsForAttr(attrId);
        const badge = inp.parentElement.querySelector('.attr-bind-badge');
        if (badge) {
          badge.textContent = bindings.length || '⚭';
          badge.classList.toggle('has-bindings', bindings.length > 0);
        }
      });
    }

    // ============ Редактор привязок ============
    function openBindingEditor(attrId, slotIndex) {
      currentAttrId = attrId;
      currentSlotIndex = slotIndex || 0;

      const attrData = attributes.getAttribute(attrId);
      if (!attrData) return;

      document.getElementById('binding-attr-name').textContent = attrData.row.label;
      bindingSearch.value = '';

      renderBindingList();
      bindingModal.classList.add('open');
    }

    function renderBindingList() {
      const state = ctx.getState();
      const query = bindingSearch.value.trim().toLowerCase();
      bindingList.innerHTML = '';

      // Текущая привязка
      const current = attributes.getBinding(currentAttrId, currentSlotIndex);

      // Показываем все категории с элементами
      for (const cat of state.categories) {
        if (cat.items.length === 0) continue;

        const catEl = document.createElement('div');
        catEl.className = 'binding-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'binding-category-title';
        catTitle.textContent = (cat.icon ? cat.icon + ' ' : '') + cat.name;
        catEl.appendChild(catTitle);

        const items = cat.items.filter(it => {
          if (!query) return true;
          return it.name.toLowerCase().includes(query);
        });

        if (items.length === 0) continue;

        const grid = document.createElement('div');
        grid.className = 'binding-grid';

        for (const item of items) {
          const card = document.createElement('div');
          card.className = 'binding-card';
          const isCurrent = current && current.itemId === item.id && current.categoryId === cat.id;
          if (isCurrent) card.classList.add('active');

          if (item.img) {
            const img = document.createElement('img');
            img.src = item.src;
            img.alt = item.name;
            card.appendChild(img);
          } else {
            card.textContent = item.name;
          }

          const nameEl = document.createElement('div');
          nameEl.className = 'binding-card-name';
          nameEl.textContent = item.name;
          card.appendChild(nameEl);

          card.addEventListener('click', () => {
            // Привязываем
            attributes.bindAttribute(currentAttrId, cat.id, item.id, currentSlotIndex);
            // Устанавливаем значение в поле = имя элемента
            attributes.setAttributeValue(currentAttrId, item.name);
            render();
            closeBindingEditor();
            ctx.toast('Привязано: ' + item.name);
          });

          grid.appendChild(card);
        }

        catEl.appendChild(grid);
        bindingList.appendChild(catEl);
      }

      // Кнопка "снять привязку"
      const currentBindings = attributes.getAllBindingsForAttr(currentAttrId);
      if (currentBindings.length > 0) {
        const unlinkBtn = document.createElement('button');
        unlinkBtn.className = 'btn danger';
        unlinkBtn.style.marginTop = '16px';
        unlinkBtn.style.width = '100%';
        unlinkBtn.textContent = '❌ Снять все привязки';
        unlinkBtn.addEventListener('click', () => {
          for (const b of currentBindings) {
            attributes.unbindAttribute(currentAttrId, b.slotIndex);
          }
          attributes.setAttributeValue(currentAttrId, '');
          render();
          closeBindingEditor();
          ctx.toast('Привязки сняты');
        });
        bindingList.appendChild(unlinkBtn);
      }
    }

    function closeBindingEditor() {
      bindingModal.classList.remove('open');
      currentAttrId = null;
    }

    // ============ Публичный API ============
    function open() {
      render();
      modal.classList.add('open');
    }

    function close() {
      modal.classList.remove('open');
    }

    // Поиск по привязкам
    bindingSearch.addEventListener('input', () => renderBindingList());

    return { open, close, render, updateBindingIndicators };
  }

  global.createBindingsUI = createBindingsUI;
})(window);