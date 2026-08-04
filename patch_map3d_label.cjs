const fs = require('fs');
let code = fs.readFileSync('src/ui/Map3D.tsx', 'utf-8');

const formatHelper = `const formatCurrency = (val?: number) => {
  if (val === undefined) return '';
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  return '$' + val.toLocaleString();
};\n\n`;

code = code.replace('export const Map3D: React.FC = () => {', formatHelper + 'export const Map3D: React.FC = () => {');

const oldNodeLabelCall = `<NodeLabel
                    position={pos}
                    text={node.title}
                    subtitle={map.zones.find(z => z.id === node.zoneIds[0])?.name || node.zoneIds[0]}
                    offsetY={radius + 0.35}
                  />`;

const newNodeLabelCall = `<NodeLabel
                    position={pos}
                    text={node.title}
                    subtitle={map.zones.find(z => z.id === node.zoneIds[0])?.name || node.zoneIds[0]}
                    valueText={formatCurrency(node.economic?.marketGain)}
                    offsetY={radius + 0.35}
                  />`;

code = code.replace(oldNodeLabelCall, newNodeLabelCall);

fs.writeFileSync('src/ui/Map3D.tsx', code);
console.log('Patched Map3D label');
