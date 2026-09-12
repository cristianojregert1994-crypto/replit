#!/usr/bin/env python3
"""Generate PNG icons for Chrome extension"""
import struct
import zlib
import os

def create_png(width, height):
    """Create a simple purple PNG icon"""
    pixels = []
    
    for y in range(height):
        pixels.append(0)  # filter byte
        for x in range(width):
            # Purple gradient
            t = (x + y) / max(width + height, 1)
            r = int(124 + (167 - 124) * t)
            g = int(58 + (139 - 58) * t)
            b = int(237 + (250 - 237) * t)
            a = 255
            
            # Rounded corners
            corner_r = int(width * 0.2)
            in_corner = False
            corners = [
                (corner_r, corner_r),
                (width - corner_r - 1, corner_r),
                (corner_r, height - corner_r - 1),
                (width - corner_r - 1, height - corner_r - 1)
            ]
            for cx, cy in corners:
                if ((x < corner_r or x > width - corner_r - 1) and 
                    (y < corner_r or y > height - corner_r - 1)):
                    dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                    if dist > corner_r:
                        in_corner = True
                        break
            
            if in_corner:
                pixels.extend([0, 0, 0, 0])
            else:
                pixels.extend([r, g, b, a])
    
    raw_data = bytes(pixels)
    compressed = zlib.compress(raw_data)
    
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xFFFFFFFF
    png += struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT
    idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xFFFFFFFF
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND
    iend_crc = zlib.crc32(b'IEND') & 0xFFFFFFFF
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png

# Generate icons
icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(icons_dir, exist_ok=True)

for size in [16, 48, 128]:
    png_data = create_png(size, size)
    filepath = os.path.join(icons_dir, f'icon{size}.png')
    with open(filepath, 'wb') as f:
        f.write(png_data)
    print(f'Created icon{size}.png ({len(png_data)} bytes)')

print('Done!')
