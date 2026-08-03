const fs = require('fs');
let code = fs.readFileSync('src/ui/Bubbles.tsx', 'utf-8');

code = code.replace(
  `const w = 512;`,
  `const w = 1024;`
).replace(
  `const h = subtitle ? 128 : 96;`,
  `const h = subtitle ? 256 : 192;`
).replace(
  `ctx.font = 'bold 26px Inter, system-ui, sans-serif';`,
  `ctx.font = 'bold 52px Inter, system-ui, sans-serif';`
).replace(
  `ctx.font = 'normal 18px Inter, system-ui, sans-serif';`,
  `ctx.font = 'normal 36px Inter, system-ui, sans-serif';`
).replace(
  `const padX = 24;`,
  `const padX = 48;`
).replace(
  `const boxH = subtitle ? 72 : 44;`,
  `const boxH = subtitle ? 144 : 88;`
).replace(
  `ctx.lineWidth = 2;`,
  `ctx.lineWidth = 4;`
).replace(
  `const r = 8;`,
  `const r = 16;`
).replace(
  `ctx.font = 'bold 24px Inter, system-ui, sans-serif';`,
  `ctx.font = 'bold 48px Inter, system-ui, sans-serif';`
).replace(
  `ctx.fillText(label, w / 2, by + boxH / 2 - 12);`,
  `ctx.fillText(label, w / 2, by + boxH / 2 - 24);`
).replace(
  `ctx.font = 'normal 18px Inter, system-ui, sans-serif';`,
  `ctx.font = 'normal 36px Inter, system-ui, sans-serif';`
).replace(
  `ctx.fillText(sub, w / 2, by + boxH / 2 + 14);`,
  `ctx.fillText(sub, w / 2, by + boxH / 2 + 28);`
).replace(
  `ctx.font = 'bold 24px Inter, system-ui, sans-serif';`,
  `ctx.font = 'bold 48px Inter, system-ui, sans-serif';`
).replace(
  `ctx.fillText(label, w / 2, h / 2 + 1);`,
  `ctx.fillText(label, w / 2, h / 2 + 2);`
).replace(
  `scale={[3.2, subtitle ? 0.8 : 0.6, 1]}`,
  `scale={[5.2, subtitle ? 1.3 : 0.975, 1]}`
);

fs.writeFileSync('src/ui/Bubbles.tsx', code);
console.log('Patched Bubbles.tsx');
