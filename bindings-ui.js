/* bindings-ui.js — UI привязки атрибутов к КАТЕГОРИЯМ */
(function(global) {
  'use strict';

  function createBindingsUI(attributes, ctx) {
    const modal = document.getElementById('modal-attributes');
    const list = document.getElementById('attributes-list');
    const categoryPickerModal = document.getElementById('modal-category-picker');
    const categoryPickerList = document.getElementById('category-picker-list');
    const categoryPickerSearch = document.getElementById('category-picker-search');
    const categoryPickerAttrName = document.getElementById('category-picker-attr-name');

    let currentAttrId = null;
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
      const state = ctx.getState();

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

          // Название
          const label = document.createElement('input');
          label.className = 'attr-row-label';
          label.value = row.label;
          label.addEventListener('change', () => {
            attributes.renameAttribute(mod.id, row.id, label.value);
          });
          rowEl.appendChild(label);

          // Кнопка выбора категории
          const catBtn = document.createElement('button');
          catBtn.className = 'attr-cat-btn';
          const boundCat = row.categoryId
            ? state.categories.find(c => c.id === row.categoryId)
            : null;
          if (boundCat) {
            catBtn.textContent = (boundCat.icon ? boundCat.icon + ' ' : '') + boundCat.name;
            catBtn.classList.add('has-category');
          } else {
            catBtn.textContent = '⚭ Категория';
          }
          catBtn.title = 'Привязать к категории';
          catBtn.addEventListener('click', () => {
            openCategoryPicker(row.id);
          });
          rowEl.appendChild(catBtn);

          // Значение
          const valueInput = document.createElement('input');
          valueInput.className = 'attr-row-value';
          valueInput.value = row.value || '';
          valueInput.placeholder = boundCat ? 'имя элемента…' : '—';
          valueInput.dataset.attrId = row.id;
          valueInput.disabled = !row.categoryId;
          valueInput.addEventListener('change', () => {
            attributes.setAttributeValue(row.id, valueInput.value);
          });
          rowEl.appendChild(valueInput);

          // Удаление атрибута
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

    // ============ Выбор категории ============
    function openCategoryPicker(attrId) {
      currentAttrId = attrId;
      const attrData = attributes.getAttribute(attrId);
      if (!attrData) return;

      categoryPickerAttrName.textContent = attrData.row.label;
      categoryPickerSearch.value = '';
      renderCategoryPickerList();
      categoryPickerModal.classList.add('open');
    }

    function renderCategoryPickerList() {
      const state = ctx.getState();
      const query = categoryPickerSearch.value.trim().toLowerCase();
      const currentCatId = attributes.getBoundCategory(currentAttrId);

      categoryPickerList.innerHTML = '';

      // Кнопка "Отвязать"
      if (currentCatId) {
        const unlinkBtn = document.createElement('button');
        unlinkBtn.className = 'category-pick-card unlink';
        unlinkBtn.innerHTML = '<div class="cat-icon">❌</div><div class="cat-name">Отвязать</div>';
        unlinkBtn.addEventListener('click', () => {
          attributes.unbindCategory(currentAttrId);
          closeCategoryPicker();
          scheduleRender();
          ctx.toast('Отвязано');
        });
        categoryPickerList.appendChild(unlinkBtn);
      }

      const cats = state.categories.filter(cat => {
        if (!query) return true;
        return cat.name.toLowerCase().includes(query);
      });

      if (cats.length === 0) {
        const empty = document.createElement('div');
        empty.style.gridColumn = '1 / -1';
        empty.style.textAlign = 'center';
        empty.style.color = '#888';
        empty.style.padding = '20px';
        empty.textContent = query ? 'Ничего не найдено' : 'Нет категорий. Создайте категорию в редакторе.';
        categoryPickerList.appendChild(empty);
        return;
      }

      for (const cat of cats) {
        const card = document.createElement('div');
        card.className = 'category-pick-card' + (cat.id === currentCatId ? ' active' : '');

        const icon = document.createElement('div');
        icon.className = 'cat-icon';
        icon.textContent = cat.icon || '📁';
        card.appendChild(icon);

        const name = document.createElement('div');
        name.className = 'cat-name';
        name.textContent = cat.name;
        card.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'cat-meta';
        meta.textContent = `${cat.items.length} эл.`;
        card.appendChild(meta);

        card.addEventListener('click', () => {
          attributes.bindCategory(currentAttrId, cat.id);
          closeCategoryPicker();
          scheduleRender();
          ctx.toast('Привязано к «' + cat.name + '»');
        });

        categoryPickerList.appendChild(card);
      }
    }

    function closeCategoryPicker() {
      categoryPickerModal.classList.remove('open');
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

    categoryPickerSearch.addEventListener('input', () => {
      clearTimeout(categoryPickerSearch._t);
      categoryPickerSearch._t = setTimeout(renderCategoryPickerList, 150);
    });

    const pickerCancel = document.getElementById('category-picker-cancel');
    if (pickerCancel) {
      pickerCancel.addEventListener('click', closeCategoryPicker);
    }

    return { open, close, render, scheduleRender, closeCategoryPicker };
  }

  global.createBindingsUI = createBindingsUI;
})(window);