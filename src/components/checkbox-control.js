/**
 * Activate system-owned checkbox controls without relying on Foundry's native
 * checkbox rendering.
 * @param {HTMLElement} root Application root element.
 * @param {(path: string, value: boolean) => Promise<unknown>} onChange Persist a changed value.
 */
export function activateCheckboxControls(root, onChange) {
  for (const control of root.querySelectorAll('.checkbox-control')) {
    const button = control.querySelector('.checkbox-control-toggle');
    if (!button || button.disabled) continue;
    button.checked = button.classList.contains('is-checked');

    button.addEventListener('click', event => {
      event.preventDefault();
      const isChecked = button.classList.toggle('is-checked');
      button.checked = isChecked;
      button.setAttribute('aria-checked', String(isChecked));
      if (control.dataset.path) onChange(control.dataset.path, isChecked);
      button.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { checked: isChecked } }));
    });
  }
}
