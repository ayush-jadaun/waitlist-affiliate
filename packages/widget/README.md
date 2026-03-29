# @waitlist/widget

Drop-in embeddable waitlist widget. Add a fully functional signup form with referral tracking to any page with a single `<script>` tag. Built on Shadow DOM so it never conflicts with your site's styles.

## Installation

### Option 1 — Script tag (recommended for most sites)

```html
<script
  src="https://cdn.example.com/waitlist-widget.js"
  data-api-key="wl_pk_your_key_here"
  data-api-url="https://your-api.example.com"
  data-theme="light"
  data-accent="#4a9eff"
  data-title="Join the Waitlist"
  data-subtitle="Be the first to know when we launch."
  data-button-text="Join Now"
  defer
></script>
```

When loaded this way the widget mounts itself automatically into `document.body` once the DOM is ready. It reads a `?ref=` query parameter from the current URL and pre-fills the referral code.

### Option 2 — npm

```bash
npm install @waitlist/widget
```

## Script Tag Data Attributes

| Attribute         | Required | Default                              | Description                              |
|-------------------|----------|--------------------------------------|------------------------------------------|
| `data-api-key`    | Yes      | —                                    | Your project's public API key            |
| `data-api-url`    | Yes      | —                                    | Base URL of the API server               |
| `data-theme`      | No       | `"light"`                            | Color theme: `"light"` or `"dark"`       |
| `data-accent`     | No       | `"#4a9eff"`                          | Accent color for buttons and focus rings (any CSS hex color) |
| `data-title`      | No       | `"Join the Waitlist"`                | Heading text                             |
| `data-subtitle`   | No       | `"Be the first to know when we launch."` | Subheading text                      |
| `data-button-text`| No       | `"Join Now"`                         | Submit button label                      |

## Programmatic Usage

```ts
import { mountWidget } from "@waitlist/widget";

mountWidget({
  apiKey: "wl_pk_your_key_here",
  apiUrl: "https://your-api.example.com",
  theme: "dark",
  accent: "#7c3aed",
  title: "Early Access",
  subtitle: "Limited spots available.",
  buttonText: "Request Access",
  container: document.getElementById("waitlist-root")!, // optional
});
```

### `mountWidget(config)` Options

| Option       | Type                   | Required | Default                              | Description                                      |
|--------------|------------------------|----------|--------------------------------------|--------------------------------------------------|
| `apiKey`     | `string`               | Yes      | —                                    | Your project's public API key                    |
| `apiUrl`     | `string`               | Yes      | —                                    | Base URL of the API server                       |
| `theme`      | `"light" \| "dark"`   | No       | `"light"`                            | Color theme                                      |
| `accent`     | `string`               | No       | `"#4a9eff"`                          | Accent hex color                                 |
| `title`      | `string`               | No       | `"Join the Waitlist"`                | Heading text                                     |
| `subtitle`   | `string`               | No       | `"Be the first to know when we launch."` | Subheading text                              |
| `buttonText` | `string`               | No       | `"Join Now"`                         | Submit button label                              |
| `container`  | `HTMLElement`          | No       | Appended to `document.body`          | Element to mount the widget into                 |

## Customization

The widget is styled entirely within its own Shadow DOM using the `accent` color and `theme` options. For deeper customization, use the programmatic API and supply your own container element positioned via your own CSS.

## Shadow DOM Isolation

The widget renders inside a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) (`mode: "open"`). This means:

- Your page's global CSS cannot accidentally break the widget's appearance.
- The widget's styles cannot leak out and affect your page.
- The widget works in any HTML context without style conflicts.

## Size

~6 KB gzipped.

## License

Apache 2.0
