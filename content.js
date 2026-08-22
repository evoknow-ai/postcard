const PostCardAdapters = {
  x: {
    matches: () => /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(location.hostname),
    inputs: [
      'input[data-testid="fileInput"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"]'
    ],
    composers: [
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][contenteditable="true"]'
    ]
  },
  linkedin: {
    matches: () => location.hostname === "www.linkedin.com",
    inputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"]'
    ],
    composers: [
      '[role="textbox"][contenteditable="true"]',
      '.ql-editor[contenteditable="true"]'
    ]
  },
  facebook: {
    matches: () => location.hostname === "www.facebook.com",
    inputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"]'
    ],
    composers: [
      '[role="textbox"][contenteditable="true"]'
    ]
  },
  reddit: {
    matches: () => /(^|\.)reddit\.com$/.test(location.hostname),
    inputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"]'
    ],
    composers: [
      'shreddit-composer [contenteditable="true"]',
      '[role="textbox"][contenteditable="true"]',
      'textarea'
    ]
  },
  bluesky: {
    matches: () => location.hostname === "bsky.app",
    inputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"]'
    ],
    composers: [
      '[contenteditable="true"][role="textbox"]',
      'textarea'
    ]
  }
};

function currentAdapter() {
  return Object.values(PostCardAdapters).find(a => a.matches()) || null;
}

function dataUrlToFile(dataUrl, filename = "postcard.png") {
  const [meta, data] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function findVisible(selectors) {
  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)];
    const visible = nodes.find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
    if (visible) return visible;
    if (nodes[0]) return nodes[0];
  }
  return null;
}

function setComposerText(adapter, text) {
  if (!text) return { ok: true };
  const el = findVisible(adapter.composers);
  if (!el) return { ok: false, error: "Could not find the active post composer." };

  el.focus();
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const setter = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    )?.set;
    setter ? setter.call(el, text) : (el.value = text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    }));
  }
  return { ok: true };
}

async function attachImage(adapter, file) {
  const input = findVisible(adapter.inputs);
  if (!input) {
    return {
      ok: false,
      error: "Open the site's post composer and choose its image/media option once, then try Insert again."
    };
  }

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "This site's uploader rejected the injected image: " + error.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "POSTCARD_SITE_INFO") {
    const adapter = currentAdapter();
    sendResponse({
      supported: !!adapter,
      host: location.hostname
    });
    return;
  }

  if (message?.type === "POSTCARD_INSERT") {
    (async () => {
      const adapter = currentAdapter();
      if (!adapter) {
        sendResponse({ ok: false, error: "PostCard does not support this site yet." });
        return;
      }

      const textResult = setComposerText(adapter, message.postText || "");
      if (!textResult.ok && message.postText) {
        sendResponse(textResult);
        return;
      }

      const file = dataUrlToFile(message.imageDataUrl, "postcard.png");
      const imageResult = await attachImage(adapter, file);
      sendResponse(imageResult);
    })();
    return true;
  }
});
