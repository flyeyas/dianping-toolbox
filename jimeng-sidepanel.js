const DEFAULT_PROMPT = `调整每个图片：
调整图片的拍照角度、拍摄距离，去掉图片中的小票，去掉图片中手，去掉图片中的人物元素，去掉图片中的水印，在图片上面加上吸引用户的涂鸦文案，文案中不要出现食物名字，文案中不要出现季节相关的描述，按着专业拍照的方式调整图片，调整比例3:4`;

const JIMENG_URL_PATTERN = /^https:\/\/jimeng\.jianying\.com\//;

const preview = document.getElementById("prompt-preview");
const status = document.getElementById("status");

init();

function init() {
  preview.value = DEFAULT_PROMPT;
  bindEvents();
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const action = event.target?.dataset?.action;
    if (!action) {
      return;
    }

    if (action === "sample") {
      preview.value = DEFAULT_PROMPT;
      setStatus("已恢复默认。");
      return;
    }

    if (action === "copy") {
      const copied = await copyText(getPrompt());
      setStatus(copied ? "提示词已复制。" : "复制失败，请手动复制提示词。");
      return;
    }

    if (action === "insert") {
      const prompt = getPrompt();
      const result = await insertPromptIntoActiveJimengTab(prompt);
      if (!result.ok) {
        const copied = await copyText(prompt);
        setStatus(copied ? `${result.error} 已复制提示词。` : result.error);
        return;
      }

      setStatus("已填入即梦输入框。");
    }
  });
}

function getPrompt() {
  return preview.value.trim() || DEFAULT_PROMPT;
}

async function insertPromptIntoActiveJimengTab(prompt) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "没有找到当前标签页。" };
  }

  if (!JIMENG_URL_PATTERN.test(tab.url || "")) {
    return { ok: false, error: "当前标签页不是即梦页面。" };
  }

  let result = await sendInsertMessage(tab.id, prompt);
  if (result.ok) {
    return result;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["jimeng-content.js"]
    });
  } catch (error) {
    return { ok: false, error: "无法注入即梦页面脚本。" };
  }

  result = await sendInsertMessage(tab.id, prompt);
  return result.ok ? result : { ok: false, error: result.error || "没有找到即梦输入框。" };
}

function sendInsertMessage(tabId, prompt) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "jimeng-insert-prompt", prompt },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: "无法连接即梦页面。" });
          return;
        }

        resolve(response?.ok ? { ok: true } : { ok: false, error: response?.error || "填入失败。" });
      }
    );
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }

    return copied;
  }
}

function setStatus(message) {
  status.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, 2800);
}
