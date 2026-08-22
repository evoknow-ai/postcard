function openEditor() {
  chrome.windows.create({
    url: chrome.runtime.getURL("editor.html"),
    type: "popup",
    width: 1180,
    height: 820,
    focused: true
  });
}

chrome.action.onClicked.addListener(openEditor);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "postcard-selection",
    title: "Create PostCard from selection",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "postcard-selection") return;
  await chrome.storage.local.set({
    postcardSelectedText: info.selectionText || "",
    postcardSelectedAt: Date.now()
  });
  openEditor();
});
