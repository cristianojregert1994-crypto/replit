// Simple PNG icon generator - no external dependencies needed
// Run: node make-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const width = size;
  const height = size;
  
  // Create raw pixel data (RGBA)
  const raw = [];
  
  for (let y = 0; y < height; y++) {
    raw.push(0); // PNG filter: None
    
    for (let x = 0; x < width; x++) {
      // Purple gradient background
      const t = (x + y) / (width + height);
      const r = Math.round(124 + (167 - 124) * t);
      const g = Math.round(58 + (139 - 58) * t);
      const b = Math.round(237 + (250 - 237) * t);
      const a = 255;
      
      raw.push(r, g, b, a);
    }
  }
  
  // Compress
  const rawData = Buffer.from(raw);
  const compressed = zlib.deflateSync(rawData);
  
  // Build PNG
  const chunks = [];
  
  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  chunks.push(makeChunk('IHDR', ihdr));
  
  // IDAT
  chunks.push(makeChunk('IDAT', compressed));
  
  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));
  
  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) : (c >>> 1);
    }
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Generate
const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const file = path.join(dir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ icon${size}.png (${png.length} bytes)`);
});

console.log('\nDone! Icons created.');
