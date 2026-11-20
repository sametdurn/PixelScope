<p align="center">
  <img src="icons/128.png" alt="PixelScope Logo" width="128">
</p>

<div align="center">
  <h1>PixelScope</h1>
  <p>🇬🇧 English · 🇹🇷 <a href="README.tr.md">Türkçe</a></p>
  <p>A browser extension that removes right-click restrictions, finds and lists every image on a page, and tries to locate the <strong>original-resolution</strong> version of each image (Manifest V3, Chromium-based browsers).</p>
</div>

## Features

- **Restriction removal:** Lifts right-click, text selection, drag, copy and cut restrictions. Toggled from the popup; the setting persists across all sites and tabs.
- **Image context menu:** Works on images even on sites that block right-click.
  - Open image in new tab / save / copy
  - Open original image in new tab / save / copy
- **Image scanner:** Finds all images on the page and shows them in a grid, filterable by URL or type. The scan covers:
  - `<img>`, `srcset`, `<picture>/<source>` and lazy-load (`data-*`) attributes
  - CSS `background-image` (including `::before` / `::after`)
  - Inline SVG, `<canvas>`, video `poster`
  - `og:image`, `twitter:image`, favicon and `apple-touch-icon`
  - All iframes
- **Find original:** Tries heuristic URL transformations and lists only the candidates that turn out **larger** than the current version, with their resolution.
- **Detail panel:** Preview, size, type, copy URL, open in new tab and download.

## Language

The UI is available in English and Turkish. English is the default; if the browser language is Turkish, the extension uses Turkish. Strings live in the `_locales/` folder.

## How the original version is found

No AI or server-side processing: URL patterns are tried, and each candidate is actually loaded and compared by pixel count.

| Pattern | Example |
|---|---|
| Strip size/quality parameters | `?w=300&q=60` → no parameters |
| WordPress | `photo-300x200.jpg` / `photo-scaled.jpg` → `photo.jpg` |
| Thumbnail suffixes | `_thumb`, `_small`, `_medium`, etc. |
| Shopify | `photo_300x.jpg` → `photo.jpg` |
| Path segments | `/thumbs/`, `/small/` → `/original/`, `/large/` |
| Cloudinary-like | `/upload/w_300,c_fill/` → `/upload/` |
| Google | `=s200`, `=w300-h200` → `=s0` |
| Twitter/X | `name=small` → `name=orig` |
| `@2x` suffix | `photo@2x.png` → `photo.png` |
| `srcset` | Larger candidates on the page with the same file name |

> Results depend on the site. This is a best-guess method; a larger version may not always exist.

## Installation

The extension is not published in a store yet; load it in developer mode in Chromium-based browsers such as Chrome, Edge or Brave.

1. Download or clone this repository:
   ```bash
   git clone https://github.com/sametdurn/PixelScope.git
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `PixelScope` folder.

## Usage

1. **To remove restrictions:** Click the PixelScope icon in the toolbar and check *Remove right-click / selection / drag restrictions*.
2. **To grab a single image:** Right-click the image and pick an action from the PixelScope menu.
3. **To see all images on the page:** Press **Scan images** in the popup, click an image, then use **Find original** to look for a larger version.

## Permissions

| Permission | Why it's needed |
|---|---|
| `activeTab`, `scripting` | Scanning the page and showing notifications |
| `contextMenus` | Right-click menu items |
| `downloads` | Downloading images |
| `clipboardWrite` | Copying images to the clipboard |
| `storage` | Storing the restriction-removal setting |
| `<all_urls>` | Working on every site |

No data is collected or sent to any server. Everything runs locally in the browser.

## Project structure

```
PixelScope/
├── manifest.json      # Extension definition (MV3)
├── background.js      # Context menu, download, copy
├── content-main.js    # Breaks restrictions in the page world (MAIN world)
├── content.js         # Image detection, original lookup, messaging
├── popup.html/.css/.js# UI: scanner, filter, detail panel
├── viewer.html/.js    # Shows data: images in a new tab
├── _locales/          # en (default) and tr translations
└── icons/             # 16, 32, 48, 128 px icons
```

## Disclaimer

This tool is intended for personal use and accessibility only. You are responsible for complying with the copyright of the images you download and with each site's terms of use.

## License

This project is licensed under the [MIT License](LICENSE).
