"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Plus, RefreshCw, Loader2, ExternalLink, Trash2, Upload,
  CheckCircle, AlertCircle, Clock, Search, X, FileText, Globe,
  Lightbulb, Edit3, Link, Type, File, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  status: "synced" | "syncing" | "draft" | "error";
  entries: number;
  url: string | null;
  last_sync: string | null;
  gaps: number | null;
  config: Record<string, unknown> | null;
  created_at: string;
}

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  status: "open" | "resolved" | "ignored";
  suggested_answer: string | null;
  source_ids: string[] | null;
  created_at: string;
}

interface KnowledgeDocument {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "processing" | "indexed" | "error";
  chunk_count: number | null;
  created_at: string;
  updated_at?: string;
}

const SOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  "help-center": BookOpen,
  "website": Globe,
  "pdf": FileText,
  "document": FileText,
  "faq": Lightbulb,
  "default": BookOpen,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "help-center": "Help Center",
  "website": "Website",
  "pdf": "PDF",
  "document": "Document",
  "faq": "FAQ",
};

const STATUS_STYLES: Record<string, string> = {
  synced:     "text-green-400 bg-green-500/10",
  syncing:    "text-blue-400 bg-blue-500/10",
  draft:      "text-muted-foreground bg-white/5",
  error:      "text-red-400 bg-red-500/10",
  processing: "text-blue-400 bg-blue-500/10",
  indexed:    "text-green-400 bg-green-500/10",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(contentType: string): React.ElementType {
  if (contentType.includes("pdf")) return FileText;
  if (contentType.includes("json")) return Type;
  return File;
}

type UploadMode = "file" | "text" | "url";

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingGaps, setLoadingGaps] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [tab, setTab] = useState<"sources" | "documents" | "gaps">("sources");
  const [addOpen, setAddOpen] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", type: "help-center", url: "" });
  const [addingSrc, setAddingSrc] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ title: string; content: string; source: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState<string | null>(null);

  // Upload state
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState("");
  const [uploadTextName, setUploadTextName] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await fetch("/api/knowledge/sources");
      const data = await res.json();
      setSources(data.sources ?? []);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  const loadGaps = useCallback(async () => {
    setLoadingGaps(true);
    try {
      const res = await fetch("/api/knowledge/gaps");
      const data = await res.json();
      setGaps(data.gaps ?? []);
    } finally {
      setLoadingGaps(false);
    }
  }, []);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/knowledge/upload");
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { loadSources(); loadGaps(); loadDocs(); }, [loadSources, loadGaps, loadDocs]);

  async function addSource() {
    if (!newSource.name.trim()) return;
    setAddingSrc(true);
    try {
      await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSource.name.trim(),
          type: newSource.type,
          url: newSource.url.trim() || null,
          status: "draft",
        }),
      });
      setNewSource({ name: "", type: "help-center", url: "" });
      setAddOpen(false);
      await loadSources();
    } finally {
      setAddingSrc(false);
    }
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this knowledge source?")) return;
    await fetch(`/api/knowledge/sources/${id}`, { method: "DELETE" });
    await loadSources();
  }

  async function handleSearch(q: string) {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function suggestAnswer(gapId: string) {
    setSuggestLoading(gapId);
    try {
      const res = await fetch(`/api/knowledge/gaps/${gapId}/suggest`, { method: "POST" });
      const data = await res.json();
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, suggested_answer: data.suggested_answer } : g));
    } finally {
      setSuggestLoading(null);
    }
  }

  async function publishGap(gapId: string) {
    setPublishLoading(gapId);
    try {
      await fetch(`/api/knowledge/gaps/${gapId}/publish`, { method: "POST" });
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, status: "resolved" } : g));
    } finally {
      setPublishLoading(null);
    }
  }

  async function ignoreGap(gapId: string) {
    await fetch(`/api/knowledge/gaps/${gapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    setGaps(prev => prev.map(g => g.id === gapId ? { ...g, status: "ignored" } : g));
  }

  function handleFileDrop(file: File) {
    setUploadFile(file);
    setUploadError("");
    setUploadSuccess("");
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  }

  async function uploadFileDoc() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadFile(null);
      setUploadSuccess(`Indexed ${data.document.chunk_count ?? "?"} chunks from "${data.document.filename}"`);
      await loadDocs();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function uploadTextDoc() {
    if (!uploadText.trim()) return;
    const name = (uploadTextName.trim() || "pasted-content") + ".txt";
    const blob = new Blob([uploadText], { type: "text/plain" });
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const fd = new FormData();
      fd.append("file", blob, name);
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadText("");
      setUploadTextName("");
      setUploadSuccess(`Indexed ${data.document.chunk_count ?? "?"} chunks from "${name}"`);
      await loadDocs();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function scrapeUrl() {
    if (!uploadUrl.trim()) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const res = await fetch("/api/knowledge/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: uploadUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      setUploadUrl("");
      setUploadSuccess(`Scraped and indexed ${data.document.chunk_count ?? "?"} chunks from ${uploadUrl}`);
      await loadDocs();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  const openGaps = gaps.filter(g => g.status === "open");

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Knowledge</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect sources, upload documents, and fill gaps that your AI can&apos;t answer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "documents" && (
            <Button
              onClick={() => { setTab("documents"); }}
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
          {tab === "sources" && (
            <Button
              onClick={() => setAddOpen(true)}
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Source
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQ}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search knowledge base…"
          className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground focus:border-[#c4a574]/40"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        {!searching && searchQ && (
          <button onClick={() => { setSearchQ(""); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      <AnimatePresence>
        {searchQ && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden mb-6"
          >
            <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
              {searchResults.length} results for &quot;{searchQ}&quot;
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {searchResults.map((r, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-sm font-medium">{r.title || r.source}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.content}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Source: {r.source}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {searchQ && !searching && searchResults.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-6 text-sm text-muted-foreground mb-6"
          >
            No results for &quot;{searchQ}&quot;
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add source form */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-sm">Add Knowledge Source</h3>
              <button onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={newSource.type}
                  onChange={e => setNewSource(s => ({ ...s, type: e.target.value }))}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                >
                  <option value="help-center">Help Center</option>
                  <option value="website">Website</option>
                  <option value="faq">FAQ</option>
                  <option value="pdf">PDF</option>
                  <option value="document">Document</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Name *</label>
                <input
                  value={newSource.name}
                  onChange={e => setNewSource(s => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Help Center"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">URL (optional)</label>
                <input
                  value={newSource.url}
                  onChange={e => setNewSource(s => ({ ...s, url: e.target.value }))}
                  placeholder="https://help.yoursite.com"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={addSource} disabled={addingSrc || !newSource.name.trim()} size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5">
                {addingSrc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Source
              </Button>
              <Button onClick={() => setAddOpen(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setTab("sources")}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${tab === "sources" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Sources ({sources.length})
        </button>
        <button
          onClick={() => setTab("documents")}
          className={`text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${tab === "documents" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Documents
          {docs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c4a574]/20 text-[#c4a574]">{docs.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("gaps")}
          className={`text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${tab === "gaps" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Knowledge Gaps
          {openGaps.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{openGaps.length}</span>
          )}
        </button>
      </div>

      {/* ── Sources tab ── */}
      {tab === "sources" && (
        <>
          {loadingSources ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No knowledge sources</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first source to start training your AI.</p>
              <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Source
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map(source => {
                const Icon = SOURCE_TYPE_ICONS[source.type] ?? SOURCE_TYPE_ICONS.default;
                return (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{source.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[source.status] ?? "text-muted-foreground bg-white/5"}`}>
                          {source.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {SOURCE_TYPE_LABELS[source.type] ?? source.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {source.entries > 0 && <span>{source.entries.toLocaleString()} entries</span>}
                        {source.url && (
                          <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-foreground truncate max-w-xs">
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{source.url}</span>
                          </a>
                        )}
                        {source.last_sync && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Synced {new Date(source.last_sync).toLocaleDateString()}
                          </span>
                        )}
                        {(source.gaps ?? 0) > 0 && (
                          <span className="text-orange-400">{source.gaps} gaps</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {source.status === "synced" && (
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                          <RefreshCw className="w-3 h-3" /> Sync
                        </Button>
                      )}
                      {source.url && (
                        <a href={source.url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteSource(source.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Documents tab ── */}
      {tab === "documents" && (
        <div className="space-y-6">
          {/* Upload panel */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Mode selector */}
            <div className="flex border-b border-border">
              {([
                { id: "file" as UploadMode,  label: "Upload File", icon: Upload },
                { id: "text" as UploadMode,  label: "Paste Text",  icon: Type   },
                { id: "url"  as UploadMode,  label: "From URL",    icon: Link   },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => { setUploadMode(m.id); setUploadError(""); setUploadSuccess(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${uploadMode === m.id ? "border-[#c4a574] text-[#c4a574] bg-[#c4a574]/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* File upload mode */}
              {uploadMode === "file" && (
                <div className="space-y-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-[#c4a574]/60 bg-[#c4a574]/5" : uploadFile ? "border-green-500/40 bg-green-500/5" : "border-white/15 hover:border-white/30 hover:bg-white/2"}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.pdf,.json,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }}
                    />
                    {uploadFile ? (
                      <>
                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <p className="text-sm font-medium text-green-400">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(uploadFile.size)}</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm font-medium">Drop a file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, TXT, Markdown, JSON, CSV — max 10 MB</p>
                      </>
                    )}
                  </div>
                  {uploadFile && (
                    <div className="flex gap-2">
                      <Button
                        onClick={uploadFileDoc}
                        disabled={uploading}
                        size="sm"
                        className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5"
                      >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Index Document
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setUploadFile(null)}>Remove</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Text paste mode */}
              {uploadMode === "text" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Document name</label>
                    <input
                      value={uploadTextName}
                      onChange={e => setUploadTextName(e.target.value)}
                      placeholder="e.g. return-policy"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Content</label>
                    <textarea
                      value={uploadText}
                      onChange={e => setUploadText(e.target.value)}
                      placeholder="Paste your knowledge content here…"
                      rows={8}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20 font-mono"
                    />
                  </div>
                  <Button
                    onClick={uploadTextDoc}
                    disabled={uploading || !uploadText.trim()}
                    size="sm"
                    className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Index Text
                  </Button>
                </div>
              )}

              {/* URL scrape mode */}
              {uploadMode === "url" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">URL to scrape</label>
                    <div className="flex gap-2">
                      <input
                        value={uploadUrl}
                        onChange={e => setUploadUrl(e.target.value)}
                        placeholder="https://help.yoursite.com/policies/returns"
                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                        onKeyDown={e => e.key === "Enter" && scrapeUrl()}
                      />
                      <Button
                        onClick={scrapeUrl}
                        disabled={uploading || !uploadUrl.trim()}
                        size="sm"
                        className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 shrink-0"
                      >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                        Scrape
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Fetches the page, strips HTML, and indexes the text content.</p>
                  </div>
                </div>
              )}

              {/* Status messages */}
              <AnimatePresence>
                {uploadSuccess && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    {uploadSuccess}
                  </motion.div>
                )}
                {uploadError && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {uploadError}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Document list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Indexed Documents</p>
              <button onClick={loadDocs} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {loadingDocs ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <FileText className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No documents indexed yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Upload a file, paste text, or scrape a URL above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => {
                  const Icon = fileTypeIcon(doc.content_type);
                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="p-1.5 rounded-lg bg-muted shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[doc.status] ?? "text-muted-foreground bg-white/5"}`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{formatBytes(doc.size_bytes)}</span>
                          {doc.chunk_count != null && <span>{doc.chunk_count} chunks</span>}
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteDoc(doc.id)}
                        className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Gaps tab ── */}
      {tab === "gaps" && (
        <>
          {loadingGaps ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Lightbulb className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No knowledge gaps</p>
              <p className="text-xs text-muted-foreground mt-1">Gaps are detected automatically when AI can&apos;t answer questions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gaps.map(gap => (
                <motion.div
                  key={gap.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-card border rounded-xl p-4 ${
                    gap.status === "resolved" ? "border-green-500/20 opacity-60" :
                    gap.status === "ignored" ? "border-border opacity-40" :
                    "border-orange-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${
                          gap.status === "resolved" ? "text-green-400" :
                          gap.status === "ignored" ? "text-muted-foreground" :
                          "text-orange-400"
                        }`} />
                        <p className="text-sm font-medium">{gap.question}</p>
                        {gap.frequency > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                            {gap.frequency}× asked
                          </span>
                        )}
                      </div>

                      {gap.suggested_answer && (
                        <div className="mt-2 p-2.5 bg-green-500/5 border border-green-500/10 rounded-lg">
                          <p className="text-[10px] text-green-400 uppercase tracking-wider mb-1">Suggested Answer</p>
                          <p className="text-xs text-foreground/80">{gap.suggested_answer}</p>
                        </div>
                      )}
                    </div>

                    {gap.status === "open" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => suggestAnswer(gap.id)}
                          disabled={suggestLoading === gap.id}
                          className="text-xs h-7 gap-1"
                        >
                          {suggestLoading === gap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                          Suggest
                        </Button>
                        {gap.suggested_answer && (
                          <Button
                            size="sm"
                            onClick={() => publishGap(gap.id)}
                            disabled={publishLoading === gap.id}
                            className="text-xs h-7 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1"
                          >
                            {publishLoading === gap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Publish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ignoreGap(gap.id)}
                          className="text-xs h-7 text-muted-foreground hover:text-foreground"
                        >
                          Ignore
                        </Button>
                      </div>
                    )}

                    {gap.status !== "open" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        gap.status === "resolved" ? "bg-green-500/10 text-green-400" : "bg-white/5 text-muted-foreground"
                      }`}>
                        {gap.status}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Detected {new Date(gap.created_at).toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
