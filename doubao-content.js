(() => {
  if (window.__doubaoFoodNoteContentLoaded) {
    return;
  }

  window.__doubaoFoodNoteContentLoaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "doubao-food-note-insert-prompt") {
      return false;
    }

    const prompt = typeof message.prompt === "string" ? message.prompt : "";
    if (!prompt.trim()) {
      sendResponse({ ok: false, error: "提示词为空。" });
      return false;
    }

    sendResponse(insertIntoDoubao(prompt));
    return false;
  });

  function insertIntoDoubao(text) {
    const target = findDoubaoInput();
    if (!target) {
      return { ok: false, error: "没有找到豆包输入框。" };
    }

    target.focus();

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      setNativeValue(target, text);
      target.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.setSelectionRange(target.value.length, target.value.length);
      return { ok: true };
    }

    if (target.isContentEditable || target.getAttribute("role") === "textbox") {
      const selection = window.getSelection();
      const range = document.createRange();
      target.textContent = "";
      range.selectNodeContents(target);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, text);
      target.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      }));
      return { ok: true };
    }

    return { ok: false, error: "豆包输入框类型不支持自动填入。" };
  }

  function findDoubaoInput() {
    const candidates = [
      ...document.querySelectorAll("textarea"),
      ...document.querySelectorAll("input[type='text']"),
      ...document.querySelectorAll("[contenteditable='true']"),
      ...document.querySelectorAll("[role='textbox']")
    ];

    return candidates
      .filter(isVisibleInput)
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectB.bottom - rectA.bottom || rectB.width * rectB.height - rectA.width * rectA.height;
      })[0] || null;
  }

  function isVisibleInput(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width >= 80 &&
      rect.height >= 20 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
      return;
    }

    element.value = value;
  }
})();
