import { afterEach, describe, expect, it } from 'vitest';
import {
  animateImageToVideo,
  buildDirectSearchLinks,
  GeminiServiceError,
  generateChatReply,
  generateStudyNotes,
  getDefaultModel,
  isGeminiConfigured,
  resolveModel,
  searchGroundedResources,
} from '../geminiService.ts';

describe('geminiService', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;

    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  });

  it('detects missing and placeholder Gemini API keys safely', () => {
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'your_gemini_api_key_here';
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'test-configured-key-value';
    expect(isGeminiConfigured()).toBe(true);
  });

  it('resolves all four supported Gemini models within the allowlist', () => {
    delete process.env.GEMINI_MODEL;
    expect(getDefaultModel()).toBe('gemini-4-hydrogen');

    process.env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
    expect(getDefaultModel()).toBe('gemini-3.1-flash-lite');

    process.env.GEMINI_MODEL = 'arbitrary-unsupported-model';
    expect(getDefaultModel()).toBe('gemini-4-hydrogen');

    expect(resolveModel('gemini-4-hydrogen')).toBe('gemini-4-hydrogen');
    expect(resolveModel('gemini-3.1-flash-lite')).toBe('gemini-3.1-flash-lite');
    expect(resolveModel('gemini-4-neon')).toBe('gemini-4-neon');
    expect(resolveModel('gemini-4-carbon')).toBe('gemini-4-carbon');
    expect(resolveModel('unknown-model')).toBe('gemini-4-hydrogen');
  });

  it('throws AI_KEY_MISSING when generating notes without a configured API key', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      generateStudyNotes({
        subjectTitle: 'Distributed Systems',
        topicTitle: 'Raft Consensus',
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'AI_KEY_MISSING',
      statusCode: 503,
    } satisfies Partial<GeminiServiceError>);
  });

  it('validates chat message turns and throws AI_KEY_MISSING when unconfigured', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      generateChatReply({
        messages: [],
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    } satisfies Partial<GeminiServiceError>);

    await expect(
      generateChatReply({
        messages: [{ role: 'model', text: 'Only model reply without user turn' }],
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    } satisfies Partial<GeminiServiceError>);

    await expect(
      generateChatReply({
        messages: [{ role: 'user', text: 'Explain Raft leader election invariants.' }],
        modelOverride: 'gemini-4-carbon',
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'AI_KEY_MISSING',
      statusCode: 503,
    } satisfies Partial<GeminiServiceError>);
  });

  it('validates image-to-video inputs and throws AI_KEY_MISSING when unconfigured', async () => {
    delete process.env.GEMINI_API_KEY;
    const dummyBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    await expect(
      animateImageToVideo({
        imageBuffer: dummyBuffer,
        mimeType: 'image/png',
        prompt: 'Orbit camera around diagram',
        aspectRatio: '4:3' as '16:9',
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    } satisfies Partial<GeminiServiceError>);

    await expect(
      animateImageToVideo({
        imageBuffer: dummyBuffer,
        mimeType: 'image/png',
        prompt: '   ',
        aspectRatio: '16:9',
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    } satisfies Partial<GeminiServiceError>);

    await expect(
      animateImageToVideo({
        imageBuffer: dummyBuffer,
        mimeType: 'image/png',
        prompt: 'Slowly orbit camera around the diagram.',
        aspectRatio: '9:16',
      })
    ).rejects.toMatchObject({
      name: 'GeminiServiceError',
      code: 'AI_KEY_MISSING',
      statusCode: 503,
    } satisfies Partial<GeminiServiceError>);
  });

  it('returns direct verified educational search links without fabricating URLs when unconfigured', async () => {
    delete process.env.GEMINI_API_KEY;
    const links = buildDirectSearchLinks('Raft consensus');
    expect(links).toHaveLength(3);
    expect(links.every((l) => l.url.startsWith('https://') && l.isGrounded === false)).toBe(true);

    const res = await searchGroundedResources({
      subjectTitle: 'Distributed Systems',
      topicTitle: 'Raft Consensus',
    });
    expect(res.grounded).toBe(false);
    expect(res.resources).toEqual([]);
    expect(res.fallbackSearchLinks).toHaveLength(3);
    expect(res.summaryNote).toMatch(/GEMINI_API_KEY/i);
  });
});

