import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Send, Plus, Trash2, Bot, User, Settings, AlertCircle, Loader2, Paperclip } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type ChatSession, type ChatMessage } from '@/lib/supabase';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { FileUpload } from '@/components/FileUpload';
import { getApiKey, hasApiKey, SUPABASE_FUNCTION_URL } from '@/lib/apiKey';
import type { ExtractedFile } from '@/lib/fileExtract';

export default function TutorPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
    setApiKeyMissing(!hasApiKey());
  }, [user]);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession.id);
  }, [activeSession?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function loadSessions() {
    if (!user) return;
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setSessions((data as ChatSession[]) || []);
    setLoading(false);
  }

  async function loadMessages(sessionId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) || []);
  }

  async function newSession() {
    if (!user) return;
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ title: 'New Conversation', subject: subject || '' })
      .select()
      .single();
    if (data) {
      const session = data as ChatSession;
      setSessions([session, ...sessions]);
      setActiveSession(session);
      setMessages([]);
      setError(null);
    }
  }

  async function deleteSession(session: ChatSession) {
    await supabase.from('chat_sessions').delete().eq('id', session.id);
    setSessions(sessions.filter((s) => s.id !== session.id));
    if (activeSession?.id === session.id) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  async function handleFileExtracted(file: ExtractedFile) {
    if (!activeSession || !user) return;
    if (!hasApiKey()) {
      setApiKeyMissing(true);
      setShowApiModal(true);
      return;
    }

    setShowFileUpload(false);
    setAnalyzingFile(true);
    setError(null);

    const userMsg = `I've uploaded a document: ${file.name}. Please analyze it.`;
    const { data: userMsgRow } = await supabase
      .from('chat_messages')
      .insert({ session_id: activeSession.id, role: 'user', content: userMsg })
      .select()
      .single();
    if (userMsgRow) setMessages((prev) => [...prev, userMsgRow as ChatMessage]);

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          fileType: file.type,
          apiKey: getApiKey(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      const aiContent = data.content as string;

      const { data: aiMsgRow } = await supabase
        .from('chat_messages')
        .insert({ session_id: activeSession.id, role: 'assistant', content: aiContent })
        .select()
        .single();
      if (aiMsgRow) setMessages((prev) => [...prev, aiMsgRow as ChatMessage]);

      if (messages.length === 0) {
        const title = `Analysis: ${file.name.slice(0, 30)}`;
        await supabase.from('chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', activeSession.id);
        setActiveSession({ ...activeSession, title });
        setSessions(sessions.map((s) => (s.id === activeSession.id ? { ...s, title } : s)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setAnalyzingFile(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeSession || !user) return;

    if (!hasApiKey()) {
      setApiKeyMissing(true);
      setShowApiModal(true);
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setSending(true);
    setError(null);

    const { data: userMsgRow } = await supabase
      .from('chat_messages')
      .insert({ session_id: activeSession.id, role: 'user', content: userMsg })
      .select()
      .single();

    if (userMsgRow) {
      setMessages((prev) => [...prev, userMsgRow as ChatMessage]);
    }

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: userMsg });

    setStreamingContent('');

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: history,
          apiKey: getApiKey(),
          subject: activeSession.subject || subject || '',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingContent(accumulated);
      }

      const { data: aiMsgRow } = await supabase
        .from('chat_messages')
        .insert({ session_id: activeSession.id, role: 'assistant', content: accumulated })
        .select()
        .single();

      if (aiMsgRow) {
        setMessages((prev) => [...prev, aiMsgRow as ChatMessage]);
      }

      if (messages.length === 0) {
        const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? '...' : '');
        await supabase.from('chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', activeSession.id);
        setActiveSession({ ...activeSession, title });
        setSessions(sessions.map((s) => (s.id === activeSession.id ? { ...s, title } : s)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response');
    } finally {
      setStreamingContent('');
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Tutor</h1>
          <p className="text-slate-400 text-sm mt-1">Chat with your AI tutor — supports Markdown, code highlighting, and LaTeX math</p>
        </div>
        <button
          onClick={() => setShowApiModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium transition-colors"
        >
          <Settings className="w-4 h-4" /> API Key
        </button>
      </div>

      <ApiKeyModal open={showApiModal} onClose={() => { setShowApiModal(false); setApiKeyMissing(!hasApiKey()); }} />

      {apiKeyMissing && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-300 font-medium">API key required</p>
            <p className="text-xs text-amber-400/70 mt-0.5">Click "API Key" to add your free OpenRouter API key and enable real AI responses.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Sessions sidebar */}
        <div className="space-y-3 overflow-y-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
            />
            <button
              onClick={newSession}
              className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No conversations yet. Click + to start.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  activeSession?.id === session.id
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                }`}
                onClick={() => setActiveSession(session)}
              >
                <MessageSquareText className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{session.title}</p>
                  {session.subject && <p className="text-xs text-slate-500 truncate">{session.subject}</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(session); }}
                  className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-slate-900/50 border border-white/5 overflow-hidden">
          {activeSession ? (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && !streamingContent ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="w-12 h-12 text-emerald-400/50 mb-4" />
                    <p className="text-slate-400">Ask me anything about {activeSession.subject || 'your studies'}!</p>
                    <p className="text-sm text-slate-500 mt-1">I can explain concepts, help with coding, solve problems, and more.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          msg.role === 'user' ? 'bg-slate-700' : 'bg-emerald-500/20'
                        }`}>
                          {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Bot className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-slate-700/50 rounded-tr-sm'
                            : 'bg-slate-800/50 rounded-tl-sm'
                        }`}>
                          {msg.role === 'user' ? (
                            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}
                        </div>
                      </div>
                    ))}
                    {streamingContent && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-slate-800/50 rounded-tl-sm">
                          <MarkdownRenderer content={streamingContent} />
                          <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
                        </div>
                      </div>
                    )}
                    {sending && !streamingContent && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-slate-800/50 rounded-tl-sm flex items-center gap-1">
                          <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <div className="p-4 border-t border-white/5 space-y-2">
                {showFileUpload && (
                  <FileUpload onFileExtracted={handleFileExtracted} label="Upload syllabus or exam paper for analysis" />
                )}
                {analyzingFile && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing uploaded document...
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    className="px-3 py-3 rounded-xl border border-white/10 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sending) sendMessage(); }}
                    placeholder="Type your question..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Bot className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400">Start a new conversation to chat with your AI tutor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
