const DEFAULT_RESTAURANT = "太湖小馆.经典淮扬菜(望京西园三区店)";
const DEFAULT_DISHES = "精品神仙鸡、淮扬全家福、清汤蟹粉狮子头";
const DOUBAO_URL_PATTERN = /^https:\/\/(?:www\.)?doubao\.com\//;

const restaurantInput = document.getElementById("restaurant");
const dishesInput = document.getElementById("dishes");
const preview = document.getElementById("prompt-preview");
const status = document.getElementById("status");

init();

function init() {
  restaurantInput.value = DEFAULT_RESTAURANT;
  dishesInput.value = DEFAULT_DISHES;
  updatePreview();
  bindEvents();
}

function bindEvents() {
  restaurantInput.addEventListener("input", updatePreview);
  dishesInput.addEventListener("input", updatePreview);

  document.addEventListener("click", async (event) => {
    const action = event.target?.dataset?.action;
    if (!action) {
      return;
    }

    if (action === "sample") {
      restaurantInput.value = DEFAULT_RESTAURANT;
      dishesInput.value = DEFAULT_DISHES;
      updatePreview();
      setStatus("已恢复示例。");
      return;
    }

    if (action === "clear") {
      restaurantInput.value = "";
      dishesInput.value = "";
      updatePreview();
      restaurantInput.focus();
      setStatus("已清空。");
      return;
    }

    if (action === "copy") {
      const prompt = updatePreview();
      const copied = await copyText(prompt);
      setStatus(copied ? "提示词已复制。" : "复制失败，请手动复制预览内容。");
      return;
    }

    if (action === "insert") {
      const prompt = updatePreview();
      const result = await insertPromptIntoActiveDoubaoTab(prompt);
      if (!result.ok) {
        const copied = await copyText(prompt);
        setStatus(copied ? `${result.error} 已复制提示词。` : result.error);
        return;
      }

      setStatus("已填入豆包输入框。");
    }
  });
}

function updatePreview() {
  const prompt = buildPrompt(restaurantInput.value, dishesInput.value);
  preview.value = prompt;
  return prompt;
}

function buildPrompt(restaurantName, dishes) {
  const cleanRestaurantName = restaurantName.trim() || DEFAULT_RESTAURANT;
  const cleanDishes = dishes.trim() || DEFAULT_DISHES;

  return `你是一名专业的资深美食吃货，请根据我给出的北京餐厅名称和推荐菜，以真实消费者的语气写一篇美食笔记，用于发布大众点评创作分成板块，笔记包含标题和内容。

标题不超过20字，要吸引人、有点击欲，但不要夸张标题党。

内容字数控制在250字左右，语气要接地气、自然、像真实吃完后的分享，可以适当加入emoji表情增加阅读趣味。

内容要重点介绍我给出的推荐菜，每道推荐菜都要写出口感、味道、吃法或让人印象深的地方。可以参考这种表达方式：
“酸甜度刚刚好，拌饭吃真的很香”
“这个搭配第一次吃还挺惊喜”
“肉质很嫩，蘸上酱料更香”

不同餐厅的笔记内容要写出不同风格，避免重复使用相同词汇、句子和套路。

内容最后加上热门话题。

笔记不要有加粗字体，不要编号，不要小标题，只输出标题和内容，每段内容之间要增加空白换行

餐厅名称：${cleanRestaurantName}

推荐菜：${cleanDishes}`;
}

async function insertPromptIntoActiveDoubaoTab(prompt) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "没有找到当前标签页。" };
  }

  if (!DOUBAO_URL_PATTERN.test(tab.url || "")) {
    return { ok: false, error: "当前标签页不是豆包页面。" };
  }

  let result = await sendInsertMessage(tab.id, prompt);
  if (result.ok) {
    return result;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["doubao-content.js"]
    });
  } catch (error) {
    return { ok: false, error: "无法注入豆包页面脚本。" };
  }

  result = await sendInsertMessage(tab.id, prompt);
  return result.ok ? result : { ok: false, error: result.error || "没有找到豆包输入框。" };
}

function sendInsertMessage(tabId, prompt) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "doubao-food-note-insert-prompt", prompt },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: "无法连接豆包页面。" });
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
