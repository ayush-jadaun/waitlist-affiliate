// packages/widget/src/styles.ts
export function getStyles(accent: string, theme: "light" | "dark"): string {
  const bg = theme === "dark" ? "#1a1a2e" : "#ffffff";
  const text = theme === "dark" ? "#e0e0e0" : "#1a1a2e";
  const border = theme === "dark" ? "#333" : "#e0e0e0";
  const inputBg = theme === "dark" ? "#16213e" : "#f5f5f5";

  return `
    .wl-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 420px;
      background: ${bg};
      color: ${text};
      border: 1px solid ${border};
      border-radius: 12px;
      padding: 24px;
      box-sizing: border-box;
    }
    .wl-title { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
    .wl-subtitle { font-size: 14px; opacity: 0.7; margin: 0 0 16px; }
    .wl-form { display: flex; flex-direction: column; gap: 10px; }
    .wl-input {
      padding: 10px 14px;
      border: 1px solid ${border};
      border-radius: 8px;
      background: ${inputBg};
      color: ${text};
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .wl-input:focus { border-color: ${accent}; }
    .wl-button {
      padding: 10px 14px;
      background: ${accent};
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .wl-button:hover { opacity: 0.9; }
    .wl-button:disabled { opacity: 0.5; cursor: not-allowed; }
    .wl-success { text-align: center; padding: 16px 0; }
    .wl-position { font-size: 32px; font-weight: 700; color: ${accent}; }
    .wl-referral { font-size: 12px; opacity: 0.6; margin-top: 12px; word-break: break-all; }
    .wl-referral-link {
      display: block;
      padding: 8px;
      background: ${inputBg};
      border-radius: 6px;
      margin-top: 4px;
      font-family: monospace;
      font-size: 13px;
      cursor: pointer;
    }
    .wl-error { color: #ff4444; font-size: 13px; margin-top: 4px; }
  `;
}
