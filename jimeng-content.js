(() => {
  if (window.__jimengToolboxContentLoaded) {
    return;
  }

  window.__jimengToolboxContentLoaded = true;

  const EXTENSION_BUTTON_ID = "jimeng-image-download-button";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "jimeng-apply-settings") {
    applyJimengSettings()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error?.message || "设置失败。" });
      });
    return true;
  }

  if (message?.type === "jimeng-insert-prompt") {
    const prompt = typeof message.prompt === "string" ? message.prompt : "";
    if (!prompt.trim()) {
      sendResponse({ ok: false, error: "提示词为空。" });
      return false;
    }

    sendResponse(insertIntoJimeng(prompt));
    return false;
  }

  return false;
});

function insertIntoJimeng(text) {
  const target = findJimengInput();
  if (!target) {
    return { ok: false, error: "没有找到即梦输入框。" };
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

  return { ok: false, error: "即梦输入框类型不支持自动填入。" };
}

function findJimengInput() {
  const candidates = [
    ...document.querySelectorAll("textarea"),
    ...document.querySelectorAll("input[type='text']"),
    ...document.querySelectorAll("[contenteditable='true']"),
    ...document.querySelectorAll("[role='textbox']")
  ];

  return candidates
    .filter(isVisibleTextInput)
    .sort((a, b) => scoreTextInput(b) - scoreTextInput(a))[0] || null;
}

function isVisibleTextInput(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width >= 120 &&
    rect.height >= 20 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}

function scoreTextInput(element) {
  const rect = element.getBoundingClientRect();
  const areaScore = Math.min(rect.width * rect.height / 1000, 500);
  const bottomScore = rect.top > window.innerHeight * 0.35 ? 120 : 0;
  const centerScore = rect.left < window.innerWidth * 0.85 && rect.right > window.innerWidth * 0.15 ? 80 : 0;
  const textareaScore = element instanceof HTMLTextAreaElement ? 100 : 0;
  return areaScore + bottomScore + centerScore + textareaScore;
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

async function applyJimengSettings() {
  const results = [];

  results.push(await ensureAgentMode());

  results.push(await openGenerationPreferencePanel());

  results.push(await turnOffAutoPreference());

  results.push(await selectImageGenerationMode());

  results.push(await selectAspectRatio34());

  results.push(await selectImageModel47());

  const failedNames = results
    .filter((result) => !result.ok)
    .map((result) => result.name);

  if (failedNames.length) {
    return { ok: false, error: `部分设置未完成：${failedNames.join("、")}。` };
  }

  return { ok: true };
}

async function ensureAgentMode() {
  if (findClickableByText([
    "Agent模式",
    "Agent 模式"
  ])) {
    return { ok: true, name: "Agent模式" };
  }

  return selectSetting("Agent模式", [
    "Agent模式",
    "Agent 模式",
    "智能体",
    "Agent"
  ], [
    "模式"
  ]);
}

async function selectImageGenerationMode() {
  const panel = findGenerationPreferencePanel();
  if (!panel) {
    return { ok: false, name: "生成图片模式" };
  }

  const imageModeButton = findImageModeButton(panel);
  if (!imageModeButton) {
    return selectSetting("生成图片模式", [
      "生成图片",
      "图片生成",
      "生成图片模式",
      "图片模式",
      "图片"
    ]);
  }

  clickElement(imageModeButton);
  await delay(220);
  return { ok: true, name: "生成图片模式" };
}

async function selectAspectRatio34() {
  const panel = findGenerationPreferencePanel();
  if (!panel) {
    return { ok: false, name: "比例3:4" };
  }

  const ratioButton = findRatioButton(panel, ["3:4", "3 : 4", "3：4"]);
  if (!ratioButton) {
    return selectSetting("比例3:4", [
      "3:4",
      "3 : 4",
      "3：4"
    ], [
      "比例",
      "画幅",
      "尺寸"
    ]);
  }

  clickElement(ratioButton);
  await delay(220);
  return { ok: true, name: "比例3:4" };
}

async function selectImageModel47() {
  const panel = findGenerationPreferencePanel();
  if (!panel) {
    return { ok: false, name: "图片模型4.7" };
  }

  const currentModel = findModelDropdown(panel);
  if (currentModel) {
    clickElement(currentModel);
    await delay(320);
  }

  if (await clickVisibleText([
    "图片4.7",
    "图片 4.7",
    "图像4.7",
    "图像 4.7",
    "Image 4.7"
  ])) {
    await delay(220);
    return { ok: true, name: "图片模型4.7" };
  }

  return selectSetting("图片模型4.7", [
    "图片4.7",
    "图片 4.7",
    "图像4.7",
    "图像 4.7",
    "Image 4.7"
  ], [
    "图片模型",
    "模型",
    "Model",
    "图片4.0",
    "图片 4.0",
    "图像4.0",
    "图像 4.0",
    "4.0"
  ]);
}

async function selectSetting(name, optionTexts, triggerTexts = []) {
  const panel = findGenerationPreferencePanel() || document;

  if (await clickVisibleText(optionTexts, panel)) {
    await delay(220);
    return { ok: true, name };
  }

  for (const triggerText of triggerTexts) {
    if (!await clickVisibleText([triggerText], panel)) {
      continue;
    }

    await delay(260);
    if (await clickVisibleText(optionTexts, panel)) {
      await delay(220);
      return { ok: true, name };
    }

    if (await clickVisibleText(optionTexts)) {
      await delay(220);
      return { ok: true, name };
    }
  }

  return { ok: false, name };
}

async function openGenerationPreferencePanel() {
  if (findGenerationPreferencePanel()) {
    return { ok: true, name: "打开生成偏好" };
  }

  if (!await clickVisibleText(["自动"])) {
    return { ok: false, name: "打开生成偏好" };
  }

  await delay(320);
  return { ok: Boolean(findGenerationPreferencePanel()), name: "打开生成偏好" };
}

async function turnOffAutoPreference() {
  const panel = findGenerationPreferencePanel();
  if (!panel) {
    return { ok: false, name: "关闭自动" };
  }

  const autoControl = findAutoSwitch(panel);

  if (!autoControl) {
    return { ok: false, name: "关闭自动" };
  }

  const state = getControlState(autoControl);
  if (state === false) {
    return { ok: true, name: "关闭自动" };
  }

  clickElement(autoControl);
  await delay(260);

  const nextControl = findAutoSwitch(panel) || autoControl;
  const nextState = getControlState(nextControl);
  if (nextState === true) {
    clickElement(nextControl);
    await delay(260);
  }

  const finalControl = findAutoSwitch(panel) || nextControl;
  const finalState = getControlState(finalControl);
  return { ok: finalState !== true, name: "关闭自动" };
}

async function clickVisibleText(texts, root = document) {
  const target = findClickableByText(texts, root);
  if (!target) {
    return false;
  }

  clickElement(target);
  return true;
}

function findGenerationPreferencePanel() {
  const heading = findTextElement(["生成偏好"]);
  if (!heading) {
    return null;
  }

  let node = heading;
  while (node && node !== document.body) {
    const rect = node.getBoundingClientRect();
    const text = normalizeText(getElementLabel(node));
    if (
      rect.width >= 360 &&
      rect.height >= 260 &&
      text.includes(normalizeText("选择比例")) &&
      text.includes(normalizeText("其他设置"))
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return heading.parentElement || document.body;
}

function findAutoSwitch(panel) {
  const panelRect = panel.getBoundingClientRect();
  const switchCandidates = Array.from(panel.querySelectorAll([
    "[role='switch']",
    "[aria-checked]",
    "[aria-pressed]",
    "button",
    "input[type='checkbox']",
    "div",
    "span"
  ].join(",")))
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = normalizeText(getElementLabel(element));
      return (
        (
          label.includes(normalizeText("自动")) &&
          rect.top <= panelRect.top + 120
        ) ||
        (
          rect.top <= panelRect.top + 100 &&
          rect.left >= panelRect.right - 180 &&
          rect.width >= 28 &&
          rect.width <= 100 &&
          rect.height >= 14 &&
          rect.height <= 60
        )
      );
    });

  if (switchCandidates.length) {
    return switchCandidates
      .sort((left, right) => scoreAutoSwitch(right, panelRect) - scoreAutoSwitch(left, panelRect))[0];
  }

  const autoLabel = findTextElement(["自动"], panel);
  if (!autoLabel) {
    return null;
  }

  const labelRect = autoLabel.getBoundingClientRect();
  const nearby = Array.from(panel.querySelectorAll("button,[role='switch'],[aria-checked],[aria-pressed],input[type='checkbox'],div,span"))
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        Math.abs(rect.top - labelRect.top) <= 45 &&
        rect.left > labelRect.right &&
        rect.width >= 24 &&
        rect.width <= 110 &&
        rect.height >= 14 &&
        rect.height <= 60
      );
    });

  return nearby[0] || getClickableTarget(autoLabel);
}

function findImageModeButton(panel) {
  const panelRect = panel.getBoundingClientRect();
  const candidates = Array.from(panel.querySelectorAll([
    "button",
    "[role='button']",
    "[role='tab']",
    "span",
    "div"
  ].join(",")))
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = normalizeText(getElementLabel(element));
      return (
        ["图片", "生成图片", "图片模式"].includes(label) &&
        rect.top >= panelRect.top &&
        rect.top <= panelRect.top + 190 &&
        rect.width >= 36 &&
        rect.width <= panelRect.width * 0.7
      );
    })
    .map(getClickableTarget)
    .filter(Boolean)
    .filter(isVisible);

  return [...new Set(candidates)]
    .sort((left, right) => scoreImageModeButton(right, panelRect) - scoreImageModeButton(left, panelRect))[0] || null;
}

function findRatioButton(panel, labels) {
  const panelRect = panel.getBoundingClientRect();
  const normalizedLabels = labels.map(normalizeText);
  const ratioLabel = findTextElement(["选择比例"], panel);
  const ratioTop = ratioLabel?.getBoundingClientRect().bottom || panelRect.top + 180;

  const candidates = Array.from(panel.querySelectorAll("button,[role='button'],[role='option'],span,div"))
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = normalizeText(getElementLabel(element));
      return (
        normalizedLabels.some((text) => label === text || label.includes(text)) &&
        rect.top >= ratioTop &&
        rect.top <= ratioTop + 140 &&
        rect.left >= panelRect.left &&
        rect.right <= panelRect.right
      );
    })
    .map(getClickableTarget)
    .filter(Boolean)
    .filter(isVisible);

  return [...new Set(candidates)]
    .sort((left, right) => scoreRatioButton(right, ratioTop) - scoreRatioButton(left, ratioTop))[0] || null;
}

function scoreRatioButton(element, ratioTop) {
  const rect = element.getBoundingClientRect();
  const compactScore = rect.width <= 120 && rect.height <= 120 ? 120 : 0;
  return compactScore - Math.abs(rect.top - ratioTop);
}

function findModelDropdown(panel) {
  const panelRect = panel.getBoundingClientRect();
  const settingsLabel = findTextElement(["其他设置"], panel);
  const settingsTop = settingsLabel?.getBoundingClientRect().bottom || panelRect.bottom - 150;

  const candidates = Array.from(panel.querySelectorAll("button,[role='button'],span,div"))
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = normalizeText(getElementLabel(element));
      return (
        (
          label.includes(normalizeText("图片4.0")) ||
          label.includes(normalizeText("图片 4.0")) ||
          label.includes(normalizeText("图片4.7")) ||
          label.includes(normalizeText("图片 4.7")) ||
          label.includes(normalizeText("图像4.0")) ||
          label.includes(normalizeText("图像4.7"))
        ) &&
        rect.top >= settingsTop &&
        rect.top <= panelRect.bottom &&
        rect.left >= panelRect.left &&
        rect.left <= panelRect.left + panelRect.width * 0.58
      );
    })
    .map(getClickableTarget)
    .filter(Boolean)
    .filter(isVisible);

  return [...new Set(candidates)]
    .sort((left, right) => scoreModelDropdown(right, settingsTop, panelRect) - scoreModelDropdown(left, settingsTop, panelRect))[0] || null;
}

function scoreModelDropdown(element, settingsTop, panelRect) {
  const rect = element.getBoundingClientRect();
  const leftScore = rect.left <= panelRect.left + panelRect.width * 0.58 ? 120 : 0;
  const compactScore = rect.width <= panelRect.width * 0.55 && rect.height <= 90 ? 80 : 0;
  return leftScore + compactScore - Math.abs(rect.top - settingsTop);
}

function scoreImageModeButton(element, panelRect) {
  const rect = element.getBoundingClientRect();
  const label = normalizeText(getElementLabel(element));
  const exactScore = label === "图片" ? 160 : 80;
  const topScore = rect.top <= panelRect.top + 160 ? 80 : 0;
  const compactScore = rect.width <= 520 && rect.height <= 120 ? 40 : 0;
  return exactScore + topScore + compactScore - Math.abs(rect.left - panelRect.left);
}

function scoreAutoSwitch(element, panelRect) {
  const rect = element.getBoundingClientRect();
  const topRightScore = (
    rect.top <= panelRect.top + 100 &&
    rect.left >= panelRect.right - 180
  ) ? 200 : 0;
  const stateScore = element.matches("[role='switch'],[aria-checked],input[type='checkbox']") ? 120 : 0;
  return topRightScore + stateScore - Math.abs(rect.top - panelRect.top);
}

function findTextElement(texts, root = document) {
  const normalizedTexts = texts.map(normalizeText).filter(Boolean);
  const candidates = Array.from(root.querySelectorAll("h1,h2,h3,h4,span,div,p,button,label"));
  return candidates
    .filter(isVisible)
    .find((element) => {
      const label = normalizeText(getElementLabel(element));
      return normalizedTexts.some((text) => label.includes(text));
    }) || null;
}

function findClickableByText(texts, root = document) {
  const normalizedTexts = texts.map(normalizeText).filter(Boolean);
  if (!normalizedTexts.length) {
    return null;
  }

  const candidates = Array.from(root.querySelectorAll([
    "button",
    "[role='button']",
    "[role='option']",
    "[role='menuitem']",
    "[role='tab']",
    "label",
    "input",
    "textarea",
    "[aria-label]",
    "[title]",
    "span",
    "div"
  ].join(",")));

  const matches = candidates
    .filter(isVisible)
    .map((element) => ({
      element,
      label: normalizeText(getElementLabel(element))
    }))
    .filter(({ label }) => normalizedTexts.some((text) => label.includes(text)))
    .map(({ element }) => getClickableTarget(element))
    .filter(Boolean)
    .filter(isVisible);

  return [...new Set(matches)]
    .sort((left, right) => scoreClickable(right) - scoreClickable(left))[0] || null;
}

function getElementLabel(element) {
  return [
    element.innerText,
    element.textContent,
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.getAttribute?.("placeholder"),
    element.value
  ].filter(Boolean).join(" ");
}

function getClickableTarget(element) {
  const explicitTarget = element.closest?.([
    "button",
    "[role='button']",
    "[role='option']",
    "[role='menuitem']",
    "[role='tab']",
    "label"
  ].join(","));

  if (explicitTarget) {
    return explicitTarget;
  }

  return findCompactClickableAncestor(element) || element;
}

function findCompactClickableAncestor(element) {
  let node = element;
  while (node && node !== document.body) {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const tabIndex = Number(node.getAttribute?.("tabindex"));
    const className = typeof node.className === "string" ? node.className : "";
    const looksClickable = (
      style.cursor === "pointer" ||
      !Number.isNaN(tabIndex) ||
      /\b(btn|button|option|select|item|card|radio|ratio|model|tab)\b/i.test(className)
    );

    if (
      looksClickable &&
      rect.width >= 24 &&
      rect.width <= 620 &&
      rect.height >= 20 &&
      rect.height <= 150
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

function scoreClickable(element) {
  const rect = element.getBoundingClientRect();
  const roleScore = element.matches("button,[role='button'],[role='option'],[role='menuitem'],[role='tab']") ? 100 : 0;
  const compactScore = rect.width <= 360 && rect.height <= 120 ? 40 : 0;
  const areaPenalty = Math.min(rect.width * rect.height / 5000, 80);
  return roleScore + compactScore - areaPenalty;
}

function getControlState(element) {
  const stateElement = element.closest?.("[aria-checked],[aria-pressed],[aria-selected]") || element;
  const checkedValue = stateElement.getAttribute?.("aria-checked");
  const pressedValue = stateElement.getAttribute?.("aria-pressed");
  const selectedValue = stateElement.getAttribute?.("aria-selected");

  if (checkedValue === "true" || pressedValue === "true" || selectedValue === "true") {
    return true;
  }

  if (checkedValue === "false" || pressedValue === "false" || selectedValue === "false") {
    return false;
  }

  if ("checked" in element && typeof element.checked === "boolean") {
    return element.checked;
  }

  const visualState = getVisualSwitchState(stateElement);
  if (visualState !== null) {
    return visualState;
  }

  const className = typeof stateElement.className === "string" ? stateElement.className : "";
  if (/\b(active|checked|selected|is-active|is-checked|is-selected)\b/i.test(className)) {
    return true;
  }

  return null;
}

function getVisualSwitchState(element) {
  const elements = [
    element,
    ...Array.from(element.querySelectorAll?.("*") || [])
  ].filter(isVisible);

  for (const item of elements) {
    const rect = item.getBoundingClientRect();
    if (rect.width < 28 || rect.width > 90 || rect.height < 14 || rect.height > 50) {
      continue;
    }

    const color = parseRgbColor(window.getComputedStyle(item).backgroundColor);
    if (!color) {
      continue;
    }

    const { r, g, b, a } = color;
    if (a === 0) {
      continue;
    }

    if (g >= 150 && b >= 150 && r <= 80) {
      return true;
    }

    if (Math.abs(r - g) <= 18 && Math.abs(g - b) <= 18 && r >= 180) {
      return false;
    }
  }

  return null;
}

function parseRgbColor(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4])
  };
}

function clickElement(element) {
  element.scrollIntoView?.({ block: "center", inline: "center" });
  if (typeof PointerEvent !== "undefined") {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
  }
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  if (typeof element.click === "function") {
    element.click();
  } else {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, "").trim().toLowerCase();
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function findNativeDownloadButton() {
  const buttons = Array.from(document.querySelectorAll('button[type="button"]'));

  const candidates = buttons.filter((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }

    if (!isVisible(button)) {
      return false;
    }

    if (button.id === EXTENSION_BUTTON_ID) {
      return false;
    }

    const label = getButtonLabel(button);
    return label === "下载";
  });

  candidates.sort((left, right) => scoreDownloadButton(right) - scoreDownloadButton(left));
  return candidates[0] || null;
}

function getButtonLabel(button) {
  const label = button.innerText || button.textContent || "";
  return label.replace(/\s+/g, " ").trim();
}

function scoreDownloadButton(button) {
  const rect = button.getBoundingClientRect();
  const widthScore = rect.width >= 80 ? 4 : 0;
  const topHalfScore = rect.top < window.innerHeight * 0.35 ? 3 : 0;
  const rightSideScore = rect.left > window.innerWidth * 0.55 ? 3 : 0;
  const iconScore = button.querySelector("svg") ? 2 : 0;
  return widthScore + topHalfScore + rightSideScore + iconScore;
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}

function findPublishContainer() {
  const nativeDownloadButton = findNativeDownloadButton();
  if (!nativeDownloadButton) {
    return null;
  }

  return nativeDownloadButton.parentElement;
}

function findImageUrls() {
  const images = Array.from(document.images);
  const candidates = images
    .filter((image) => {
      if (!(image instanceof HTMLImageElement)) {
        return false;
      }

      if (!isVisible(image)) {
        return false;
      }

      const src = image.currentSrc || image.src || "";
      if (!src || src.startsWith("data:")) {
        return false;
      }

      const rect = image.getBoundingClientRect();
      return rect.width >= 240 && rect.height >= 240;
    })
    .map((image) => {
      const rect = image.getBoundingClientRect();
      const area = rect.width * rect.height;
      const centeredScore =
        rect.left < window.innerWidth * 0.7 && rect.right > window.innerWidth * 0.1 ? 1 : 0;

      return {
        area: area + centeredScore,
        url: image.currentSrc || image.src
      };
    })
    .sort((left, right) => right.area - left.area);

  return [...new Set(candidates.map((item) => item.url))];
}

function createDownloadButton() {
  const button = document.createElement("button");
  button.id = EXTENSION_BUTTON_ID;
  button.type = "button";
  button.className = "lv-btn lv-btn-size-default lv-btn-shape-square";
  button.setAttribute("aria-label", "下载图片");
  button.style.cssText = [
    "margin-left: 8px",
    "display: inline-flex",
    "align-items: center",
    "gap: 6px",
    "height: 36px",
    "padding: 0 14px",
    "border: 1px solid #1677ff !important",
    "border-radius: 10px",
    "background: #1677ff !important",
    "background-color: #1677ff !important",
    "background-image: none !important",
    "color: #ffffff !important",
    "box-shadow: 0 2px 6px rgba(22, 119, 255, 0.22) !important",
    "cursor: pointer",
    "box-sizing: border-box",
    "transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, opacity 140ms ease",
    "transform: translateY(0)"
  ].join(";");
  button.innerHTML = `
    <div class="dianping-toolbox-download-icon">
      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="">
        <g>
          <path data-follow-fill="currentColor" d="M12 2a1 1 0 0 1 1 1v10.312l4.023-4.021a1 1 0 0 1 1.414 1.414l-5.73 5.728a1 1 0 0 1-1.414 0l-5.73-5.728A1 1 0 1 1 6.977 9.29L11 13.312V3a1 1 0 0 1 1-1ZM3 20.002a1 1 0 0 1 1-1L20 19a1 1 0 0 1 0 2l-16 .002a1 1 0 0 1-1-1Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
        </g>
      </svg>
    </div>
    <span>下载图片</span>
  `;

  button.addEventListener("mouseenter", () => {
    if (button.disabled) {
      return;
    }
    applyButtonVisual(button, {
      background: "#3b8cff",
      borderColor: "#3b8cff",
      color: "#ffffff",
      boxShadow: "0 6px 16px rgba(22, 119, 255, 0.28)",
      transform: "translateY(-1px)"
    });
  });

  button.addEventListener("focus", () => {
    if (button.disabled) {
      return;
    }
    applyButtonVisual(button, {
      background: "#3b8cff",
      borderColor: "#3b8cff",
      color: "#ffffff",
      boxShadow: "0 6px 16px rgba(22, 119, 255, 0.28)",
      transform: "translateY(-1px)"
    });
  });

  button.addEventListener("blur", () => {
    if (button.disabled) {
      return;
    }
    restoreButtonVisual(button);
  });

  button.addEventListener("mouseleave", () => {
    if (button.disabled) {
      button.style.transform = "translateY(0)";
      return;
    }
    restoreButtonVisual(button);
  });

  button.addEventListener("mousedown", () => {
    if (button.disabled) {
      return;
    }
    applyButtonVisual(button, {
      background: "#0f5fd7",
      borderColor: "#0f5fd7",
      color: "#ffffff",
      boxShadow: "0 2px 8px rgba(15, 95, 215, 0.24)",
      transform: "translateY(0)"
    });
  });

  button.addEventListener("mouseup", () => {
    if (button.disabled) {
      return;
    }
    applyButtonVisual(button, {
      background: "#3b8cff",
      borderColor: "#3b8cff",
      color: "#ffffff",
      boxShadow: "0 6px 16px rgba(22, 119, 255, 0.28)",
      transform: "translateY(-1px)"
    });
  });

  button.addEventListener("click", async () => {
    const urls = findImageUrls();

    if (!urls.length) {
      setButtonStatus(button, "未找到图片");
      resetButtonLabel(button);
      return;
    }

    button.disabled = true;
    button.style.opacity = "0.88";
    button.style.cursor = "default";
    setButtonStatus(button, "下载中...");

    try {
      const targetUrl = urls[0];
      const pageTitle = document.title || "jimeng-image";
      const response = await chrome.runtime.sendMessage({
        type: "download-single-image",
        url: targetUrl,
        pageTitle
      });

      if (!response?.ok) {
        throw new Error(response?.error || "下载失败");
      }

      setButtonStatus(button, "已开始下载");
    } catch (error) {
      const message = error?.name === "AbortError" ? "已取消" : `失败: ${error.message}`;
      setButtonStatus(button, message);
    } finally {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
      restoreButtonVisual(button);
      resetButtonLabel(button);
    }
  });

  return button;
}

function resetButtonLabel(button) {
  window.setTimeout(() => {
    setButtonText(button, "下载图片");
    clearButtonStatus(button);
  }, 2000);
}

function setButtonText(button, text) {
  const textNode = button.querySelector("span");
  if (textNode) {
    textNode.textContent = text;
  } else {
    button.textContent = text;
  }
}

function setButtonStatus(button, message) {
  setButtonText(button, "下载图片");
  button.title = message;
}

function clearButtonStatus(button) {
  button.removeAttribute("title");
}

function restoreButtonVisual(button) {
  applyButtonVisual(button, {
    background: "#1677ff",
    borderColor: "#1677ff",
    color: "#ffffff",
    boxShadow: "0 2px 6px rgba(22, 119, 255, 0.22)",
    transform: "translateY(0)"
  });
}

function applyButtonVisual(button, visual) {
  if (visual.background) {
    button.style.setProperty("background", visual.background, "important");
    button.style.setProperty("background-color", visual.background, "important");
    button.style.setProperty("background-image", "none", "important");
  }

  if (visual.borderColor) {
    button.style.setProperty("border-color", visual.borderColor, "important");
  }

  if (visual.color) {
    button.style.setProperty("color", visual.color, "important");
  }

  if (visual.boxShadow) {
    button.style.setProperty("box-shadow", visual.boxShadow, "important");
  }

  if (visual.transform) {
    button.style.transform = visual.transform;
  }
}

function mountButton() {
  const nativeDownloadButton = findNativeDownloadButton();
  const container = nativeDownloadButton?.parentElement;
  if (!nativeDownloadButton || !container || container.querySelector(`#${EXTENSION_BUTTON_ID}`)) {
    return;
  }

  container.style.display = "flex";
  container.style.flexDirection = "row";
  container.style.alignItems = "center";
  container.style.gap = "8px";
  container.style.flexWrap = "nowrap";

  nativeDownloadButton.insertAdjacentElement("beforebegin", createDownloadButton());
}

const observer = new MutationObserver(() => {
  mountButton();
});

mountButton();
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
})();
