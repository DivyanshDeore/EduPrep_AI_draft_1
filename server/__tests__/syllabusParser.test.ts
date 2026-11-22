import { describe, expect, it } from 'vitest';
import { extractSyllabusFromBuffer, sanitizeFilename } from '../syllabusParser.ts';

describe('syllabusParser', () => {
  it('sanitizes unsafe path traversal characters in filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(sanitizeFilename('CS314_Syllabus (Fall).pdf')).toBe('CS314_Syllabus _Fall_.pdf');
  });

  it('extracts normalized UTF-8 text from valid plain-text syllabi', async () => {
    const content = 'Course: CS 314 Distributed Systems\r\nWeek 1: Logical Clocks\r\nWeek 2: Raft Consensus';
    const result = await extractSyllabusFromBuffer(
      'cs314.txt',
      'text/plain',
      Buffer.from(content, 'utf-8')
    );

    expect(result.fileType).toBe('txt');
    expect(result.fileName).toBe('cs314.txt');
    expect(result.extractedText).toContain('Week 1: Logical Clocks');
    expect(result.extractedText).not.toContain('\r\n');
  });

  it('rejects empty or oversized files', async () => {
    await expect(
      extractSyllabusFromBuffer('empty.txt', 'text/plain', Buffer.alloc(0))
    ).rejects.toThrow(/empty/i);

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);
    await expect(
      extractSyllabusFromBuffer('big.txt', 'text/plain', oversized)
    ).rejects.toThrow(/10 MB/i);
  });

  it('rejects spoofed PDF, DOCX, binary TXT, and unsupported extensions via magic-byte checks', async () => {
    await expect(
      extractSyllabusFromBuffer('fake.pdf', 'application/pdf', Buffer.from('not a pdf', 'utf-8'))
    ).rejects.toThrow(/Invalid PDF signature/i);

    await expect(
      extractSyllabusFromBuffer(
        'fake.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        Buffer.from('not a zip archive', 'utf-8')
      )
    ).rejects.toThrow(/Invalid DOCX signature/i);

    await expect(
      extractSyllabusFromBuffer('binary.txt', 'text/plain', Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6f]))
    ).rejects.toThrow(/Binary content detected/i);

    await expect(
      extractSyllabusFromBuffer('script.sh', 'application/x-sh', Buffer.from('#!/bin/sh\necho hi'))
    ).rejects.toThrow(/Unsupported file type/i);
  });
});
