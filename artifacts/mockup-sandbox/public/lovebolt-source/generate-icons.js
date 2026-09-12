/**
 * Generate extension icons as PNG files
 * Run: node generate-icons.js
 * Requires: npm install canvas (or use the HTML generator instead)
 * 
 * If canvas is not installed, this creates minimal valid PNG files.
 */

const fs = require('fs');
const path = require('path');

// Minimal valid 1x1 PNG (purple) - we'll create proper icons
function createPNG(width, height) {
  // Create a simple solid-color PNG
  // This is a minimal valid PNG with a purple (#7c3aed) fill
  
  const pixels = [];
  for (let y = 0; y < height; y++) {
    pixels.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Purple gradient-ish: #7c3aed to #a78bfa
      const t = (x + y) / (width + height);
      const r = Math.round(124 + (167 - 124) * t);
      const g = Math.round(58 + (139 - 58) * t);
      const b = Math.round(237 + (250 - 237) * t);
      pixels.push(r, g, b, 255); // RGBA
    }
  }
  
  // Add "LG" text by making certain pixels white
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const letterSize = Math.floor(width * 0.3);
  
  // Simple "L" shape
  for (let dy = -letterSize; dy <= letterSize; dy++) {
    for (let dx = -letterSize; dx <= letterSize; dx++) {
      const px = centerX + dx - Math.floor(letterSize * 0.5);
      const py = centerY + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * (width * 4 + 1)) + (px * 4) + 1;
        // Vertical bar of L
        if (dx >= -letterSize && dx <= -letterSize + Math.floor(width * 0.08)) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
        // Horizontal bar of L
        if (dy >= letterSize - Math.floor(height * 0.08) && dy <= letterSize) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
      }
    }
  }
  
  // Simple "G" shape
  const gOffset = Math.floor(letterSize * 0.8);
  for (let dy = -letterSize; dy <= letterSize; dy++) {
    for (let dx = -letterSize; dx <= letterSize; dx++) {
      const px = centerX + dx + gOffset;
      const py = centerY + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * (width * 4 + 1)) + (px * 4) + 1;
        // Top bar
        if (dy >= -letterSize && dy <= -letterSize + Math.floor(height * 0.08) && dx >= -letterSize) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
        // Left bar
        if (dx >= -letterSize && dx <= -letterSize + Math.floor(width * 0.08)) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
        // Bottom bar
        if (dy >= letterSize - Math.floor(height * 0.08) && dy <= letterSize && dx >= -letterSize) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
        // Right bar (middle)
        if (dx >= letterSize - Math.floor(width * 0.08) && dx <= letterSize && dy >= 0) {
          pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255;
        }
      }
    }
  }
  
  return Buffer.from(pixels);
}

// Use a pre-made minimal PNG for each size
// These are valid PNG files with the right dimensions
function createMinimalPNG(size) {
  // For simplicity, create a valid PNG with solid purple color
  // Using the PNG specification directly
  
  const width = size;
  const height = size;
  
  // Raw pixel data (RGBA)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // PNG filter: None
    for (let x = 0; x < width; x++) {
      // Rounded corners - make corner pixels transparent
      const cornerRadius = Math.floor(size * 0.2);
      const inCorner = (x < cornerRadius && y < cornerRadius && 
        Math.sqrt((x - cornerRadius) ** 2 + (y - cornerRadius) ** 2) > cornerRadius) ||
        (x >= width - cornerRadius && y < cornerRadius && 
        Math.sqrt((x - (width - cornerRadius - 1)) ** 2 + (y - cornerRadius) ** 2) > cornerRadius) ||
        (x < cornerRadius && y >= height - cornerRadius && 
        Math.sqrt((x - cornerRadius) ** 2 + (y - (height - cornerRadius - 1)) ** 2) > cornerRadius) ||
        (x >= width - cornerRadius && y >= height - cornerRadius && 
        Math.sqrt((x - (width - cornerRadius - 1)) ** 2 + (y - (height - cornerRadius - 1)) ** 2) > cornerRadius);
      
      if (inCorner) {
        rawData.push(0, 0, 0, 0); // transparent
      } else {
        // Purple gradient
        const t = (x + y) / (width + height);
        rawData.push(
          Math.round(124 + (167 - 124) * t),
          Math.round(58 + (139 - 58) * t),
          Math.round(237 + (250 - 237) * t),
          255
        );
      }
    }
  }
  
  // Create PNG file
  const png = createPNGFile(width, height, Buffer.from(rawData));
  return png;
}

function createPNGFile(width, height, rawData) {
  const zlib = require('zlib');
  
  // Compress raw data
  const compressed = zlib.deflateSync(rawData);
  
  // Build PNG chunks
  const chunks = [];
  
  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createChunk('IHDR', ihdr));
  
  // IDAT chunk
  chunks.push(createChunk('IDAT', compressed));
  
  // IEND chunk
  chunks.push(createChunk('IEND', Buffer.alloc(0)));
  
  return Buffer.concat(chunks);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');

console.log('Generating icons...');

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const png = createMinimalPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created: icon${size}.png (${png.length} bytes)`);
});

console.log('Done! Icons created in icons/ folder.');
