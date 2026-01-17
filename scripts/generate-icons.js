// Script para generar iconos PWA
// Ejecutar con: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

const sizes = [32, 72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Crear directorio si no existe
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG base para el icono
const createSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6c5ce7"/>
      <stop offset="100%" style="stop-color:#a29bfe"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="300" font-weight="bold" fill="white" text-anchor="middle">S</text>
</svg>`;

// Por ahora guardamos como SVG (se pueden convertir a PNG con herramientas externas)
sizes.forEach(size => {
    const svgPath = path.join(iconsDir, `icon-${size}.svg`);
    fs.writeFileSync(svgPath, createSvg(size));
    console.log(`Created: icon-${size}.svg`);
});

console.log('\\nIconos SVG creados. Para convertir a PNG, usa:');
console.log('- https://convertio.co/svg-png/');
console.log('- O instala sharp: npm install sharp');
