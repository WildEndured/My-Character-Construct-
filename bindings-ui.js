/* bindings-ui.js — UI окна атрибутов и привязок */
(function(global) {
  'use strict';

  function createBindingsUI(attributes, ctx) {
    const modal = document.getElementById('modal-attributes');
    const list = document.getElementById('attributes-list');
    const bindingModal = document.getElementById('modal-binding');
    const bindingList = document.getElementById('binding-list');
    const bindingSearch = document.getElementById('binding-search');
    const bindingSlotsBar = document.getElementById('binding-slots-bar');

    let currentAttrId = null;
    let currentSlotIndex = 0;
    let renderScheduled = false;

    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        render();
      });
    }

    function render() {
      list.innerHTML = '';
      const schema = attributes.getSchema();

      for (const mod of schema.modules) {
        const modEl = document.createElement('div');
        modEl.className = 'attr-module';
        modEl.style.borderLeftColor = mod.color || '#4a7cff';

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
          scheduleRender();
        });
        actions.appendChild(addBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'attr-icon-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Удалить модуль';
        delBtn.addEventListener('click', () => {
          if (!confirm(`Удалить модуль "${mod.name}"?`)) return;
          attributes.removeModule(mod.id);
          scheduleRender();
        });
        actions.appendChild(delBtn);

        header.appendChild(actions);
        modEl.appendChild(header);

        for (const row of mod.rows) {
          const rowEl = document.createElement('div');
          rowEl.className = 'attr-row';

          const label = document.createElement('input');
          label.className = 'attr-row-label';
          label.value = row.label;
          label.addEventListener('change', () => {
            attributes.renameAttribute(mod.id, row.id, label.value);
          });
          rowEl.appendChild(label);

          const valueInput = document.createElement('input');
          valueInput.className = 'attr-row-value';
          valueInput.value = row.value || '';
          valueInput.placeholder = '—';
          valueInput.dataset.attrId = row.id;
          // НЕ на change, а на blur + Enter — чтобы не дёргать на каждый символ
          valueInput.addEventListener('change', () => {
            attributes.setAttributeValue(row.id, valueInput.value);
            updateBindingIndicators();
          });
          rowEl.appendChild(valueInput);

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

          const delBtn2 = document.createElement('button');
          delBtn2.className = 'attr-icon-btn small';
          delBtn2.textContent = '×';
          delBtn2.addEventListener('click', () => {
            if (!confirm(`Удалить атрибут "${row.label}"?`)) return;
            attributes.removeAttribute(mod.id, row.id);
            scheduleRender();
          });
          rowEl.appendChild(delBtn2);

          modEl.appendChild(rowEl);
        }

        list.appendChild(modEl);
      }
    }

    function updateBindingIndicators() {
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

    function openBindingEditor(attrId, slotIndex) {
      currentAttrId = attrId;
      currentSlotIndex = slotIndex || 0;

      const attrData = attributes.getAttribute(attrId);
      if (!attrData) return;

      document.getElementById('binding-attr-name').textContent = attrData.row.label;
      bindingSearch.value = '';

      renderSlotBar();
      renderBindingList();
      bindingModal.classList.add('open');
    }

    function renderSlotBar() {
      const attrData = attributes.getAttribute(currentAttrId);
      if (!attrData) return;
      const slots = attrData.row.slots || 1;

      bindingSlotsBar.innerHTML = '';
      if (slots <= 1) {
        bindingSlotsBar.style.display = 'none';
        return;
      }
      bindingSlotsBar.style.display = 'flex';

      for (let i = 0; i < slots; i++) {
        const btn = document.createElement('button');
        btn.className = 'slot-btn' + (i === currentSlotIndex ? ' active' : '');
        const b = attributes.getBinding(currentAttrId, i);
        btn.textContent = b ? `Слот ${i + 1} •` : `Слот ${i + 1}`;
        btn.addEventListener('click', () => {
          currentSlotIndex = i;
          renderSlotBar();
          renderBindingList();
        });
        bindingSlotsBar.appendChild(btn);
      }
    }

    function renderBindingList() {
      const state = ctx.getState();
      const query = bindingSearch.value.trim().toLowerCase();
      bindingList.innerHTML = '';

      const current = attributes.getBinding(currentAttrId, currentSlotIndex);

      for (const cat of state.categories) {
        if (cat.items.length === 0) continue;

        const items = cat.items.filter(it => {
          if (!query) return true;
          return it.name.toLowerCase().includes(query);
        });

        if (items.length === 0) continue;

        const catEl = document.createElement('div');
        catEl.className = 'binding-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'binding-category-title';
        catTitle.textContent = (cat.icon ? cat.icon + ' ' : '') + cat.name;
        catEl.appendChild(catTitle);

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
            img.loading = 'lazy';
            card.appendChild(img);
          } else {
            card.textContent = item.name;
          }

          const nameEl = document.createElement('div');
          nameEl.className = 'binding-card-name';
          nameEl.textContent = item.name;
          card.appendChild(nameEl);

          card.addEventListener('click', () => {
            attributes.bindAttribute(currentAttrId, cat.id, item.id, currentSlotIndex);
            // Тихо подставляем имя без полного обновления
            const attrData = attributes.getAttribute(currentAttrId);
            if (attrData) {
              attrData.row.value = item.name;
              // Обновляем только это поле в UI
              const inp = list.querySelector(`.attr-row-value[data-attr-id="${currentAttrId}"]`);
              if (inp) inp.value = item.name;
            }
            closeBindingEditor();
            ctx.toast('Привязано: ' + item.name);
          });

          grid.appendChild(card);
        }

        catEl.appendChild(grid);
        bindingList.appendChild(catEl);
      }

      const currentBindings = attributes.getAllBindingsForAttr(currentAttrId);
      if (currentBindings.length > 0) {
        const unlinkBtn = document.createElement('button');
        unlinkBtn.className = 'btn danger';
        unlinkBtn.style.marginTop = '16px';
        unlinkBtn.style.width = '100%';
        unlinkBtn.textContent = '❌ Снять все привязки атрибута';
        unlinkBtn.addEventListener('click', () => {
          for (const b of currentBindings) {
            attributes.unbindAttribute(currentAttrId, b.slotIndex);
          }
          attributes.setAttributeValue(currentAttrId, '');
          const inp = list.querySelector(`.attr-row-value[data-attr-id="${currentAttrId}"]`);
          if (inp) inp.value = '';
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

    function open() {
      render();
      modal.classList.add('open');
    }

    function close() {
      modal.classList.remove('open');
    }

    bindingSearch.addEventListener('input', () => {
      // Дебаунс поиска
      clearTimeout(bindingSearch._t);
      bindingSearch._t = setTimeout(renderBindingList, 150);
    });

    return { open, close, render, scheduleRender, updateBindingIndicators, closeBindingEditor };
  }

  global.createBindingsUI = createBindingsUI;
})(window);