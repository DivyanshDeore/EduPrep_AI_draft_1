import React, { useEffect, useState } from 'react';
import {
  ChevronRight,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { apiClient } from '../services/apiClient.ts';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const PROMPT_PRESETS = [
  'Slowly orbit camera around the main subject with crisp depth and subtle lighting shift.',
  'Animate smooth ink-flow arrows and gentle pulsing highlights across the scientific diagram.',
  'Subtle cinematic push-in zoom focusing toward the center structure with natural ambient motion.',
];

export function AnimateImagePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [generatedVideo, setGeneratedVideo] = useState<{
    dataUrl: string;
    mimeType: string;
    aspectRatio: '16:9' | '9:16';
    modelUsed: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setErrorMsg('Please select a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg('Image exceeds the 10 MB maximum file size.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setGeneratedVideo(null);
  };

  const handleClearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedVideo(null);
    setErrorMsg(null);
  };

  const handleAnimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Upload a reference image first.');
      return;
    }
    if (!prompt.trim()) {
      setErrorMsg('Describe how you want the image to animate.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt.trim());
      formData.append('aspectRatio', aspectRatio);

      const res = await apiClient.animateImageToVideo(formData);
      const dataUrl = `data:${res.mimeType};base64,${res.videoBase64}`;
      setGeneratedVideo({
        dataUrl,
        mimeType: res.mimeType,
        aspectRatio: res.aspectRatio,
        modelUsed: res.modelUsed,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Video animation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadVideo = () => {
    if (!generatedVideo) return;
    const a = document.createElement('a');
    a.href = generatedVideo.dataUrl;
    const ext = generatedVideo.mimeType.includes('webm') ? 'webm' : 'mp4';
    a.download = `eduprep-animation-${generatedVideo.aspectRatio.replace(':', 'x')}.${ext}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Stitch Context Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400">
            <span>Academic Intelligence</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#630ed4] dark:text-violet-400">Image-to-Video Studio</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
              Animate Image into Video
            </h1>
            <span className="text-xs font-mono font-semibold text-[#005b3d] dark:text-emerald-400">
              · gemini-omni-1.2-flash
            </span>
          </div>
        </div>

        <span className="text-xs font-medium text-[#4a4455] dark:text-slate-400">
          Bring lecture diagrams, historical photos, and figures to life
        </span>
      </div>

      <AiSetupBanner contextLabel="Gemini Omni 1.2 Flash image-to-video generation" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT CONTROLS */}
        <form
          onSubmit={handleAnimate}
          className="col-span-12 lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card space-y-5"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
              Source Frame 01
            </span>
            <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
              Upload Reference Photo
            </h2>
          </div>

          {!previewUrl ? (
            <label className="block border-2 border-dashed border-[#ccc3d8] dark:border-slate-700 hover:border-[#7c3aed] rounded-xl p-8 text-center cursor-pointer transition-colors bg-[#f2f3ff]/60 dark:bg-slate-800/60">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
                className="sr-only"
              />
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 text-[#7c3aed] flex items-center justify-center mx-auto mb-3 shadow-xs">
                <ImagePlus className="w-6 h-6" />
              </div>
              <p className="font-display text-sm font-semibold text-[#131b2e] dark:text-slate-100">
                Click to choose a PNG, JPEG, or WebP photo
              </p>
              <p className="mt-1 text-xs text-[#7b7487] dark:text-slate-400">
                Max 10 MB · Validated server-side before processing
              </p>
            </label>
          ) : (
            <div className="rounded-xl bg-[#f2f3ff] dark:bg-slate-800/70 p-3 space-y-2.5">
              <div className="relative rounded-lg overflow-hidden bg-slate-950/10 flex items-center justify-center max-h-60">
                <img
                  src={previewUrl}
                  alt={selectedFile?.name || 'Uploaded frame'}
                  className="max-h-60 w-auto object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#131b2e] dark:text-slate-200 truncate">
                  {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          {/* Aspect Ratio Toggle */}
          <div className="space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
              Output Aspect Ratio
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`p-3.5 rounded-xl text-left transition-all flex items-center gap-3 ${
                  aspectRatio === '16:9'
                    ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/40 ring-1 ring-[#7c3aed]/50 shadow-xs'
                    : 'bg-[#f2f3ff] dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                }`}
              >
                <Monitor
                  className={`w-5 h-5 shrink-0 ${
                    aspectRatio === '16:9' ? 'text-[#630ed4] dark:text-violet-400' : 'text-[#7b7487]'
                  }`}
                />
                <div>
                  <p className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                    16:9 Landscape
                  </p>
                  <p className="text-[11px] text-[#7b7487] dark:text-slate-400">
                    Lecture slides &amp; desktop
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`p-3.5 rounded-xl text-left transition-all flex items-center gap-3 ${
                  aspectRatio === '9:16'
                    ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/40 ring-1 ring-[#7c3aed]/50 shadow-xs'
                    : 'bg-[#f2f3ff] dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                }`}
              >
                <Smartphone
                  className={`w-5 h-5 shrink-0 ${
                    aspectRatio === '9:16' ? 'text-[#630ed4] dark:text-violet-400' : 'text-[#7b7487]'
                  }`}
                />
                <div>
                  <p className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                    9:16 Portrait
                  </p>
                  <p className="text-[11px] text-[#7b7487] dark:text-slate-400">
                    Mobile study reels
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Motion Prompt */}
          <div className="space-y-2">
            <label
              htmlFor="motion-prompt"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400"
            >
              Motion &amp; Camera Prompt
            </label>
            <textarea
              id="motion-prompt"
              rows={3}
              maxLength={1000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how camera movement, lighting, or elements inside the image should animate..."
              className="w-full p-3 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
            />
            <div className="space-y-1.5 pt-1">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPrompt(preset)}
                  className="w-full text-left px-3 py-1.5 rounded-lg bg-[#faf8ff] dark:bg-slate-800/60 hover:bg-[#eaedff] dark:hover:bg-slate-800 text-[11px] text-[#4a4455] dark:text-slate-300 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={generating || !selectedFile || !prompt.trim()}
            className="w-full h-11 px-5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Video with Omni Flash...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Animate Image ({aspectRatio})</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-[#7b7487] dark:text-slate-400 leading-relaxed">
            Uses <code className="font-mono">gemini-omni-1.2-flash</code> via the Interactions API (takes ~30–120 seconds; requires a billing-enabled Gemini API key).
          </p>
        </form>

        {/* RIGHT OUTPUT STAGE */}
        <section className="col-span-12 lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                Output Stage 02
              </span>
              <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
                Generated Video Preview ({aspectRatio})
              </h2>
            </div>

            {generatedVideo && (
              <button
                type="button"
                onClick={handleDownloadVideo}
                className="px-4 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-400 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Video</span>
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#f2f3ff] dark:bg-slate-950/60 p-6 flex items-center justify-center min-h-[420px]">
            {generating ? (
              <div className="text-center max-w-sm space-y-3">
                <Loader2 className="w-10 h-10 text-[#7c3aed] animate-spin mx-auto" />
                <p className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                  Synthesizing {aspectRatio} animation...
                </p>
                <p className="text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                  Gemini Omni 1.2 Flash is animating your image. Please keep this tab open until playback appears.
                </p>
              </div>
            ) : generatedVideo ? (
              <div
                className={`w-full overflow-hidden rounded-xl bg-black shadow-lg ${
                  generatedVideo.aspectRatio === '9:16'
                    ? 'max-w-[300px] aspect-[9/16]'
                    : 'aspect-video'
                }`}
              >
                <video
                  controls
                  autoPlay
                  loop
                  playsInline
                  src={generatedVideo.dataUrl}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="text-center max-w-sm space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 text-[#630ed4] dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
                  Your animated clip will render here
                </h3>
                <p className="text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                  Upload a slide diagram, illustration, or photo on the left, choose 16:9 or 9:16 framing, and click Animate Image.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
