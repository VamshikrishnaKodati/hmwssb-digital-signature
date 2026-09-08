const assert = require('assert');
const { nodeToJsx, extractTokens, renderTokens, inspect, extractReference } = require('./code.js');

const frame = {
  type: 'FRAME', name: 'Card', width: 320, height: 200,
  layoutMode: 'VERTICAL', itemSpacing: 12,
  paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16,
  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
  cornerRadius: 8,
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }],
  strokes: [{ type: 'SOLID', color: { r: 0.8314, g: 0.8471, b: 0.8667 }, opacity: 1, visible: true }],
  strokeWeight: 1, opacity: 1, effects: [],
  children: [{
    type: 'TEXT', name: 'Title', characters: 'Hello, "world"!', fontSize: 16,
    fontName: { family: 'Segoe UI', style: 'Bold' },
    fills: [{ type: 'SOLID', color: { r: 0.05098, g: 0.10588, b: 0.16471 }, opacity: 1, visible: true }],
    width: 50, height: 20,
  }],
};

const jsx = nodeToJsx(frame);
for (const want of ['flex flex-col', 'justify-center', 'items-center', 'gap-3', 'p-4',
  'bg-[#FFFFFF]', 'rounded-2', 'border-govt-border', 'text-govt-navy',
  'text-4', 'font-bold', 'font-govt', '{"Hello, \\"world\\"!"}']) {
  assert(jsx.includes(want), `missing '${want}' in:\n${jsx}`);
}

const tokens = extractTokens([frame]);
assert(tokens.colors.has('#FFFFFF'));
assert(tokens.colors.has('#D4D8DD'));
assert(tokens.colors.has('#0D1B2A'));
assert([...tokens.sizes][0] === 16);

const rendered = renderTokens(tokens);
assert(rendered.includes("'navy': '#0D1B2A'"), rendered);
assert(rendered.includes("'border': '#D4D8DD'"), rendered);

assert(inspect([frame]).includes('FRAME "Card" · 320 × 200'));
assert(inspect([frame]).includes('fill #FFFFFF'));
assert(inspect([]) === 'Select one or more nodes to inspect.');

const ref = extractReference([frame], { stepId: 'create_estimate', route: '/estimates/new', status: 'Draft' });
assert(ref.stepId === 'create_estimate');
assert(ref.route === '/estimates/new');
assert(ref.elements.includes('Hello, "world"!'));
assert(ref.nodes === 2 && ref.width === 320);

console.log('all checks passed');
