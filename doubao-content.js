(() => {
  const CONTENT_SCRIPT_VERSION = "2026-06-22-submit";

  if (window.__doubaoFoodNoteContentLoaded === CONTENT_SCRIPT_VERSION) {
    return;
  }

  window.__doubaoFoodNoteContentLoaded = CONTENT_SCRIPT_VERSION;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message?.type !== "doubao-food-note-insert-prompt" &&
      message?.type !== "doubao-food-note-insert-submit-prompt"
    ) {
      return false;
    }

    const prompt = typeof message.prompt === "string" ? message.prompt : "";
    if (!prompt.trim()) {
      sendResponse({ ok: false, error: "提示词为空。" });
      return false;
    }

    const result = insertIntoDoubao(prompt);
    if (!result.ok || message.type !== "doubao-food-note-insert-submit-prompt") {
      sendResponse(result);
      return false;
    }

    submitDoubaoPrompt().then(sendResponse);
    return true;
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

  async function submitDoubaoPrompt() {
    const sendButton = await waitForDoubaoSendButton();
    if (!sendButton) {
      return { ok: false, error: "已填入提示词，但没有找到豆包发送按钮。" };
    }

    clickElement(sendButton);
    return { ok: true };
  }

  function waitForDoubaoSendButton(timeout = 2500) {
    const start = Date.now();

    return new Promise((resolve) => {
      const tick = () => {
        const sendButton = findDoubaoSendButton();
        if (sendButton) {
          resolve(sendButton);
          return;
        }

        if (Date.now() - start >= timeout) {
          resolve(null);
          return;
        }

        window.setTimeout(tick, 120);
      };

      tick();
    });
  }

  function findDoubaoSendButton() {
    const input = findDoubaoInput();
    const scopedButtons = input ? findButtonsNearInput(input) : [];
    const allButtons = [
      ...scopedButtons,
      ...document.querySelectorAll("button, [role='button'], [aria-label], [title]")
    ];

    return [...new Set(allButtons)]
      .filter(isVisibleButton)
      .filter(hasSendIntent)
      .sort((a, b) => {
        const scoreDiff = getSendButtonScore(b, input) - getSendButtonScore(a, input);
        if (scoreDiff) {
          return scoreDiff;
        }

        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectB.bottom - rectA.bottom || rectB.right - rectA.right;
      })[0] || null;
  }

  function findButtonsNearInput(input) {
    const containers = [];
    let current = input;

    for (let depth = 0; current && depth < 6; depth += 1) {
      containers.push(current);
      current = current.parentElement;
    }

    return containers.flatMap((container) => [
      ...container.querySelectorAll("button, [role='button'], [aria-label], [title]")
    ]);
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

  function isVisibleButton(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const disabled = element.matches("[disabled], [aria-disabled='true']");

    return (
      !disabled &&
      rect.width >= 20 &&
      rect.height >= 20 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.pointerEvents !== "none"
    );
  }

  function clickElement(element) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY
    };

    element.dispatchEvent(new PointerEvent("pointerdown", eventInit));
    element.dispatchEvent(new MouseEvent("mousedown", eventInit));
    element.dispatchEvent(new PointerEvent("pointerup", eventInit));
    element.dispatchEvent(new MouseEvent("mouseup", eventInit));
    element.dispatchEvent(new MouseEvent("click", eventInit));
  }

  function hasSendIntent(element) {
    const label = getElementText(element);
    const className = typeof element.className === "string" ? element.className : "";

    if (hasBlockedButtonIntent(label)) {
      return false;
    }

    return (
      /发送|提交|send|submit|arrow|plane|paper/i.test(label) ||
      /send|submit|arrow|plane/i.test(className) ||
      isLikelyIconSendButton(element)
    );
  }

  function getSendButtonScore(element, input) {
    const label = getElementText(element);
    const className = typeof element.className === "string" ? element.className : "";
    let score = 0;

    if (/发送|send/i.test(label)) {
      score += 8;
    }

    if (/提交|submit/i.test(label)) {
      score += 5;
    }

    if (/send|submit|arrow|plane/i.test(className)) {
      score += 3;
    }

    if (element.tagName === "BUTTON") {
      score += 2;
    }

    if (input && isNearInput(element, input)) {
      score += 6;
    }

    return score;
  }

  function hasBlockedButtonIntent(label) {
    return /上传|附件|文件|图片|语音|麦克风|录音|停止|新建|添加|upload|attach|file|image|voice|mic|audio|stop|add/i.test(label);
  }

  function isLikelyIconSendButton(element) {
    const rect = element.getBoundingClientRect();

    return (
      !!element.querySelector("svg, img") &&
      rect.width <= 72 &&
      rect.height <= 72 &&
      rect.width >= 20 &&
      rect.height >= 20
    );
  }

  function getElementText(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.getAttribute("class"),
      element.textContent
    ].filter(Boolean).join(" ");
  }

  function isNearInput(element, input) {
    const elementRect = element.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const verticalDistance = Math.abs(elementRect.top + elementRect.height / 2 - (inputRect.top + inputRect.height / 2));
    const horizontalDistance = Math.abs(elementRect.left + elementRect.width / 2 - (inputRect.left + inputRect.width / 2));

    return verticalDistance <= Math.max(160, inputRect.height * 2) && horizontalDistance <= Math.max(360, inputRect.width);
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
