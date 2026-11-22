import mammoth from 'mammoth';
import { extractText } from 'unpdf';

export type SupportedFileType = 'pdf' | 'txt' | 'docx';

export interface ParsedFileResult {
  fileName: string;
  fileType: SupportedFileType;
  fileSize: number;
  extractedText: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 120000;

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\s]/g, '_').slice(0, 200) || 'syllabus';
}

function detectFileType(fileName: string, mimeType: string, buffer: Buffer): SupportedFileType {
  const lower = fileName.toLowerCase();

  // Check magic bytes for PDF (%PDF-)
  const isPdfMagic =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  // Check magic bytes for DOCX (ZIP PK header: 50 4B 03 04)
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    if (!isPdfMagic) {
      throw new Error('Invalid PDF signature. The uploaded file does not appear to be a valid PDF document.');
    }
    return 'pdf';
  }

  if (
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    if (!isZipMagic) {
      throw new Error('Invalid DOCX signature. Please upload a valid .docx document.');
    }
    return 'docx';
  }

  if (lower.endsWith('.txt') || mimeType === 'text/plain' || mimeType === 'text/markdown') {
    // Reject binary files disguised as .txt by checking for null bytes
    if (buffer.includes(0x00)) {
      throw new Error('Binary content detected in text upload. Only UTF-8 plain text files are permitted.');
    }
    return 'txt';
  }

  throw new Error('Unsupported file type. Only PDF (.pdf), Word (.docx), and plain text (.txt) syllabi are supported.');
}

export async function extractSyllabusFromBuffer(
  originalName: string,
  mimeType: string,
  buffer: Buffer
): Promise<ParsedFileResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('File exceeds the 10 MB upload limit.');
  }

  const safeName = sanitizeFilename(originalName);
  const fileType = detectFileType(safeName, mimeType, buffer);

  let rawText = '';

  if (fileType === 'txt') {
    rawText = buffer.toString('utf-8');
  } else if (fileType === 'pdf') {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    rawText = Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '');
  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || '';
  }

  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();

  if (!normalized) {
    throw new Error('No readable text could be extracted from the uploaded file. If this is a scanned PDF, try pasting the syllabus text.');
  }

  return {
    fileName: safeName,
    fileType,
    fileSize: buffer.length,
    extractedText: normalized.slice(0, MAX_TEXT_CHARS),
  };
}
