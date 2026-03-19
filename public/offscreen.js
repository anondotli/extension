// Offscreen document for clipboard write (Chrome MV3)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "OFFSCREEN_COPY" && typeof msg.text === "string") {
    navigator.clipboard.writeText(msg.text).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ error: err.message })
    );
    return true; // async response
  }
});
