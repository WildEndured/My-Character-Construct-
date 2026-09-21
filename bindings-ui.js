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
        const modMatches = !query || mod.name.toLowerCase().includes(query) ||
          mod.groups.some(g => g.name.toLowerCase().includes(query) ||
            g.rows.some(r => r.label.toLowerCase().includes(query) ||
              (r.value && r.value.toLowerCase().includes(query))));

        if (!modMatches) continue;

        const modEl = document.createElement('div');
        modEl.className = 'attr-module';
        modEl.style.borderLeftColor = mod.color || '#4a7cff';

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
        title.addEventListener('click', (e) => e.stopPropagation());
        header.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'attr-module-actions';

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

        header.addEventListener('click', (e) => {
          if (e.target.closest('.attr-icon-btn') || e.target.closest('input')) return;
          attributes.toggleModuleCollapsed(mod.id);
          scheduleRender();
        });

        modEl.appendChild(header);

        if (!mod.collapsed) {
          const body = document.createElement('div');
          body.className = 'attr-module-body';

          for (const grp of mod.groups) {
            const grpMatches = !query || grp.name.toLowerCase().includes(query) ||
              grp.rows.some(r => r.label.toLowerCase().includes(query) ||
                (r.value && r.value.toLowerCase().includes(query)));

            if (!grpMatches) continue;

            const grpEl = document.createElement('div');
            grpEl.className = 'attr-group';

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

            grpHeader.addEventListener('click', (e) => {
              if (e.target.closest('.attr-icon-btn') || e.target.closest('input')) return;
              attributes.toggleGroupCollapsed(mod.id, grp.id);
              scheduleRender();
            });

            grpEl.appendChild(grpHeader);

            if (!grp.collapsed) {
              const grpBody = document.createElement('div');
              grpBody.className = 'attr-group-body';

              for (const row of grp.rows) {
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
      rowEl.dataset.attrId = row.id;

      const label = document.createElement('input');
      label.className = 'attr-row-label';
      label.value = row.label;
      label.addEventListener('change', () => {
        attributes.renameAttribute(row.id, label.value);
      });
      rowEl.appendChild(label);

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

      const valueWrap = document.createElement('div');
      valueWrap.className = 'attr-value-wrap';
      valueWrap.dataset.attrId = row.id;

      const valueInput = document.createElement('input');
      valueInput.className = 'attr-row-value';
      valueInput.value = row.value || '';
      valueInput.placeholder = boundCat ? 'выберите элемент…' : '—';
      valueInput.dataset.attrId = row.id;
      valueInput.autocomplete = 'off';
      valueInput.spellcheck = false;
      valueInput.disabled = !row.categoryId;

      // Фокус — открываем автокомплит
      valueInput.addEventListener('focus', () => {
        if (boundCat) {
          openAutocomplete(row.id, valueInput, valueWrap);
        }
      });

      // Ввод — фильтруем
      valueInput.addEventListener('input', () => {
        attributes.setAttributeValue(row.id, valueInput.value);
        updateStatusBadge(valueWrap, row.id);
        if (boundCat && activeAutocomplete && activeAutocomplete.attrId === row.id) {
          renderAutocompleteList(valueInput.value);
        }
      });

      valueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          valueInput.blur();
          closeAutocomplete();
        } else if (e.key === 'Escape') {
          closeAutocomplete();
          valueInput.blur();
        }
      });

      // Не закрываем автокомплит, если нажали на элемент списка
      valueInput.addEventListener('blur', () => {
        setTimeout(() => {
          if (activeAutocomplete && activeAutocomplete.attrId === row.id) {
            closeAutocomplete();
          }
        }, 150);
      });

      valueWrap.appendChild(valueInput);

      if (boundCat) {
        const quickBtn = document.createElement('button');
        quickBtn.className = 'attr-quick-pick';
        quickBtn.type = 'button';
        quickBtn.textContent = '▼';
        quickBtn.title = 'Показать все элементы';
        // Используем pointerdown, чтобы не терять фокус input
        quickBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          valueInput.focus();
          openAutocomplete(row.id, valueInput, valueWrap, true);
        });
        valueWrap.appendChild(quickBtn);
      }

      const preview = document.createElement('div');
      preview.className = 'attr-preview';
      valueWrap.appendChild(preview);

      const status = document.createElement('div');
      status.className = 'attr-status neutral';
      valueWrap.appendChild(status);

      rowEl.appendChild(valueWrap);
      updateStatusBadge(valueWrap, row.id);

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

    // Обновление статуса — ищем valueWrap по attrId в DOM
    function updateStatusBadge(valueWrap, attrId) {
      if (!valueWrap) {
        valueWrap = list.querySelector(`.attr-value-wrap[data-attr-id="${attrId}"]`);
      }
      if (!valueWrap) return;

      const preview = valueWrap.querySelector('.attr-preview');
      const status = valueWrap.querySelector('.attr-status');
      if (!preview || !status) return;

      preview.innerHTML = '';
      status.className = 'attr-status neutral';
      status.textContent = '';

      const rowData = attributes.getAttribute(attrId);
      if (!rowData) return;
      const row = rowData.row;

      const state = ctx.getState();
      const boundCat = row.categoryId
        ? state.categories.find(c => c.id === row.categoryId)
        : null;

      if (!boundCat) return;

      const value = (row.value || '').trim();
      if (!value) return;

      const item = attributes.findItemForValue(boundCat, value);
      if (item) {
        const exact = item.name.toLowerCase() === value.toLowerCase() ||
                      attributes.normalizeName(item.name) === attributes.normalizeName(value);
        if (exact) {
          status.className = 'attr-status ok';
          status.textContent = '✓';
        } else {
          status.className = 'attr-status partial';
          status.textContent = '~';
        }
        if (item.src) {
          const img = document.createElement('img');
          img.src = item.src;
          img.alt = item.name;
          img.loading = 'lazy';
          preview.appendChild(img);
        }
      } else {
        status.className = 'attr-status error';
        status.textContent = '⚠';
      }
    }

    // ============ Автокомплит ============
    function openAutocomplete(attrId, input, valueWrap, showAll) {
      // Если уже открыт для этого атрибута — только обновляем список
      if (activeAutocomplete && activeAutocomplete.attrId === attrId) {
        renderAutocompleteList(showAll ? '' : (input.value || ''));
        return;
      }

      closeAutocomplete();

      const rowData = attributes.getAttribute(attrId);
      if (!rowData || !rowData.row.categoryId) return;
      const cat = ctx.getState().categories.find(c => c.id === rowData.row.categoryId);
      if (!cat || cat.items.length === 0) return;

      const ac = document.createElement('div');
      ac.className = 'attr-autocomplete';
      ac.dataset.attrId = attrId;

      const rect = input.getBoundingClientRect();
      ac.style.left = rect.left + 'px';
      ac.style.top = (rect.bottom + 4) + 'px';
      ac.style.minWidth = Math.max(rect.width, 240) + 'px';
      ac.style.maxWidth = Math.min(window.innerWidth - 16, 400) + 'px';

      document.body.appendChild(ac);

      activeAutocomplete = { el: ac, attrId, input, cat, valueWrap };

      renderAutocompleteList(showAll ? '' : (input.value || ''));
    }

    function renderAutocompleteList(query) {
      if (!activeAutocomplete) return;
      const { el, cat, attrId, valueWrap } = activeAutocomplete;

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

        if (q) {
          const idx = item.name.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const before = item.name.slice(0, idx);
            const match = item.name.slice(idx, idx + q.length);
            const after = item.name.slice(idx + q.length);
            nameEl.append(before);
            const mark = document.createElement('mark');
            mark.textContent = match;
            nameEl.append(mark);
            nameEl.append(after);
          } else {
            nameEl.textContent = item.name;
          }
        } else {
          nameEl.textContent = item.name;
        }
        opt.appendChild(nameEl);

        // Используем pointerdown — срабатывает раньше blur
        const onPick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectAutocompleteItem(item, attrId, valueWrap);
        };
        opt.addEventListener('pointerdown', onPick);
        opt.addEventListener('touchstart', onPick, { passive: false });
        opt.addEventListener('click', onPick);

        el.appendChild(opt);
      }

      if (items.length > 50) {
        const more = document.createElement('div');
        more.className = 'attr-autocomplete-more';
        more.textContent = `…и ещё ${items.length - 50}`;
        el.appendChild(more);
      }
    }

    function selectAutocompleteItem(item, attrId, valueWrap) {
      const rowData = attributes.getAttribute(attrId);
      if (!rowData) return;

      rowData.row.value = item.name;
      attributes.setAttributeValue(attrId, item.name);

      // Обновляем input и статус
      const input = list.querySelector(`.attr-row-value[data-attr-id="${attrId}"]`);
      if (input) input.value = item.name;

      const wrap = valueWrap || list.querySelector(`.attr-value-wrap[data-attr-id="${attrId}"]`);
      updateStatusBadge(wrap, attrId);

      closeAutocomplete();
    }

    function closeAutocomplete() {
      if (activeAutocomplete) {
        activeAutocomplete.el.remove();
        activeAutocomplete = null;
      }
    }

    // Закрытие при клике вне — используем pointerdown
    document.addEventListener('pointerdown', (e) => {
      if (!activeAutocomplete) return;
      if (activeAutocomplete.el.contains(e.target)) return;
      if (e.target === activeAutocomplete.input) return;
      // Быстрый выбор ▼
      if (e.target.classList && e.target.classList.contains('attr-quick-pick')) return;
      // Внутри модалки атрибутов — не закрываем если это поле значения
      if (e.target.classList && e.target.classList.contains('attr-row-value')) return;
      closeAutocomplete();
    }, true);

    // Не закрываем при скролле внутри автокомплита
    window.addEventListener('scroll', (e) => {
      if (!activeAutocomplete) return;
      if (activeAutocomplete.el.contains(e.target)) return;
      closeAutocomplete();
    }, { passive: true, capture: true });

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