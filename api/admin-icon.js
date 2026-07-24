import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3] ?? 255;
  }

  function fillRect(x, y, width, height, color) {
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(size, Math.ceil(x + width));
    const bottom = Math.min(size, Math.ceil(y + height));
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) setPixel(px, py, color);
    }
  }

  function fillRoundedRect(x, y, width, height, radius, color) {
    const left = Math.floor(x);
    const top = Math.floor(y);
    const right = Math.ceil(x + width);
    const bottom = Math.ceil(y + height);
    const r = Math.max(0, radius);
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        const nearestX = Math.max(left + r, Math.min(px, right - r - 1));
        const nearestY = Math.max(top + r, Math.min(py, bottom - r - 1));
        const dx = px - nearestX;
        const dy = py - nearestY;
        if ((dx * dx) + (dy * dy) <= r * r) setPixel(px, py, color);
      }
    }
  }

  function drawLine(x0, y0, x1, y1, thickness, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const radius = Math.max(1, Math.floor(thickness / 2));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const x = Math.round(x0 + ((x1 - x0) * ratio));
      const y = Math.round(y0 + ((y1 - y0) * ratio));
      fillRoundedRect(x - radius, y - radius, radius * 2, radius * 2, radius, color);
    }
  }

  return { pixels, fillRect, fillRoundedRect, drawLine };
}

function createIcon(size) {
  const canvas = createCanvas(size);
  const dark = [17, 24, 39, 255];
  const white = [255, 255, 255, 255];
  const orange = [245, 119, 48, 255];

  canvas.fillRect(0, 0, size, size, dark);
  canvas.fillRoundedRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.18, white);
  canvas.fillRoundedRect(size * 0.145, size * 0.145, size * 0.71, size * 0.71, size * 0.14, dark);
  canvas.fillRoundedRect(size * 0.145, size * 0.65, size * 0.71, size * 0.205, size * 0.07, orange);

  const top = size * 0.31;
  const height = size * 0.25;
  const thickness = Math.max(6, Math.round(size * 0.035));
  const width = size * 0.13;

  const eX = size * 0.23;
  canvas.fillRect(eX, top, thickness, height, white);
  canvas.fillRect(eX, top, width, thickness, white);
  canvas.fillRect(eX, top + (height / 2) - (thickness / 2), width * 0.82, thickness, white);
  canvas.fillRect(eX, top + height - thickness, width, thickness, white);

  const dX = size * 0.43;
  canvas.fillRect(dX, top, thickness, height, white);
  canvas.fillRect(dX, top, width * 0.72, thickness, white);
  canvas.fillRect(dX, top + height - thickness, width * 0.72, thickness, white);
  canvas.fillRect(dX + (width * 0.72) - thickness, top + thickness, thickness, height - (thickness * 2), white);

  const mX = size * 0.62;
  const mRight = mX + width;
  canvas.fillRect(mX, top, thickness, height, white);
  canvas.fillRect(mRight - thickness, top, thickness, height, white);
  canvas.drawLine(mX + (thickness / 2), top + (thickness / 2), mX + (width / 2), top + (height * 0.48), thickness, white);
  canvas.drawLine(mRight - (thickness / 2), top + (thickness / 2), mX + (width / 2), top + (height * 0.48), thickness, white);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row += 1) {
    const destination = row * (size * 4 + 1);
    raw[destination] = 0;
    canvas.pixels.copy(raw, destination + 1, row * size * 4, (row + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND')
  ]);
}

const icons = new Map();

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const requested = Number(req.query?.size);
  const size = requested === 512 ? 512 : 192;
  if (!icons.has(size)) icons.set(size, createIcon(size));

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Length', String(icons.get(size).length));
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).end(icons.get(size));
}
