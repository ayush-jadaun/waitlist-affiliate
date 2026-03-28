// packages/widget/src/index.ts
import { mountWidget } from "./widget.js";

export { mountWidget };

if (typeof document !== "undefined") {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    const apiKey = script.getAttribute("data-api-key");
    const apiUrl = script.getAttribute("data-api-url");

    if (apiKey && apiUrl) {
      const ready = () =>
        mountWidget({
          apiKey,
          apiUrl,
          theme: (script.getAttribute("data-theme") as "light" | "dark") ?? "light",
          accent: script.getAttribute("data-accent") ?? "#4a9eff",
          title: script.getAttribute("data-title") ?? undefined,
          subtitle: script.getAttribute("data-subtitle") ?? undefined,
          buttonText: script.getAttribute("data-button-text") ?? undefined,
        });

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ready);
      } else {
        ready();
      }
    }
  }
}
