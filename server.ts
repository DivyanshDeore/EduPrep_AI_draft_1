import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  animateImageToVideo,
  CHAT_MODELS,
  extractSyllabusStructure,
  GeminiServiceError,
  generateChatReply,
  generateLecturePreCap,
  generateStudyNotes,
  generateStudySummary,
  getDefaultModel,
  isGeminiConfigured,
  searchGroundedResources,
} from './server/geminiService.ts';
import { extractSyllabusFromBuffer } from './server/syllabusParser.ts';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

// CORS configuration
const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || ''
)
  .split(',')
  .map(origin => origin.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Security headers (iframe-compatible in AI Studio)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1,
  },
});

function handleApiError(res: Response, err: unknown) {
  if (err instanceof GeminiServiceError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit.' : err.message,
      code: 'UPLOAD_ERROR',
    });
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  return res.status(400).json({
    error: message,
    code: 'BAD_REQUEST',
  });
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'EduPrep AI',
    aiConfigured: isGeminiConfigured(),
    defaultModel: getDefaultModel(),
    timestamp: new Date().toISOString(),
  });
});

// AI Configuration Status (never exposes API key)
app.get('/api/ai/status', (_req: Request, res: Response) => {
  res.json({
    configured: isGeminiConfigured(),
    defaultModel: getDefaultModel(),
    availableModels: CHAT_MODELS,
    videoModels: [
      {
        id: 'gemini-omni-1.2-flash',
        label: 'Gemini Omni 1.2 Flash',
        subtitle: 'Image-to-Video Animation (16:9 & 9:16)',
        tier: 'paid',
      },
    ],
  });
});

// Syllabus Upload & Parse (PDF, DOCX, TXT) or Raw Text
app.post('/api/syllabus/parse', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let rawText = '';
    let fileName = 'pasted-syllabus.txt';
    let fileType: 'pdf' | 'txt' | 'docx' | 'pasted' = 'pasted';
    let fileSize = 0;

    if (req.file) {
      const parsed = await extractSyllabusFromBuffer(
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer
      );
      rawText = parsed.extractedText;
      fileName = parsed.fileName;
      fileType = parsed.fileType;
      fileSize = parsed.fileSize;
    } else if (typeof req.body?.rawText === 'string' && req.body.rawText.trim()) {
      rawText = req.body.rawText.trim().slice(0, 120000);
      fileName = typeof req.body.fileName === 'string' && req.body.fileName.trim()
        ? req.body.fileName.trim().slice(0, 180)
        : 'pasted-syllabus.txt';
      fileSize = Buffer.byteLength(rawText, 'utf-8');
    } else {
      return res.status(400).json({
        error: 'Please upload a PDF, DOCX, or TXT file, or provide syllabus text.',
        code: 'MISSING_SYLLABUS_INPUT',
      });
    }

    const modelOverride = typeof req.body?.model === 'string' ? req.body.model : undefined;
    let structured = null;
    let aiWarning: string | null = null;

    if (isGeminiConfigured()) {
      try {
        structured = await extractSyllabusStructure(rawText, fileName, modelOverride);
      } catch (aiErr) {
        const mapped = aiErr instanceof GeminiServiceError ? aiErr : null;
        aiWarning = mapped ? mapped.message : 'AI topic extraction failed; you can review and add topics manually.';
      }
    } else {
      aiWarning = 'GEMINI_API_KEY is not configured. Text extraction succeeded; add or edit subject topics below.';
    }

    return res.json({
      fileName,
      fileType,
      fileSize,
      extractedText: rawText,
      structured,
      aiWarning,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Generate AI Study Notes
app.post('/api/ai/notes', async (req: Request, res: Response) => {
  try {
    const { subjectTitle, subjectCode, topicTitle, topicDescription, syllabusContext, customInstructions, model } =
      req.body || {};

    if (!subjectTitle || typeof subjectTitle !== 'string' || !topicTitle || typeof topicTitle !== 'string') {
      return res.status(400).json({
        error: 'Both subjectTitle and topicTitle are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const notes = await generateStudyNotes({
      subjectTitle: subjectTitle.trim().slice(0, 160),
      subjectCode: typeof subjectCode === 'string' ? subjectCode.trim().slice(0, 32) : undefined,
      topicTitle: topicTitle.trim().slice(0, 200),
      topicDescription: typeof topicDescription === 'string' ? topicDescription.trim().slice(0, 2000) : undefined,
      syllabusContext: typeof syllabusContext === 'string' ? syllabusContext.trim().slice(0, 6000) : undefined,
      customInstructions: typeof customInstructions === 'string' ? customInstructions.trim().slice(0, 600) : undefined,
      modelOverride: typeof model === 'string' ? model : undefined,
    });

    return res.json({ ...notes, aiAssisted: true });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Generate AI Study Summary
app.post('/api/ai/summary', async (req: Request, res: Response) => {
  try {
    const { title, sourceText, focusMode, model } = req.body || {};

    if (!sourceText || typeof sourceText !== 'string' || sourceText.trim().length < 20) {
      return res.status(400).json({
        error: 'Please provide at least 20 characters of study material to summarize.',
        code: 'VALIDATION_ERROR',
      });
    }

    const summary = await generateStudySummary({
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 180) : 'Study Summary',
      sourceText: sourceText.trim().slice(0, 30000),
      focusMode: focusMode === 'concise' || focusMode === 'exam' ? focusMode : 'balanced',
      modelOverride: typeof model === 'string' ? model : undefined,
    });

    return res.json({ ...summary, aiAssisted: true });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Generate Lecture Pre-Cap
app.post('/api/ai/precap', async (req: Request, res: Response) => {
  try {
    const { subjectTitle, subjectCode, topicTitle, topicDescription, lectureDetails, syllabusContext, includeResources, model } =
      req.body || {};

    if (!subjectTitle || typeof subjectTitle !== 'string' || !topicTitle || typeof topicTitle !== 'string') {
      return res.status(400).json({
        error: 'Both subjectTitle and topicTitle are required to generate a lecture pre-cap.',
        code: 'VALIDATION_ERROR',
      });
    }

    const precap = await generateLecturePreCap({
      subjectTitle: subjectTitle.trim().slice(0, 160),
      subjectCode: typeof subjectCode === 'string' ? subjectCode.trim().slice(0, 32) : undefined,
      topicTitle: topicTitle.trim().slice(0, 200),
      topicDescription: typeof topicDescription === 'string' ? topicDescription.trim().slice(0, 2000) : undefined,
      lectureDetails: typeof lectureDetails === 'string' ? lectureDetails.trim().slice(0, 240) : undefined,
      syllabusContext: typeof syllabusContext === 'string' ? syllabusContext.trim().slice(0, 6000) : undefined,
      modelOverride: typeof model === 'string' ? model : undefined,
    });

    let suggestedResources: { title: string; source: string; resourceType: string; url: string }[] = [];
    if (includeResources) {
      try {
        const resResult = await searchGroundedResources({
          subjectTitle: subjectTitle.trim(),
          topicTitle: topicTitle.trim(),
        });
        suggestedResources = (resResult.resources.length > 0 ? resResult.resources : resResult.fallbackSearchLinks)
          .slice(0, 4)
          .map((r) => ({
            title: r.title,
            source: r.source,
            resourceType: r.resourceType,
            url: r.url,
          }));
      } catch {
        // Non-fatal: pre-cap succeeds even if search grounding fails
      }
    }

    return res.json({
      ...precap,
      suggestedResources,
      aiAssisted: true,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Grounded Learning Resources Search
app.post('/api/ai/resources', async (req: Request, res: Response) => {
  try {
    const { subjectTitle, topicTitle, query } = req.body || {};

    if (
      (!subjectTitle || typeof subjectTitle !== 'string') &&
      (!query || typeof query !== 'string')
    ) {
      return res.status(400).json({
        error: 'Provide a subjectTitle or search query.',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await searchGroundedResources({
      subjectTitle: typeof subjectTitle === 'string' ? subjectTitle.trim().slice(0, 160) : '',
      topicTitle: typeof topicTitle === 'string' ? topicTitle.trim().slice(0, 200) : undefined,
      query: typeof query === 'string' ? query.trim().slice(0, 200) : undefined,
    });

    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Multi-Turn AI Academic Chatbot
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemInstruction, model } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return res.status(400).json({
        error: 'Provide between 1 and 40 chat messages.',
        code: 'VALIDATION_ERROR',
      });
    }

    const sanitizedMessages = messages.map((m: unknown) => {
      const obj = (m || {}) as Record<string, unknown>;
      const role = obj.role === 'model' ? ('model' as const) : obj.role === 'user' ? ('user' as const) : null;
      const text = typeof obj.text === 'string' ? obj.text.trim().slice(0, 8000) : '';
      return { role, text };
    });

    if (sanitizedMessages.some((m) => !m.role || !m.text)) {
      return res.status(400).json({
        error: 'Every message must include a valid role ("user" or "model") and non-empty text.',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await generateChatReply({
      messages: sanitizedMessages as { role: 'user' | 'model'; text: string }[],
      systemInstruction:
        typeof systemInstruction === 'string' ? systemInstruction.trim().slice(0, 2500) : undefined,
      modelOverride: typeof model === 'string' ? model : undefined,
    });

    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
});

function detectImageMagicMime(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// Image-to-Video Animation (Gemini Omni 1.2 Flash Interactions API)
app.post('/api/ai/animate-video', upload.single('image'), async (req: Request, res: Response) => {
  req.setTimeout(320000);
  res.setTimeout(320000);
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Please upload a PNG, JPEG, or WebP image file.',
        code: 'MISSING_IMAGE',
      });
    }

    const detectedMime = detectImageMagicMime(req.file.buffer);
    if (!detectedMime) {
      return res.status(400).json({
        error: 'Unsupported or corrupted image file. Only valid PNG, JPEG, and WebP images are allowed.',
        code: 'INVALID_IMAGE_FORMAT',
      });
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 1000) : '';
    if (!prompt) {
      return res.status(400).json({
        error: 'Please provide an animation motion prompt describing how the image should move.',
        code: 'MISSING_PROMPT',
      });
    }

    const rawAspect = typeof req.body?.aspectRatio === 'string' ? req.body.aspectRatio.trim() : '16:9';
    if (rawAspect !== '16:9' && rawAspect !== '9:16') {
      return res.status(400).json({
        error: 'Aspect ratio must be 16:9 (landscape) or 9:16 (portrait).',
        code: 'INVALID_ASPECT_RATIO',
      });
    }

    const result = await animateImageToVideo({
      imageBuffer: req.file.buffer,
      mimeType: detectedMime,
      prompt,
      aspectRatio: rawAspect,
    });

    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// Error middleware for Multer / JSON syntax errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  return handleApiError(res, err);
});



async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduPrep AI API running on port ${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error('Failed to start EduPrep AI:', error);
    process.exit(1);
  });
}


if (!process.env.VERCEL) {
  startServer();
}
