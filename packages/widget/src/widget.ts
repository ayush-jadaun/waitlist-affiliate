// packages/widget/src/widget.ts
import { WaitlistClient } from "@waitlist/sdk";
import { getStyles } from "./styles.js";

interface WidgetConfig {
  apiKey: string;
  apiUrl: string;
  theme?: "light" | "dark";
  accent?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  container?: HTMLElement;
}

export function mountWidget(config: WidgetConfig) {
  const {
    apiKey, apiUrl,
    theme = "light", accent = "#4a9eff",
    title = "Join the Waitlist",
    subtitle = "Be the first to know when we launch.",
    buttonText = "Join Now",
    container,
  } = config;

  const client = new WaitlistClient({ apiKey, baseUrl: apiUrl });
  const root = container ?? document.createElement("div");
  if (!container) document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = getStyles(accent, theme);
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.className = "wl-container";
  shadow.appendChild(wrapper);

  renderForm();

  function renderForm() {
    wrapper.innerHTML = `
      <div class="wl-title">${title}</div>
      <div class="wl-subtitle">${subtitle}</div>
      <form class="wl-form">
        <input class="wl-input" type="email" placeholder="Your email" required />
        <input class="wl-input" type="text" placeholder="Your name (optional)" />
        <button class="wl-button" type="submit">${buttonText}</button>
      </form>
      <div class="wl-error" style="display:none"></div>
    `;

    const form = shadow.querySelector("form")!;
    const errorEl = shadow.querySelector(".wl-error") as HTMLElement;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = shadow.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
      const email = inputs[0]!.value;
      const name = inputs[1]!.value || undefined;
      const button = shadow.querySelector("button") as HTMLButtonElement;

      const url = new URL(window.location.href);
      const referralCode = url.searchParams.get("ref") ?? undefined;

      button.disabled = true;
      button.textContent = "Joining...";
      errorEl.style.display = "none";

      try {
        const result = await client.subscribe({ email, name, referralCode });
        renderSuccess(result.position, result.referralCode);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "Something went wrong";
        errorEl.style.display = "block";
        button.disabled = false;
        button.textContent = buttonText;
      }
    });
  }

  function renderSuccess(position: number | null, referralCode: string) {
    const referralUrl = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;

    wrapper.innerHTML = `
      <div class="wl-success">
        <div class="wl-title">You're in!</div>
        ${position !== null ? `<div class="wl-position">#${position}</div><div class="wl-subtitle">Your position on the waitlist</div>` : '<div class="wl-subtitle">We\'ll be in touch soon.</div>'}
        <div class="wl-referral">
          Share to move up:
          <span class="wl-referral-link" title="Click to copy">${referralUrl}</span>
        </div>
      </div>
    `;

    const link = shadow.querySelector(".wl-referral-link");
    link?.addEventListener("click", () => {
      navigator.clipboard.writeText(referralUrl).then(() => {
        if (link) link.textContent = "Copied!";
        setTimeout(() => { if (link) link.textContent = referralUrl; }, 2000);
      });
    });
  }
}
