/**
 * KoshBox — Shared UI Utilities
 * Toast notifications (bottom-left) + draggable floating windows.
 * No dependencies on other components.
 */

"use strict";

const UiUtils = (() => {

  // ── Toast ─────────────────────────────────────────────────────────────────
  let _stack = null;

  function _getStack() {
    if (_stack) return _stack;
    _stack = document.createElement("div");
    _stack.className = "toast-stack";
    document.body.appendChild(_stack);
    return _stack;
  }

  function toast(message, type = "info", duration = 2600) {
    const stack = _getStack();
    const el = document.createElement("div");
    el.className = `toast ${type === "info" ? "" : type}`.trim();
    const icon = type === "error" ? "✕" : type === "warn" ? "!" : "✓";
    el.innerHTML = `<span class="toast__icon">${icon}</span><span>${message}</span>`;
    stack.appendChild(el);

    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 180);
    }, duration);
  }

  // ── Dockable / Floatable Windows ─────────────────────────────────────────
  // Sections start docked in normal page flow (snapped in place, no overlap).
  // A small "Float" toggle in the header lets the user pop a section out
  // into a freely draggable window, and dock it back later.
  function makeDockable(el, { title } = {}) {
    if (!el || el.dataset.dockInit) return;
    el.dataset.dockInit = "1";

    const placeholder = document.createElement("div");
    placeholder.style.display = "none";

    const handle = document.createElement("div");
    handle.className = "dock-handle";
    handle.innerHTML = `
      <span class="dock-handle__title">${title || ""}</span>
      <button type="button" class="dock-handle__btn" title="Pop out into a floating window">⤢ Float</button>
    `;
    el.insertBefore(handle, el.firstChild);

    const floatBtn = handle.querySelector(".dock-handle__btn");
    let floating = false;
    let dragging = false, offX = 0, offY = 0;

    function dock() {
      floating = false;
      el.classList.remove("drag-window");
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.zIndex = "";
      floatBtn.textContent = "⤢ Float";
      handle.classList.remove("dock-handle--dragHandle");
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(el, placeholder);
      }
    }

    function float() {
      const rect = el.getBoundingClientRect();
      el.parentNode.replaceChild(placeholder, el);
      document.body.appendChild(el);
      el.classList.add("drag-window");
      el.style.position = "fixed";
      el.style.top  = rect.top + "px";
      el.style.left = rect.left + "px";
      el.style.width = rect.width + "px";
      floating = true;
      floatBtn.textContent = "⤓ Dock";
      handle.classList.add("dock-handle--dragHandle");
    }

    floatBtn.addEventListener("click", () => {
      floating ? dock() : float();
    });

    handle.addEventListener("mousedown", (e) => {
      if (!floating || e.target === floatBtn) return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      el.style.zIndex = 301;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const maxX = window.innerWidth  - 60;
      const maxY = window.innerHeight - 40;
      el.style.left = Math.min(Math.max(0, e.clientX - offX), maxX) + "px";
      el.style.top  = Math.min(Math.max(0, e.clientY - offY), maxY) + "px";
    });

    document.addEventListener("mouseup", () => { dragging = false; });

    return { dock, float };
  }

  return { toast, makeDockable };

})();

window.UiUtils = UiUtils;
