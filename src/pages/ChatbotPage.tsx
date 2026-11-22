import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Copy,
  Check,
  Cpu,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import {
  createChatSession,
  deleteChatSession,
  updateChatSession,
} from '../services/firestoreService.ts';
import { ChatMessage, ChatModelId } from '../types/academic.ts';

interface ModelOption {
  id: ChatModelId;
  label: string;
  taskFit: string;
  summary: string;
  tier: 'standard' | 'paid';
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    taskFit: 'General Tasks',
    summary: 'Balanced academic reasoning, study Q&A, and concept synthesis.',
    tier: 'standard',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    taskFit: 'Fast Tasks',
    summary: 'Ultra-low-latency answers, rapid definitions, and quick drills.',
    tier: 'standard',
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    taskFit: 'Complex Interactive Tasks',
    summary: 'Multi-step interactive tutoring, worked examples, and coding help.',
    tier: 'paid',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    taskFit: 'Deep Reasoning Tasks',
    summary: 'Rigorous proofs, theoretical derivations, and deep algorithmic critique.',
    tier: 'paid',
  },
];

const ROLE_PRESETS = [
  {
    id: 'tutor',
    label: 'Academic Tutor',
    instruction:
      'You are EduPrep AI, a rigorous and encouraging university teaching assistant. Explain concepts clearly, highlight assumptions, check edge cases, and offer concise follow-up questions.',
  },
  {
    id: 'socratic',
    label: 'Socratic Coach',
    instruction:
      'Guide the student step-by-step using targeted hints and probing questions instead of giving away the complete answer immediately. Confirm understanding at each step.',
  },
  {
    id: 'exam',
    label: 'Exam Drill Reviewer',
    instruction:
      'Focus on high-yield exam concepts, common pitfalls, formal definitions, and concise step-by-step problem solutions.',
  },
  {
    id: 'custom',
    label: 'Custom Instruction',
    instruction: '',
  },
] as const;

const STARTER_PROMPTS = [
  'Walk me through an intuitive proof and edge cases for this week’s main theorem.',
  'Quiz me with 3 progressively harder conceptual questions and grade my answers.',
  'Compare the tradeoffs between the core approaches in this course module.',
];

export function ChatbotPage() {
  const { user, profile } = useAuth();
  const { subjects, topics, chatSessions } = useAcademicData();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ChatModelId>(() => {
    const pref = profile?.preferredModel as ChatModelId | undefined;
    if (pref && MODEL_OPTIONS.some((m) => m.id === pref)) return pref;
    return 'gemini-4-hydrogen';
  });
  const [presetId, setPresetId] = useState<string>('tutor');
  const [systemInstruction, setSystemInstruction] = useState<string>(ROLE_PRESETS[0].instruction);
  const [contextSubjectId, setContextSubjectId] = useState<string>('');

  const [draftMessages, setDraftMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(
    () => chatSessions.find((s) => s.id === activeSessionId) || null,
    [chatSessions, activeSessionId]
  );

  // Sync draft state when switching saved sessions
  useEffect(() => {
    if (activeSession) {
      setSelectedModel(activeSession.model);
      setSystemInstruction(activeSession.systemInstruction || '');
      setDraftMessages(activeSession.messages || []);
    }
  }, [activeSession]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [draftMessages.length, sending]);

  const effectiveSystemInstruction = useMemo(() => {
    const base = systemInstruction.trim();
    if (!contextSubjectId) return base;
    const subject = subjects.find((s) => s.id === contextSubjectId);
    if (!subject) return base;
    const subTopics = topics
      .filter((t) => t.subjectId === subject.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .slice(0, 15)
      .map((t) => `#${t.orderIndex} ${t.title}`)
      .join(', ');
    const coursePrefix = `Active Course Context: ${subject.code} - ${subject.title}${
      subTopics ? ` (Topics: ${subTopics})` : ''
    }.`;
    return [coursePrefix, base].filter(Boolean).join('\n\n').slice(0, 2500);
  }, [systemInstruction, contextSubjectId, subjects, topics]);

  const handleStartNewChat = () => {
    setActiveSessionId(null);
    setDraftMessages([]);
    setErrorMsg(null);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setErrorMsg(null);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChatSession(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setDraftMessages([]);
    }
  };

  const handlePresetChange = (id: string) => {
    setPresetId(id);
    const found = ROLE_PRESETS.find((p) => p.id === id);
    if (found && id !== 'custom') {
      setSystemInstruction(found.instruction);
    }
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const content = (overrideText ?? inputText).trim();
    if (!content || sending) return;

    const userTurn: ChatMessage = {
      role: 'user',
      text: content,
      createdAtIso: new Date().toISOString(),
    };

    const nextMessages = [...draftMessages, userTurn];
    setDraftMessages(nextMessages);
    if (!overrideText) setInputText('');
    setSending(true);
    setErrorMsg(null);

    try {
      let currentSessionId = activeSessionId;

      if (user) {
        if (!currentSessionId) {
          const title = content.slice(0, 64) + (content.length > 64 ? '...' : '');
          currentSessionId = await createChatSession(user.uid, {
            title,
            model: selectedModel,
            systemInstruction: effectiveSystemInstruction,
            messages: nextMessages,
          });
          setActiveSessionId(currentSessionId);
        } else {
          await updateChatSession(currentSessionId, {
            model: selectedModel,
            systemInstruction: effectiveSystemInstruction,
            messages: nextMessages,
          });
        }
      }

      const response = await apiClient.sendChatMessage({
        messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
        systemInstruction: effectiveSystemInstruction || undefined,
        model: selectedModel,
      });

      const modelTurn: ChatMessage = {
        role: 'model',
        text: response.reply,
        createdAtIso: new Date().toISOString(),
      };
      const updatedMessages = [...nextMessages, modelTurn];
      setDraftMessages(updatedMessages);

      if (user && currentSessionId) {
        await updateChatSession(currentSessionId, {
          model: selectedModel,
          systemInstruction: effectiveSystemInstruction,
          messages: updatedMessages,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reach Gemini chat service.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeModelMeta =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];

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
            <span className="text-[#630ed4] dark:text-violet-400">AI Academic Chatbot</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
              AI Academic Chatbot
            </h1>
            <span className="text-xs font-mono font-semibold text-[#005b3d] dark:text-emerald-400">
              · {activeModelMeta.id}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartNewChat}
          className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-[13px] font-semibold hover:bg-[#6d28d9] active:scale-[0.98] transition-all shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>New Study Thread</span>
        </button>
      </div>

      <AiSetupBanner contextLabel="Multi-turn Gemini academic chat" />

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT SIDEBAR: Model Selector, System Instructions, Saved Threads */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Model Selector Card */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 workspace-card space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                  Engine Selector
                </span>
                <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
                  Gemini Chat Model
                </h2>
              </div>
              <Cpu className="w-5 h-5 text-[#630ed4] dark:text-violet-400 shrink-0" />
            </div>

            <div className="space-y-2">
              {MODEL_OPTIONS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/35 ring-1 ring-[#7c3aed]/50 shadow-xs'
                        : 'bg-[#f2f3ff] dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                        {m.label}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-[#630ed4] dark:text-violet-400">
                        {m.taskFit}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                      {m.summary}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-[#7b7487] dark:text-slate-400">
                      <span>{m.id}</span>
                      {m.tier === 'paid' && (
                        <span className="font-sans text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          Paid Key Recommended
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* System Instruction & Course Grounding Card */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 workspace-card space-y-3.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                Behavior &amp; Persona
              </span>
              <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
                System Instructions
              </h2>
            </div>

            {subjects.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400 mb-1.5">
                  Attach Course Context (Optional)
                </label>
                <select
                  value={contextSubjectId}
                  onChange={(e) => setContextSubjectId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 border border-[#ccc3d8]/50 dark:border-slate-700 text-xs font-medium text-[#131b2e] dark:text-slate-100"
                >
                  <option value="">General Academic Assistant (No course filter)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    presetId === preset.id
                      ? 'bg-[#7c3aed] text-white'
                      : 'bg-[#f2f3ff] dark:bg-slate-800 text-[#4a4455] dark:text-slate-300 hover:bg-[#eaedff] dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div>
              <label
                htmlFor="system-instruction-input"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400 mb-1.5"
              >
                Custom System Instruction
              </label>
              <textarea
                id="system-instruction-input"
                rows={4}
                maxLength={2500}
                value={systemInstruction}
                onChange={(e) => {
                  setPresetId('custom');
                  setSystemInstruction(e.target.value);
                }}
                placeholder="Guide how Gemini responds (tone, level of rigor, Socratic hints, citation format)..."
                className="w-full p-3 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 border border-[#ccc3d8]/50 dark:border-slate-700 text-xs text-[#131b2e] dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              />
            </div>
          </section>

          {/* Saved Conversations Card */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 workspace-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                Saved Study Threads ({chatSessions.length})
              </h2>
            </div>

            {chatSessions.length === 0 ? (
              <p className="text-xs text-[#7b7487] dark:text-slate-400 py-2">
                Your multi-turn conversations are persisted here automatically once you send a message.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {chatSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`p-3 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                        isActive
                          ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/40 ring-1 ring-[#7c3aed]/40'
                          : 'bg-[#f2f3ff]/70 dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                          {session.title}
                        </p>
                        <p className="text-[11px] font-mono text-[#7b7487] dark:text-slate-400 truncate">
                          {session.model} · {session.messages.length} msgs
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        aria-label={`Delete thread ${session.title}`}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT STAGE: Multi-Turn Conversation */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl workspace-card flex flex-col min-h-[640px] max-h-[820px] overflow-hidden">
          {/* Conversation Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-[#131b2e] dark:text-white truncate">
                {activeSession ? activeSession.title : 'New Multi-Turn Study Dialogue'}
              </p>
              <p className="text-xs text-[#7b7487] dark:text-slate-400 truncate">
                {activeModelMeta.label} ({activeModelMeta.taskFit}) · Context preserved across turns
              </p>
            </div>
            {draftMessages.length > 0 && (
              <button
                type="button"
                onClick={handleStartNewChat}
                className="px-3 py-1.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-xs font-semibold text-[#4a4455] dark:text-slate-300 hover:bg-[#eaedff] dark:hover:bg-slate-700 whitespace-nowrap"
              >
                Clear View
              </button>
            )}
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#faf8ff]/50 dark:bg-slate-950/30">
            {draftMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
                <div className="w-12 h-12 rounded-2xl bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-400 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="font-display text-lg font-bold text-[#131b2e] dark:text-white">
                  Ask questions, test proofs, or drill concepts
                </h2>
                <p className="mt-1.5 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                  Conversation history and your selected system instructions are carried across every turn. Switch freely between Hydrogen, Flash Lite, Neon, and Carbon.
                </p>
                <div className="mt-6 w-full space-y-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-[#ccc3d8]/40 dark:border-slate-800 text-left text-xs font-medium text-[#131b2e] dark:text-slate-200 hover:border-[#7c3aed] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              draftMessages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={`${msg.createdAtIso}_${idx}`}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-lg bg-[#7c3aed] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-[#7c3aed] text-white rounded-tr-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[#131b2e] dark:text-slate-100 rounded-tl-sm shadow-xs'
                      }`}
                    >
                      {msg.text}
                      {!isUser && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.text, idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400 hover:text-[#630ed4] dark:hover:text-violet-400"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#7c3aed] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-[#4a4455] dark:text-slate-400">
                  Thinking with <span className="font-mono font-semibold">{selectedModel}</span>...
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {errorMsg && (
            <div className="mx-6 mb-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Message Composer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-end gap-3">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question, paste a proof to verify, or request an example... (Enter to send, Shift+Enter for newline)"
                className="flex-1 p-3 rounded-xl bg-[#f2f3ff] dark:bg-slate-800 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm text-[#131b2e] dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={sending || !inputText.trim()}
                className="h-11 px-5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
