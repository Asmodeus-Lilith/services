// src/lib/upload.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30 MB per upload

/**
 * Detect image type and safe extension from magic bytes.
 * Validates real file contents, not just client-supplied MIME headers.
 */
function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 4) === 'GIF8') {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

/**
 * Stream reader that accumulates request body up to maxBytes.
 */
async function collectStreamBuffer(req, maxBytes = MAX_TOTAL_SIZE) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error(`Upload payload exceeds maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))} MB`);
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Minimal RFC 7578 multipart/form-data parser for file uploads in pure Node.js.
 */
function parseMultipartBody(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const files = [];
  let offset = 0;

  while (offset < buffer.length) {
    const startIdx = buffer.indexOf(delimiter, offset);
    if (startIdx === -1) break;

    const afterDelimiter = startIdx + delimiter.length;
    // Closing boundary check: --boundary--
    if (buffer[afterDelimiter] === 0x2D && buffer[afterDelimiter + 1] === 0x2D) {
      break;
    }

    const nextIdx = buffer.indexOf(delimiter, afterDelimiter);
    if (nextIdx === -1) break;

    const part = buffer.subarray(afterDelimiter, nextIdx);
    const crlf2 = Buffer.from('\r\n\r\n');
    const headerEnd = part.indexOf(crlf2);
    if (headerEnd !== -1) {
      let headerStart = 0;
      if (part[0] === 0x0D && part[1] === 0x0A) headerStart = 2;
      else if (part[0] === 0x0A) headerStart = 1;

      const headerStr = part.subarray(headerStart, headerEnd).toString('utf8');
      let bodyEnd = part.length;
      if (bodyEnd >= 2 && part[bodyEnd - 2] === 0x0D && part[bodyEnd - 1] === 0x0A) {
        bodyEnd -= 2;
      } else if (bodyEnd >= 1 && part[bodyEnd - 1] === 0x0A) {
        bodyEnd -= 1;
      }

      const body = part.subarray(headerEnd + 4, bodyEnd);
      const filenameMatch = headerStr.match(/filename="([^"]+)"|filename=([^\s;]+)/i);
      const filename = filenameMatch ? (filenameMatch[1] || filenameMatch[2]) : null;

      const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n;]+)/i);
      const contentType = typeMatch ? typeMatch[1].trim() : null;

      const nameMatch = headerStr.match(/name="([^"]+)"|name=([^\s;]+)/i);
      const fieldName = nameMatch ? (nameMatch[1] || nameMatch[2]) : null;

      if (filename || (contentType && contentType.startsWith('image/'))) {
        files.push({
          fieldName,
          filename: filename || 'image',
          contentType,
          data: body
        });
      }
    }
    offset = nextIdx;
  }
  return files;
}

/**
 * Saves an image buffer to disk with an unguessable unique name.
 */
async function saveImageFile(fileBuffer, originalName = '') {
  if (!fileBuffer || fileBuffer.length === 0) {
    const error = new Error('Empty file received');
    error.status = 400;
    throw error;
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    const error = new Error(`File exceeds maximum size of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`);
    error.status = 413;
    throw error;
  }

  const detected = detectImageType(fileBuffer);
  if (!detected) {
    const error = new Error('Invalid image format. Supported formats: JPG, PNG, WebP, and GIF.');
    error.status = 400;
    throw error;
  }

  const uploadsDir = config.uploadsDir;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const safeFilename = `service-${uniqueId}.${detected.ext}`;
  const filePath = path.join(uploadsDir, safeFilename);

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    url: `/api/uploads/${safeFilename}`,
    name: safeFilename,
    originalName: path.basename(originalName || safeFilename),
    size: fileBuffer.length,
    mimeType: detected.mime
  };
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  detectImageType,
  collectStreamBuffer,
  parseMultipartBody,
  saveImageFile
};

