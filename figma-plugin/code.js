// HMWSSB Figma -> React/Tailwind. Pure functions are Node-testable (test.js);
// the Figma glue only runs when `figma` is defined.

const KNOWN_COLORS = {
  '#0D1B2A': 'govt-navy',
  '#1B2A4A': 'govt-blue',
  '#2A3F6A': 'govt-blue-light',
  '#FF9933': 'govt-saffron',
  '#138808': 'govt-green',
  '#0E6606': 'govt-dark-green',
  '#FFF8E7': 'govt-cream',
  '#F0F2F5': 'govt-light-bg',
  '#D4D8DD': 'govt-border',
  '#6B7280': 'govt-muted',
};

const FONT_WEIGHTS = {
  Bold: 'font-bold', SemiBold: 'font-semibold', Medium: 'font-medium',
  Light: 'font-light', Regular: '', Italic: 'italic',
};

function round(n, d = 2) { return Math.round(n * 10 ** d) / 10 ** d; }

function hexByte(n) {
  return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0').toUpperCase();
}

function colorToHex(color, opacity = 1) {
  const a = round((color.a == null ? 1 : color.a) * opacity);
  if (a === 0) return null;
  const hex = '#' + hexByte(color.r) + hexByte(color.g) + hexByte(color.b);
  return a === 1 ? hex : hex + hexByte(a);
}

function firstSolid(items) {
  const f = (items || []).find((i) => i.type === 'SOLID' && i.visible !== false);
  return f ? colorToHex(f.color, f.opacity) : null;
}

function spacing(prop, px) {
  if (px == null) return '';
  if (px === 0) return `${prop}-0`;
  return Number.isInteger(px / 4) ? `${prop}-${px / 4}` : `${prop}-[${px}px]`;
}

function colorClass(hex, prefix) {
  if (!hex) return '';
  const known = KNOWN_COLORS[hex];
  return known ? `${prefix}-${known}` : `${prefix}-[${hex}]`;
}

function classes(node) {
  const out = [];
  const layout = node.layoutMode;
  if ((node.type === 'FRAME' || node.type === 'GROUP') && layout && layout !== 'NONE') {
    out.push(layout === 'VERTICAL' ? 'flex flex-col' : 'flex');
    const axis = { CENTER: 'center', MAX: 'end', MIN: 'start' };
    if (axis[node.primaryAxisAlignItems]) out.push(`justify-${axis[node.primaryAxisAlignItems]}`);
    if (axis[node.counterAxisAlignItems]) out.push(`items-${axis[node.counterAxisAlignItems]}`);
    out.push(spacing('gap', node.itemSpacing));
    if (node.paddingTop != null) {
      if (node.paddingTop === node.paddingBottom && node.paddingLeft === node.paddingRight) out.push(spacing('p', node.paddingTop));
      else { out.push(spacing('px', node.paddingLeft)); out.push(spacing('py', node.paddingTop)); }
    }
  }
  const fill = firstSolid(node.fills);
  if (fill) out.push(colorClass(fill, 'bg'));
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    out.push(node.cornerRadius >= node.width / 2 ? 'rounded-full' : spacing('rounded', node.cornerRadius));
  }
  const stroke = firstSolid(node.strokes);
  if (stroke) {
    out.push('border', colorClass(stroke, 'border'));
    if (node.strokeWeight && node.strokeWeight !== 1) out.push(spacing('border', node.strokeWeight));
  }
  if (node.opacity != null && node.opacity < 1) out.push(`opacity-[${round(node.opacity)}]`);
  const shadow = (node.effects || []).find((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
  if (shadow) {
    const c = colorToHex(shadow.color, shadow.opacity || 1);
    out.push(`shadow-[${round(shadow.offset.x)}px_${round(shadow.offset.y)}px_${round(shadow.radius)}px_${c}]`);
  }
  return out;
}

function textClasses(node) {
  const out = [];
  if (node.fontSize) out.push(Number.isInteger(node.fontSize / 4) ? `text-${node.fontSize / 4}` : `text-[${round(node.fontSize)}px]`);
  if (node.fontName && FONT_WEIGHTS[node.fontName.style] != null) out.push(FONT_WEIGHTS[node.fontName.style]);
  const c = firstSolid(node.fills);
  if (c) out.push(colorClass(c, 'text'));
  if (node.textAlignHorizontal && node.textAlignHorizontal !== 'LEFT') out.push(`text-${node.textAlignHorizontal.toLowerCase()}`);
  if (node.fontName && node.fontName.family === 'Segoe UI') out.push('font-govt');
  return out;
}

function nodeToJsx(node, depth = 0) {
  const pad = '  '.repeat(depth);
  if (node.type === 'TEXT') {
    const cls = textClasses(node).join(' ');
    return `${pad}<p${cls ? ` className="${cls}"` : ''}>{${JSON.stringify(node.characters)}}</p>`;
  }
  const cls = classes(node).join(' ');
  if (!node.children || !node.children.length) return `${pad}<div${cls ? ` className="${cls}"` : ''} />`;
  const kids = node.children.map((c) => nodeToJsx(c, depth + 1)).join('\n');
  return `${pad}<div${cls ? ` className="${cls}"` : ''}>\n${kids}\n${pad}</div>`;
}

function inspectNode(n) {
  const lines = [`${n.type} "${n.name}" · ${Math.round(n.width)} × ${Math.round(n.height)}`];
  const c = firstSolid(n.fills); if (c) lines.push(`  fill ${c}`);
  const stroke = firstSolid(n.strokes);
  if (stroke) lines.push(`  stroke ${stroke}${n.strokeWeight ? ` · ${n.strokeWeight}px` : ''}`);
  if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) lines.push(`  radius ${n.cornerRadius}`);
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    lines.push(`  layout ${n.layoutMode.toLowerCase()}${n.itemSpacing ? ` · gap ${n.itemSpacing}` : ''}${n.paddingTop != null ? ` · padding ${n.paddingTop}` : ''}`);
  }
  const shadow = (n.effects || []).find((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
  if (shadow) {
    lines.push(`  shadow ${round(shadow.offset.x)} ${round(shadow.offset.y)} ${round(shadow.radius)} ${colorToHex(shadow.color, shadow.opacity || 1)}`);
  }
  return lines.join('\n');
}

function inspect(nodes) {
  return nodes.length ? nodes.map(inspectNode).join('\n\n') : 'Select one or more nodes to inspect.';
}

function flatten(nodes) {
  return nodes.flatMap((n) => [n, ...flatten(n.children || [])]);
}

function extractTokens(nodes) {
  const colors = new Map();
  const fonts = new Set();
  const sizes = new Set();
  const spacingVals = new Set();
  const radii = new Set();
  const shadows = new Set();
  const walk = (n) => {
    for (const hex of [firstSolid(n.fills), firstSolid(n.strokes)]) if (hex) colors.set(hex, (colors.get(hex) || 0) + 1);
    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) radii.add(n.cornerRadius);
    if (n.itemSpacing) spacingVals.add(n.itemSpacing);
    if (n.paddingTop != null) { spacingVals.add(n.paddingTop); spacingVals.add(n.paddingLeft); }
    if (n.strokeWeight) spacingVals.add(n.strokeWeight);
    if (n.type === 'TEXT') {
      if (n.fontSize) sizes.add(n.fontSize);
      if (n.fontName) fonts.add(`${n.fontName.family} ${n.fontName.style}`);
    }
    const shadow = (n.effects || []).find((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
    if (shadow) shadows.add(`${round(shadow.offset.x)} ${round(shadow.offset.y)} ${round(shadow.radius)} ${colorToHex(shadow.color, shadow.opacity || 1)}`);
    (n.children || []).forEach(walk);
  };
  nodes.forEach(walk);
  return { colors, fonts, sizes, spacing: spacingVals, radii, shadows };
}

function tokenName(hex) {
  const known = KNOWN_COLORS[hex];
  return known ? known.replace(/^govt-/, '') : hex.slice(1).toLowerCase();
}

function renderTokens(t) {
  const out = [];
  out.push('// Colors — paste into client/tailwind.config.js theme.extend');
  out.push('colors: {');
  [...t.colors.keys()].sort().forEach((hex) => out.push(`  '${tokenName(hex)}': '${hex}',`));
  out.push('},');
  out.push('');
  out.push('// Font sizes (px)');
  out.push([...t.sizes].sort((a, b) => a - b).join(', '));
  out.push('');
  out.push('// Fonts');
  out.push([...t.fonts].sort().join('\n'));
  out.push('');
  out.push('// Spacing (px)');
  out.push([...t.spacing].sort((a, b) => a - b).join(', '));
  out.push('');
  out.push('// Border radius (px)');
  out.push([...t.radii].sort((a, b) => a - b).join(', '));
  out.push('');
  out.push('// Shadows (x y blur color)');
  out.push([...t.shadows].sort().join('\n'));
  return out.join('\n');
}

// Workflow-reference capture: a structural contract for the e2e runner.
// The selected frame's text layer strings become the "elements" the runner
// expects to find on the live page; PNG export is done in the Figma glue.
function extractReference(nodes, meta = {}) {
  const all = flatten(nodes || []);
  const texts = all.filter((n) => n.type === 'TEXT').map((n) => n.characters).filter(Boolean);
  const first = nodes && nodes[0];
  return {
    stepId: meta.stepId || '',
    route: meta.route || '',
    status: meta.status || '',
    elements: texts,
    nodes: all.length,
    width: Math.round((first && first.width) || 0),
    height: Math.round((first && first.height) || 0),
  };
}

if (typeof figma !== 'undefined') {
  figma.showUI(__html__, { width: 460, height: 560, themeColors: true });
  const selection = () => figma.currentPage.selection;
  const send = (msg) => figma.ui.postMessage(msg);

  function onSelectionChange() { send({ type: 'inspect', data: inspect(selection()) }); }
  figma.on('selectionchange', onSelectionChange);
  onSelectionChange();

  figma.ui.onmessage = async (msg) => {
    const sel = selection();
    switch (msg.type) {
      case 'tokens':
        send({ type: 'tokens', data: renderTokens(extractTokens(sel.length ? sel : [figma.currentPage])) });
        break;
      case 'jsx':
        send({ type: 'jsx', data: sel.length ? nodeToJsx(sel[0]) : 'Select a frame to convert.' });
        break;
      case 'reference': {
        if (!sel.length) { send({ type: 'reference-status', ok: false, text: 'Select a frame first.' }); break; }
        try {
          const png = await sel[0].exportAsync({ format: 'PNG' });
          const bytes = new Uint8Array(png);
          let bin = '';
          for (const b of bytes) bin += String.fromCharCode(b);
          const image = 'data:image/png;base64,' + btoa(bin);
          const data = { ...extractReference(sel, msg.meta || {}), image };
          send({ type: 'reference', data });
        } catch (err) {
          send({ type: 'reference-status', ok: false, text: 'Export failed: ' + err.message });
        }
        break;
      }
      case 'done':
        figma.closePlugin();
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nodeToJsx, extractTokens, renderTokens, inspect, flatten, extractReference };
}
