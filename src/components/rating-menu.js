/**
 * Activate the shared stepped-die rating menus within an application element.
 * The menu input retains Foundry's normal submit-on-change form behaviour.
 * @param {HTMLElement} root Application root element.
 */
export function activateRatingMenus(root) {
  const menus = [...root.querySelectorAll('.rating-menu')];

  const closeMenu = menu => {
    const optionsPanel = menu.querySelector('.rating-menu-options');
    if (typeof optionsPanel?.hidePopover === 'function' && optionsPanel.matches(':popover-open')) {
      optionsPanel.hidePopover();
    }
    menu.classList.remove('is-open');
    menu.querySelector('.rating-menu-trigger')?.setAttribute('aria-expanded', 'false');
    const scrollContainer = menu.closest('.tab');
    if (!scrollContainer?.querySelector('.rating-menu.is-open')) {
      scrollContainer?.classList.remove('rating-menu-scroll-locked');
    }
  };

  const openMenu = menu => {
    menus.forEach(candidate => closeMenu(candidate));
    menu.classList.add('is-open');
    const trigger = menu.querySelector('.rating-menu-trigger');
    const optionsPanel = menu.querySelector('.rating-menu-options');
    trigger?.setAttribute('aria-expanded', 'true');

    if (typeof optionsPanel?.showPopover !== 'function') {
      menu.closest('.tab')?.classList.add('rating-menu-scroll-locked');
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const screenGap = 4;
    const optionCount = optionsPanel.querySelectorAll('.rating-menu-option:not([hidden])').length;
    const groupCount = optionsPanel.querySelectorAll('.rating-menu-group-label').length;
    const desiredHeight = Math.min(196, optionCount * 28 + groupCount * 22 + 2);
    const spaceBelow = window.innerHeight - triggerRect.bottom - screenGap;
    const spaceAbove = triggerRect.top - screenGap;
    const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableHeight = openAbove ? spaceAbove : spaceBelow;
    const panelWidth = triggerRect.width;
    const panelLeft = Math.max(
      screenGap,
      Math.min(triggerRect.left, window.innerWidth - panelWidth - screenGap),
    );

    optionsPanel.style.width = `${panelWidth}px`;
    optionsPanel.style.left = `${panelLeft}px`;
    optionsPanel.style.maxHeight = `${Math.max(40, Math.min(196, availableHeight))}px`;
    optionsPanel.style.top = openAbove ? 'auto' : `${triggerRect.bottom + 1}px`;
    optionsPanel.style.bottom = openAbove ? `${window.innerHeight - triggerRect.top + 1}px` : 'auto';
    optionsPanel.showPopover();
  };

  for (const menu of menus) {
    const trigger = menu.querySelector('.rating-menu-trigger');
    const input = menu.querySelector('.rating-menu-input');
    const optionsPanel = menu.querySelector('.rating-menu-options');
    const options = [...menu.querySelectorAll('.rating-menu-option')];
    const isComboMenu = menu.classList.contains('combo-menu');
    if (typeof optionsPanel?.showPopover === 'function') optionsPanel.setAttribute('popover', 'manual');

    if (isComboMenu) {
      const showAllOptions = () => options.forEach(option => { option.hidden = false; });

      trigger?.addEventListener('focus', () => {
        if (trigger.dataset.suppressComboOpen) return;
        showAllOptions();
        openMenu(menu);
      });

      trigger?.addEventListener('click', () => {
        if (menu.classList.contains('is-open')) return;
        showAllOptions();
        openMenu(menu);
      });

      trigger?.addEventListener('input', () => {
        const query = input.value.trim().toLocaleLowerCase();
        let visibleOptions = 0;
        for (const option of options) {
          const isVisible = option.textContent.trim().toLocaleLowerCase().includes(query);
          const isSelected = option.dataset.value === input.value;
          option.hidden = !isVisible;
          option.classList.toggle('is-selected', isSelected);
          option.setAttribute('aria-selected', String(isSelected));
          if (isVisible) visibleOptions += 1;
        }
        if (visibleOptions && !menu.classList.contains('is-open')) openMenu(menu);
        if (!visibleOptions) closeMenu(menu);
      });
    }
    else {
      trigger?.addEventListener('click', event => {
        event.preventDefault();
        if (menu.classList.contains('is-open')) closeMenu(menu);
        else openMenu(menu);
      });
    }

    for (const option of options) {
      option.addEventListener('click', event => {
        event.preventDefault();
        const value = option.dataset.value;

        if (isComboMenu) trigger.value = value;
        else trigger.textContent = option.textContent.trim();
        input.value = value;
        options.forEach(candidate => {
          const isSelected = candidate === option;
          candidate.classList.toggle('is-selected', isSelected);
          candidate.setAttribute('aria-selected', String(isSelected));
        });
        closeMenu(menu);
        if (isComboMenu) trigger.dataset.suppressComboOpen = 'true';
        trigger.focus();
        delete trigger.dataset.suppressComboOpen;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    menu.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!menu.contains(document.activeElement)) closeMenu(menu);
      });
    });

    menu.addEventListener('keydown', event => {
      if (isComboMenu && event.key === 'Enter') {
        event.preventDefault();
        closeMenu(menu);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(menu);
      trigger?.focus();
    });
  }

  root.addEventListener('pointerdown', event => {
    if (menus.some(menu => menu.contains(event.target))) return;
    menus.forEach(menu => closeMenu(menu));
  });
}
