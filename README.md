# CHUM image_tool

Client-side image processing PWA with skin smoothing, sharpening, backlight fix and 2048px JPG export.

## Features

- **Skin Smoothing** — Selective Gaussian blur on detected skin-tone pixels (HSL-based)
- **Sharpening** — Unsharp mask convolution for crisp detail
- **Backlight Fix** — Lift shadows + compress highlights with tone curve
- **Brightness / Contrast** — Standard pixel-level adjustments
- **One-Click Presets** — Facebook Ready, Portrait Pro, Backlight Fix
- **RGB Histogram** — Real-time histogram with per-channel visualization
- **2048px JPG Export** — Resize to optimal 2048px, export at 95% JPEG quality
- **Dark/Light Neumorphism** — Theme persists in LocalStorage
- **PWA Ready** — Installable, offline-capable via Service Worker

## Quick Start

1. Open `index.html` in a browser (or serve with any static server)
2. Upload or drag-drop an image
3. Adjust sliders or use a Quick Action preset
4. Click **Apply Changes** to preview
5. Click **Download 2048px JPG** to export

## Tech Stack

- HTML5 + CSS3 + Vanilla JavaScript
- Canvas 2D API for all image processing
- No external dependencies
- No backend required

## File Structure

```
chum_image_tool/
├── index.html
├── style.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── assets/
│   ├── favicon.ico
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── README.md
```

## License

MIT
