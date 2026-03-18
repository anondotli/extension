import { defineContentScript } from "wxt/utils/define-content-script";
import { setDropKey, getSyncDropKeys } from "../lib/storage";

export default defineContentScript({
  matches: ["https://anon.li/d/*"],
  runAt: "document_idle",
  main() {
    const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

    function captureKey() {
      const fragment = location.hash.slice(1);
      if (!KEY_RE.test(fragment)) return;

      const parts = location.pathname.split("/");
      // pathname is /d/<id>, so parts = ["", "d", "<id>"]
      const dropId = parts[2];
      if (!dropId) return;

      setDropKey(dropId, fragment);
    }

    async function maybeCaptureKey() {
      const enabled = await getSyncDropKeys();
      if (!enabled) return;
      captureKey();
    }

    maybeCaptureKey();
    window.addEventListener("hashchange", () => maybeCaptureKey());
  },
});
