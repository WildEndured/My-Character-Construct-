/* bindings-ui.js — UI атрибутов: автокомплит, превью, группы, рандом */
(function(global) {
  'use strict';

  function createBindingsUI(attributes, ctx) {
    const modal = document.getElementById('modal-attributes');
    const list = document.getElementById('attributes-list');
    const categoryPickerModal = document.getElementById('modal-category-picker');
    const categoryPickerList = document.getElementById('category-picker-list');
    const categoryPickerSearch = document.getElementById('category-picker-search');
    const categoryPickerAttrName = document.getElementById('category-picker-attr-name');
    const progressBar = document.getElementById('attr-progress-bar');
    const progressText = document.getElementById('attr-progress-text');
    const globalSearch = document.getElementById('attr-global-search');

    let currentAttrId = null;
    let renderScheduled = false;
    let globalQuery = '';

    // Активный автокомплит
    let activeAutocomplete = null;

    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        render();
      });
    }

    // ============ Прогресс ============
    function updateProgress() {
      if (!progressBar || !progressText) return;
      const stats = attributes.getStats();
      const percent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;
      progressBar.style.width = percent + '%';
      progressText.textContent = `Заполнено ${stats.filled} из ${stats.total}`;
    }

    // ============ Рендер ============
    function render() {
      list.innerHTML = '';
      const schema = attributes.getSchema();
      const state = ctx.getState();

      const query = globalQuery.trim().toLowerCase();

      for (const mod of schema.modules) {
        // Проверяем, есть ли подходящие атрибуты
        const modMatches = !query || mod.name.toLowerCase().includes(query) ||
          mod.groups.some(g => g.name.toLowerCase().includes(query) ||
            g.rows.some(r => r.label.toLowerCase().includes(query) ||
              (r.value && r.value.toLowerCase().includes(query))));

        if (!modMatches) continue;

        const modEl = document.createElement('div');
        modEl.className = 'attr-module';
        modEl.style.borderLeftColor = mod.color || '#4a7cff';

        // ===== Header модуля =====
        const header = document.createElement('div');
        header.className = 'attr-module-header';
        header.style.background = mod.color || '#4a7cff';

        const collapseIcon = document.createElement('div');
        collapseIcon.className = 'attr-collapse-icon';
        collapseIcon.textContent = mod.collapsed ? '▶' : '▼';
        header.appendChild(collapseIcon);

        const icon = document.createElement('span');
        icon.className = 'attr-module-icon';
        icon.textContent = mod.icon || '📋';
        header.appendChild(icon);

        const title = document.createElement('input');
        title.className = 'attr-module-title';
        title.value = mod.name;
        title.addEventListener('change', () => {
          attributes.renameModule(mod.id, title.value);
        });
        header.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'attr-module-actions';

        // Кнопка рандома
        const randomBtn = document.createElement('button');
        randomBtn.className = 'attr-icon-btn';
        randomBtn.textContent = '🎲';
        randomBtn.title = 'Случайное заполнение модуля';
        randomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const count = attributes.randomizeModule(mod.id);
          if (count > 0) {
            ctx.toast(`Заполнено: ${count}`, 'success');
            scheduleRender();
          } else {
            ctx.toast('Нет привязанных категорий', 'error');
          }
        });
        actions.appendChild(randomBtn);

        const addGroupBtn = document.createElement('button');
        addGroupBtn.className = 'attr-icon-btn';
        addGroupBtn.textContent = '📁';
        addGroupBtn.title = 'Добавить группу';
        addGroupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = prompt('Название группы:', 'Новая группа');
          if (name === null) return;
          attributes.addGroup(mod.id, name);
          scheduleRender();
        });
        actions.appendChild(addGroupBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'attr-icon-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Удалить модуль';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm(`Удалить модуль "${mod.name}"?`)) return;
          attributes.removeModule(mod.id);
          scheduleRender();
        });
        actions.appendChild(delBtn);

        header.appendChild(actions);

        // Клик по шапке — сворачивает
        header.addEventListener('click', (e) => {
          if (e.target.closest('.attr-icon-btn') || e.target.closest('input')) return;
          attributes.toggleModuleCollapsed(mod.id);
          scheduleRender();
        });

        modEl.appendChild(header);

        // ===== Body модуля =====
        if (!mod.collapsed) {
          const body = document.createElement('div');
          body.className = 'attr-module-body';

          for (const grp of mod.groups) {
            // Проверка по query
            const grpMatches = !query || grp.name.toLowerCase().includes(query) ||
              grp.rows.some(r => r.label.toLowerCase().includes(query) ||
                (r.value && r.value.toLowerCase().includes(query)));

            if (!grpMatches) continue;

            const grpEl = document.createElement('div');
            grpEl.className = 'attr-group';

            // Шапка группы
            const grpHeader = document.createElement('div');
            grpHeader.className = 'attr-group-header';

            const grpCollapse = document.createElement('div');
            grpCollapse.className = 'attr-collapse-icon small';
            grpCollapse.textContent = grp.collapsed ? '▶' : '▼';
            grpHeader.appendChild(grpCollapse);

            const grpName = document.createElement('input');
            grpName.className = 'attr-group-name';
            grpName.value = grp.name;
            grpName.addEventListener('change', () => {
              attributes.renameGroup(mod.id, grp.id, grpName.value);
            });
            grpName.addEventListener('click', (e) => e.stopPropagation());
            grpHeader.appendChild(grpName);

            const grpActions = document.createElement('div');
            grpActions.className = 'attr-group-actions';

            // Рандом группы
            const grpRandomBtn = document.createElement('button');
            grpRandomBtn.className = 'attr-icon-btn tiny';
            grpRandomBtn.textContent = '🎲';
            grpRandomBtn.title = 'Случайно заполнить группу';
            grpRandomBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const count = attributes.randomizeGroup(mod.id, grp.id);
              if (count > 0) {
                ctx.toast(`Заполнено: ${count}`, 'success');
                scheduleRender();
              } else {
                ctx.toast('Нет привязанных категорий', 'error');
              }
            });
            grpActions.appendChild(grpRandomBtn);

            const grpAddBtn = document.createElement('button');
            grpAddBtn.className = 'attr-icon-btn tiny';
            grpAddBtn.textContent = '＋';
            grpAddBtn.title = 'Добавить атрибут';
            grpAddBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const label = prompt('Название атрибута:', 'Новый атрибут');
              if (label === null) return;
              attributes.addAttribute(mod.id, grp.id, label);
              scheduleRender();
            });
            grpActions.appendChild(grpAddBtn);

            const grpDelBtn = document.createElement('button');
            grpDelBtn.className = 'attr-icon-btn tiny danger';
            grpDelBtn.textContent = '×';
            grpDelBtn.title = 'Удалить группу';
            grpDelBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!confirm(`Удалить группу "${grp.name}"?`)) return;
              attributes.removeGroup(mod.id, grp.id);
              scheduleRender();
            });
            grpActions.appendChild(grpDelBtn);

            grpHeader.appendChild(grpActions);

            // Клик по шапке группы — сворачивает
            grpHeader.addEventListener('click', (e) => {
              if (e.target.closest('.attr-icon-btn') || e.target.closest('input')) return;
              attributes.toggleGroupCollapsed(mod.id, grp.id);
              scheduleRender();
            });

            grpEl.appendChild(grpHeader);

            // Тело группы
            if (!grp.collapsed) {
              const grpBody = document.createElement('div');
              grpBody.className = 'attr-group-body';

              for (const row of grp.rows) {
                // Фильтр по query
                if (query &&
                    !row.label.toLowerCase().includes(query) &&
                    !(row.value && row.value.toLowerCase().includes(query))) {
                  continue;
                }

                const rowEl = renderAttributeRow(row, mod, state);
                grpBody.appendChild(rowEl);
              }

              grpEl.appendChild(grpBody);
            }

            body.appendChild(grpEl);
          }

          // Кнопка "добавить группу" в конце
          const addGroupFoot = document.createElement('button');
          addGroupFoot.className = 'attr-add-group-btn';
          addGroupFoot.textContent = '📁 Добавить группу';
          addGroupFoot.addEventListener('click', () => {
            const name = prompt('Название группы:', 'Новая группа');
            if (name === null) return;
            attributes.addGroup(mod.id, name);
            scheduleRender();
          });
          body.appendChild(addGroupFoot);

          modEl.appendChild(body);
        }

        list.appendChild(modEl);
      }

      updateProgress();
    }

    // ============ Строка атрибута ============
    function renderAttributeRow(row, mod, state) {
      const rowEl = document.createElement('div');
      rowEl.className = 'attr-row';

      // Название
      const label = document.createElement('input');
      label.className = 'attr-row-label';
      label.value = row.label;
      label.addEventListener('change', () => {
        attributes.renameAttribute(row.id, label.value);
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

      // Обёртка для значения + превью + статус
      const valueWrap = document.createElement('div');
      valueWrap.className = 'attr-value-wrap';

      // Поле значения (клик открывает автокомплит)
      const valueInput = document.createElement('input');
      valueInput.className = 'attr-row-value';
      valueInput.value = row.value || '';
      valueInput.placeholder = boundCat ? 'выберите элемент…' : '—';
      valueInput.dataset.attrId = row.id;
      valueInput.autocomplete = 'off';
      valueInput.disabled = !row.categoryId;

      // Фокус — открываем автокомплит
      valueInput.addEventListener('focus', () => {
        if (boundCat) {
          openAutocomplete(row.id, valueInput, catBtn, valueWrap);
        }
      });

      // Ввод — фильтруем
      valueInput.addEventListener('input', () => {
        row.value = valueInput.value;
        attributes.setAttributeValue(row.id, valueInput.value);
        updateStatusBadge(valueWrap, row, boundCat);
        if (boundCat) {
          updateAutocompleteList(row.id, valueInput.value, boundCat);
        }
      });

      // Enter — закрываем
      valueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          valueInput.blur();
          closeAutocomplete();
        } else if (e.key === 'Escape') {
          closeAutocomplete();
        }
      });

      valueInput.addEventListener('blur', () => {
        // Задержка, чтобы клик по варианту сработал
        setTimeout(() => closeAutocomplete(), 200);
      });

      valueWrap.appendChild(valueInput);

      // Кнопка быстрого выбора
      if (boundCat) {
        const quickBtn = document.createElement('button');
        quickBtn.className = 'attr-quick-pick';
        quickBtn.textContent = '▼';
        quickBtn.title = 'Показать все элементы';
        quickBtn.addEventListener('click', (e) => {
          e.preventDefault();
          valueInput.focus();
          openAutocomplete(row.id, valueInput, catBtn, valueWrap, true);
        });
        valueWrap.appendChild(quickBtn);
      }

      // Превью активного элемента
      const preview = document.createElement('div');
      preview.className = 'attr-preview';
      valueWrap.appendChild(preview);

      // Статус-индикатор
      const status = document.createElement('div');
      status.className = 'attr-status';
      valueWrap.appendChild(status);

      rowEl.appendChild(valueWrap);
      updateStatusBadge(valueWrap, row, boundCat);

      // Удаление
      const delBtn2 = document.createElement('button');
      delBtn2.className = 'attr-icon-btn small';
      delBtn2.textContent = '×';
      delBtn2.addEventListener('click', () => {
        if (!confirm(`Удалить атрибут "${row.label}"?`)) return;
        attributes.removeAttribute(row.id);
        scheduleRender();
      });
      rowEl.appendChild(delBtn2);

      return rowEl;
    }

    // Обновление превью и статуса
    function updateStatusBadge(valueWrap, row, boundCat) {
      const preview = valueWrap.querySelector('.attr-preview');
      const status = valueWrap.querySelector('.attr-status');

      preview.innerHTML = '';
      status.className = 'attr-status';
      status.textContent = '';

      if (!boundCat) {
        status.classList.add('neutral');
        return;
      }

      const value = (row.value || '').trim();
      if (!value) {
        status.classList.add('neutral');
        return;
      }

      // Ищем элемент
      const item = attributes.findItemForValue(boundCat, value);
      if (item) {
        // Точное или нормализованное совпадение
        const exact = item.name.toLowerCase() === value.toLowerCase() ||
                      attributes.normalizeName(item.name) === attributes.normalizeName(value);
        if (exact) {
          status.classList.add('ok');
          status.textContent = '✓';
        } else {
          status.classList.add('partial');
          status.textContent = '~';
        }
        // Превью
        if (item.src) {
          const img = document.createElement('img');
          img.src = item.src;
          img.alt = item.name;
          img.loading = 'lazy';
          preview.appendChild(img);
        }
      } else {
        status.classList.add('error');
        status.textContent = '⚠';
      }
    }

    // ============ Автокомплит ============
    function openAutocomplete(attrId, input, catBtn, valueWrap, showAll) {
      closeAutocomplete();

      const rowData = attributes.getAttribute(attrId);
      if (!rowData || !rowData.row.categoryId) return;
      const cat = ctx.getState().categories.find(c => c.id === rowData.row.categoryId);
      if (!cat || cat.items.length === 0) return;

      // Создаём контейнер автокомплита
      const ac = document.createElement('div');
      ac.className = 'attr-autocomplete';
      ac.dataset.attrId = attrId;

      const rect = input.getBoundingClientRect();
      ac.style.left = rect.left + 'px';
      ac.style.top = (rect.bottom + 4) + 'px';
      ac.style.minWidth = Math.max(rect.width, 220) + 'px';

      document.body.appendChild(ac);

      activeAutocomplete = { el: ac, attrId, input, cat, catBtn, valueWrap };

      const query = showAll ? '' : (input.value || '');
      renderAutocompleteList(query);
    }

    function updateAutocompleteList(attrId, query, cat) {
      if (!activeAutocomplete || activeAutocomplete.attrId !== attrId) return;
      renderAutocompleteList(query);
    }

    function renderAutocompleteList(query) {
      if (!activeAutocomplete) return;
      const { el, cat } = activeAutocomplete;

      const q = (query || '').trim().toLowerCase();
      const items = cat.items.filter(it => {
        if (!q) return true;
        return it.name.toLowerCase().includes(q);
      });

      el.innerHTML = '';

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'attr-autocomplete-empty';
        empty.textContent = q ? 'Ничего не найдено' : 'Нет элементов';
        el.appendChild(empty);
        return;
      }

      // Ограничим 50 элементами
      const limited = items.slice(0, 50);
      for (const item of limited) {
        const opt = document.createElement('div');
        opt.className = 'attr-autocomplete-item';

        if (item.src) {
          const img = document.createElement('img');
          img.src = item.src;
          img.alt = item.name;
          img.loading = 'lazy';
          opt.appendChild(img);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'attr-autocomplete-name';
        nameEl.textContent = item.name;
        opt.appendChild(nameEl);

        // Подсветка совпадения
        if (q) {
          const idx = item.name.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const before = item.name.slice(0, idx);
            const match = item.name.slice(idx, idx + q.length);
            const after = item.name.slice(idx + q.length);
            nameEl.textContent = '';
            nameEl.append(before);
            const mark = document.createElement('mark');
            mark.textContent = match;
            nameEl.append(mark);
            nameEl.append(after);
          }
        }

        opt.addEventListener('mousedown', (e) => {
          e.preventDefault(); // не даём input потерять фокус
          selectAutocompleteItem(item);
        });
        opt.addEventListener('touchstart', (e) => {
          e.preventDefault();
          selectAutocompleteItem(item);
        }, { passive: false });

        el.appendChild(opt);
      }

      if (items.length > 50) {
        const more = document.createElement('div');
        more.className = 'attr-autocomplete-more';
        more.textContent = `…и ещё ${items.length - 50}`;
        el.appendChild(more);
      }
    }

    function selectAutocompleteItem(item) {
      if (!activeAutocomplete) return;
      const { attrId, input, valueWrap } = activeAutocomplete;
      const rowData = attributes.getAttribute(attrId);
      if (!rowData) return;

      input.value = item.name;
      rowData.row.value = item.name;
      attributes.setAttributeValue(attrId, item.name);

      const boundCat = ctx.getState().categories.find(c => c.id === rowData.row.categoryId);
      updateStatusBadge(valueWrap, rowData.row, boundCat);

      closeAutocomplete();
    }

    function closeAutocomplete() {
      if (activeAutocomplete) {
        activeAutocomplete.el.remove();
        activeAutocomplete = null;
      }
    }

    // Клик вне — закрыть
    document.addEventListener('mousedown', (e) => {
      if (activeAutocomplete && !activeAutocomplete.el.contains(e.target) &&
          e.target !== activeAutocomplete.input) {
        closeAutocomplete();
      }
    });
    document.addEventListener('touchstart', (e) => {
      if (activeAutocomplete && !activeAutocomplete.el.contains(e.target) &&
          e.target !== activeAutocomplete.input) {
        closeAutocomplete();
      }
    }, { passive: true });
    window.addEventListener('scroll', closeAutocomplete, { passive: true, capture: true });
    window.addEventListener('resize', closeAutocomplete);

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

      if (currentCatId) {
        const unlinkBtn = document.createElement('div');
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
        empty.textContent = query
          ? 'Ничего не найдено'
          : 'Нет категорий. Создайте категорию в редакторе.';
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

    function open() {
      render();
      modal.classList.add('open');
    }

    function close() {
      modal.classList.remove('open');
      closeAutocomplete();
    }

    // ============ Обработчики ============
    categoryPickerSearch.addEventListener('input', () => {
      clearTimeout(categoryPickerSearch._t);
      categoryPickerSearch._t = setTimeout(renderCategoryPickerList, 150);
    });

    if (globalSearch) {
      globalSearch.addEventListener('input', () => {
        globalQuery = globalSearch.value;
        clearTimeout(globalSearch._t);
        globalSearch._t = setTimeout(render, 200);
      });
    }

    const pickerCancel = document.getElementById('category-picker-cancel');
    if (pickerCancel) {
      pickerCancel.addEventListener('click', closeCategoryPicker);
    }

    // Кнопка глобального рандома
    const randomAllBtn = document.getElementById('attr-random-all');
    if (randomAllBtn) {
      randomAllBtn.addEventListener('click', () => {
        const count = attributes.randomizeAttributes();
        if (count > 0) {
          ctx.toast(`Заполнено: ${count}`, 'success');
          scheduleRender();
        } else {
          ctx.toast('Нет привязанных категорий', 'error');
        }
      });
    }

    return {
      open, close, render, scheduleRender,
      closeCategoryPicker, closeAutocomplete,
    };
  }

  global.createBindingsUI = createBindingsUI;
})(window);