const EXTENSION_BUTTON_ID = "xpath-image-download-button";

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
    <div class="jimeng-image-downloader-icon">
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
