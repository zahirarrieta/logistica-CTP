import sharp from 'sharp';
import fs from 'fs';

async function gen() {
  const src = 'public/ICOCTP.png';
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  if (!fs.existsSync('public/icons')) fs.mkdirSync('public/icons', { recursive: true });
  for (const size of sizes) {
    await sharp(src).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
    console.log('Generated:', `icon-${size}.png`);
  }
  // maskable 512 with safe background
  await sharp(src).resize(512, 512, { fit: 'contain', background: { r: 7, g: 26, b: 61, alpha: 1 } }).png().toFile('public/icons/icon-512-maskable.png');
  console.log('Generated: icon-512-maskable.png');
}
gen().catch(console.error);