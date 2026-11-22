import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Compass,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import { deleteResource, saveResource } from '../services/firestoreService.ts';
import { ResourceType } from '../types/academic.ts';

interface SearchResultItem {
  title: string;
  source: string;
  resourceType: ResourceType;
  url: string;
  description: string;
  isGrounded: boolean;
}

export function ResourcesPage() {
  const { user } = useAuth();
  const { subjects, topics, resources } = useAcademicData();
  const [searchParams] = useSearchParams();

  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const [topicId, setTopicId] = useState(searchParams.get('topicId') || '');
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [fallbackLinks, setFallbackLinks] = useState<SearchResultItem[]>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedTypeFilter, setSavedTypeFilter] = useState<'all' | ResourceType>('all');

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam) setQueryText(qParam);
  }, [searchParams]);

  const subjectTopics = useMemo(
    () => topics.filter((t) => t.subjectId === subjectId),
    [topics, subjectId]
  );

  const savedUrlSet = useMemo(() => new Set(resources.map((r) => r.url)), [resources]);

  const filteredSaved = useMemo(() => {
    if (savedTypeFilter === 'all') return resources;
    return resources.filter((r) => r.resourceType === savedTypeFilter);
  }, [resources, savedTypeFilter]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = topics.find((t) => t.id === topicId);

    if (!subject && !queryText.trim()) {
      setErrorMsg('Enter a topic or keyword to search for learning resources.');
      return;
    }

    setSearching(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.searchResources({
        subjectTitle: subject?.title || '',
        topicTitle: topic?.title,
        query: queryText.trim(),
      });
      setSearchResults(res.resources);
      setFallbackLinks(res.fallbackSearchLinks);
      setStatusNote(res.summaryNote);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve resources.');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveResource = async (item: SearchResultItem) => {
    if (!user || savedUrlSet.has(item.url)) return;
    await saveResource(user.uid, {
      subjectId: subjectId || undefined,
      topicId: topicId || undefined,
      title: item.title,
      source: item.source,
      resourceType: item.resourceType,
      url: item.url,
      description: item.description,
      isGrounded: item.isGrounded,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stitch Context Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400">
          <span>Academic Intelligence</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Workspace</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#630ed4] dark:text-violet-400">Learning Resources Hub</span>
        </div>
        <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
          Learning Resources Hub
        </h1>
        <p className="text-xs text-[#4a4455] dark:text-slate-400">
          Discover verified educational videos, official documentation, tutorials, and open courses via grounded web search.
        </p>
      </div>

      <AiSetupBanner contextLabel="Live grounded resource search" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Search Bar */}
      <form
        onSubmit={handleSearch}
        className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Subject (optional)</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              <option value="">Any Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Topic (optional)</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
            >
              <option value="">Any Topic</option>
              {subjectTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.orderIndex} · {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Search Concept or Keyword</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., Raft consensus proof"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button
                type="submit"
                disabled={searching}
                className="h-10 px-4 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>{searching ? 'Searching...' : 'Find'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Search Results */}
      {(statusNote || searchResults.length > 0 || fallbackLinks.length > 0) && (
        <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold">Retrieved Resources</h2>
            {statusNote && (
              <span className="text-xs text-[#4a4455] dark:text-slate-400">{statusNote}</span>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((item) => {
                const isSaved = savedUrlSet.has(item.url);
                return (
                  <div
                    key={item.url}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#630ed4] dark:text-violet-400 uppercase tracking-wider">
                        {item.resourceType.replace('_', ' ')} · {item.source}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 font-display text-sm font-bold text-[#131b2e] dark:text-slate-100 hover:text-[#7c3aed] inline-flex items-center gap-1"
                      >
                        <span className="line-clamp-2">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 truncate">
                        {item.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveResource(item)}
                      disabled={isSaved}
                      className="p-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-300 disabled:opacity-60 shrink-0"
                      title={isSaved ? 'Saved to library' : 'Save resource'}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {fallbackLinks.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-semibold text-[#7b7487] dark:text-slate-400 mb-2.5">
                Direct Educational Search Links
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {fallbackLinks.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-xl bg-[#f2f3ff]/70 dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#131b2e] dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#4a4455] dark:text-slate-400">
                        {item.source}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Saved Resource Library */}
      <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold">Saved Resources ({resources.length})</h2>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f2f3ff] dark:bg-slate-800">
            {(['all', 'youtube', 'documentation', 'tutorial', 'article', 'open_course'] as const).map(
              (typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setSavedTypeFilter(typeKey)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap ${
                    savedTypeFilter === typeKey
                      ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                      : 'text-[#4a4455] dark:text-slate-400'
                  }`}
                >
                  {typeKey.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>

        {filteredSaved.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#4a4455] dark:text-slate-400 flex flex-col items-center">
            <Compass className="w-6 h-6 text-[#7c3aed] mb-2" />
            <span>No saved learning resources in this filter yet.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSaved.map((r) => (
              <div key={r.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#131b2e] dark:text-slate-100 hover:text-[#7c3aed] inline-flex items-center gap-1.5"
                  >
                    <span className="truncate">{r.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                  <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400">
                    {r.source} · {r.resourceType.replace('_', ' ')} ·{' '}
                    {r.isGrounded ? 'Grounded Search Result' : 'Direct Search Link'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteResource(r.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 shrink-0"
                  aria-label="Remove saved resource"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
