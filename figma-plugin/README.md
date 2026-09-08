# HMWSSB Design-to-Code (Figma plugin)

Inspects Figma frames and converts them into React/Tailwind that matches the
app's design system in `client/tailwind.config.js`.

## Features
- **Inspect** (automatic on selection): dimensions, fills, strokes, radius, layout, gap, padding, shadows.
- **Extract tokens**: scans the selection for colors, font sizes/families, spacing, radius, and shadows, and emits a snippet ready to paste into `theme.extend`.
- **Generate component**: converts the selected frame into JSX + Tailwind class names.

Known design-system colors map to `govt-*` tokens (e.g. `#0D1B2A` → `bg-govt-navy`); unknown colors fall back to arbitrary values (`bg-[#HEX]`). `Segoe UI` text maps to `font-govt`. Auto-layout maps to flex (`flex`, `flex-col`, `gap-*`, `p-*`).

## Install
1. In Figma desktop: Plugins → Development → Import plugin from manifest.
2. Select `figma-plugin/manifest.json`.

## Use
1. Select a frame (approved component / design spec).
2. **Extract tokens** → copy into `client/tailwind.config.js` `theme.extend`.
3. **Generate component** → copy the JSX into `client/src/components/`.
4. **Copy** puts the current output on the clipboard.

## Test
```sh
node figma-plugin/test.js
```
