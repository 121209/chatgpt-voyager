chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "capture-visible-tab") {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, {
      format: "png"
    }, (url) => {
      if (chrome.runtime.lastError || !url) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message || "Failed to capture tab"
        });
        return;
      }

      sendResponse({
        ok: true,
        url
      });
    });

    return true;
  }

  if (message?.type !== "download-markdown" && message?.type !== "download-data-url") return false;

  const filename = String(message.filename || "chatgpt-conversation-export");
  const url = message.type === "download-markdown"
    ? `data:text/markdown;charset=utf-8,${encodeURIComponent(String(message.markdown || ""))}`
    : String(message.url || "");

  if (!url) {
    sendResponse({
      ok: false,
      error: "Missing download URL"
    });
    return false;
  }

  chrome.downloads.download({
    url,
    filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message
      });
      return;
    }

    sendResponse({
      ok: true,
      downloadId
    });
  });

  return true;
});
