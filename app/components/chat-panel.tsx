'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; done?: boolean }[];
}

interface SiteConfig {
  name: string;
  welcome: string;
  suggestedQuestions: string[];
}

function MarkdownBlock({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ChatPanel({ mode = 'full' }: { mode?: 'full' | 'widget' }) {
  const [config, setConfig] = useState<SiteConfig>({ name: 'AI Assistant', welcome: '', suggestedQuestions: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'ai-assistant-cid';
    let cid = localStorage.getItem(key);
    if (!cid) {
      cid = crypto.randomUUID();
      localStorage.setItem(key, cid);
    }
    return cid;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composingRef = useRef(false);
  const pageContextRef = useRef<{ title?: string; url?: string; content?: string } | null>(null);

  // Load config
  useEffect(() => {
    fetch('/config')
      .then(r => r.json())
      .then(c => {
        setConfig({
          name: c.name || 'AI Assistant',
          welcome: c.welcome || '',
          suggestedQuestions: c.suggestedQuestions || [],
        });
      })
      .catch(() => {});
  }, []);

  // Listen for page context from parent window
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === '__aa_page_context' && e.data.payload) {
        pageContextRef.current = e.data.payload;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    setInput('');
    setIsStreaming(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'makers-conversation-id': conversationId,
        },
        body: JSON.stringify({
          message: msg,
          ...(pageContextRef.current ? { pageContext: pageContextRef.current } : {}),
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const event = JSON.parse(payload);
            if (event.type === 'text_delta' && event.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.delta } : m,
                ),
              );
            } else if (event.type === 'tool_call' && event.tool) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls || []), { name: event.tool }] }
                    : m,
                ),
              );
            } else if (event.type === 'tool_result' && event.tool) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId || !m.toolCalls) return m;
                  const updated = m.toolCalls.map((tc) =>
                    tc.name === event.tool && !tc.done ? { ...tc, done: true } : tc,
                  );
                  return { ...m, toolCalls: updated };
                }),
              );
            } else if (event.type === 'error_message') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content || `⚠️ ${event.content}` }
                    : m,
                ),
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || '⚠️ Failed to connect.' }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, conversationId]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    fetch('/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    }).catch(() => {});
  }, [conversationId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai-assistant-cid');
    }
  }, []);

  const isWidget = mode === 'widget';

  return (
    <div className={`flex flex-col ${isWidget ? 'h-full' : 'h-screen'} bg-white`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15.624 19.1084H12.3555L14.1338 7.04688H14.0654L10.0596 12.999H12.707L12.1963 15.7197H8.64258L6.45605 19.0898H2.52344L12.1963 4.4248H17.6104L15.624 19.1084ZM23.3555 4.41992L21.5371 19.1035H18.1094L19.9277 4.41992H23.3555Z" fill="url(#g1)" fillOpacity="0.9"/>
              <path d="M3.82795 3.43848L4.17716 4.38219C4.54277 5.37021 5.32177 6.14921 6.30981 6.51481L7.25355 6.86402L6.30981 7.21323C5.32177 7.57883 4.54277 8.35783 4.17716 9.34586L3.82795 10.2896L3.47874 9.34586C3.11313 8.35783 2.33412 7.57883 1.34609 7.21323L0.402344 6.86402L1.34609 6.51481C2.33412 6.14921 3.11313 5.37022 3.47874 4.38219L3.82795 3.43848Z" fill="url(#g2)"/>
              <defs>
                <linearGradient id="g1" x1="3.23" y1="15.38" x2="21.2" y2="3.46" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5498FF"/><stop offset="0.33" stopColor="#7C74FF"/><stop offset="0.67" stopColor="#F16F9E"/><stop offset="1" stopColor="#FFD98E"/>
                </linearGradient>
                <linearGradient id="g2" x1="-4.26" y1="12.04" x2="1.93" y2="2.22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFC047"/><stop offset="0.33" stopColor="#F16F9E"/><stop offset="0.47" stopColor="#5498FF"/><stop offset="1" stopColor="#7C74FF"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-sm font-semibold text-gray-900">{config.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearChat} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="Clear">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M0.667 13.982H13.334V4.316H9V0.496H5V4.316H0.667V13.982ZM2 12.649V8.982H12V12.649H5V10.316H3.667V12.649H2ZM12 7.649H2V5.649H6.333V1.829H7.667V5.649H12V7.649Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" fillOpacity="0.7"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        {/* Onboarding / Welcome */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M15.624 19.1084H12.3555L14.1338 7.04688H14.0654L10.0596 12.999H12.707L12.1963 15.7197H8.64258L6.45605 19.0898H2.52344L12.1963 4.4248H17.6104L15.624 19.1084ZM23.3555 4.41992L21.5371 19.1035H18.1094L19.9277 4.41992H23.3555Z" fill="url(#wg1)" fillOpacity="0.9"/>
                <path d="M3.82795 3.43848L4.17716 4.38219C4.54277 5.37021 5.32177 6.14921 6.30981 6.51481L7.25355 6.86402L6.30981 7.21323C5.32177 7.57883 4.54277 8.35783 4.17716 9.34586L3.82795 10.2896L3.47874 9.34586C3.11313 8.35783 2.33412 7.57883 1.34609 7.21323L0.402344 6.86402L1.34609 6.51481C2.33412 6.14921 3.11313 5.37022 3.47874 4.38219L3.82795 3.43848Z" fill="url(#wg2)"/>
                <defs>
                  <linearGradient id="wg1" x1="3.23" y1="15.38" x2="21.2" y2="3.46" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#5498FF"/><stop offset="0.33" stopColor="#7C74FF"/><stop offset="0.67" stopColor="#F16F9E"/><stop offset="1" stopColor="#FFD98E"/>
                  </linearGradient>
                  <linearGradient id="wg2" x1="-4.26" y1="12.04" x2="1.93" y2="2.22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFC047"/><stop offset="0.33" stopColor="#F16F9E"/><stop offset="0.47" stopColor="#5498FF"/><stop offset="1" stopColor="#7C74FF"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Hey, This is <span className="bg-gradient-to-r from-indigo-500 via-pink-400 to-amber-400 bg-clip-text text-transparent">{config.name}</span>
            </h3>
            {config.welcome && (
              <p className="text-sm text-gray-500 mb-6 max-w-[280px]">{config.welcome}</p>
            )}

            {/* Suggested Questions */}
            {config.suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2 mt-2">
                {config.suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition text-left group"
                  >
                    <span className="text-sm text-gray-700 group-hover:text-indigo-700 line-clamp-1">{q}</span>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 ml-2" viewBox="0 0 24 24" fill="none"><path d="M14.53 12L8.32 6.23l1.36-1.47 7 6.5.79.74-.79.73-7 6.5-1.36-1.47L14.53 12z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15.624 19.1H12.356L14.134 7.047h-.069L10.06 13h2.647l-.51 2.72H8.643L6.456 19.09H2.523L12.196 4.425h5.414L15.624 19.1zM23.356 4.42L21.537 19.103h-3.428L19.928 4.42h3.428z" fill="#fff" fillOpacity=".9"/></svg>
                </div>
              )}
              <div
                className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-tr-sm'
                    : 'bg-gray-50 rounded-tl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <div className="relative">
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${tc.done ? 'text-green-600 bg-green-50 border-green-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                            {tc.done ? (
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/></svg>
                            ) : (
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" fill="currentColor"/></svg>
                            )}
                            {tc.done ? `Queried ${tc.name}` : `Querying ${tc.name}`}
                          </div>
                        ))}
                      </div>
                    )}
                    <MarkdownBlock content={msg.content} />
                    {isStreaming && msg.id === messages[messages.length - 1]?.id && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm bg-indigo-500 opacity-60 animate-pulse" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
                    {msg.toolCalls && msg.toolCalls.length > 0 ? (
                      <div className="space-y-1">
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${tc.done ? 'text-green-600 bg-green-50 border-green-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                            {tc.done ? (
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/></svg>
                            ) : (
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" fill="currentColor"/></svg>
                            )}
                            {tc.done ? `Queried ${tc.name}` : `Querying ${tc.name}`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Got questions? Feel free to ask."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition placeholder:text-gray-400"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isStreaming ? (
                <button onClick={stopStream} className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>
                </button>
              ) : (
                <button onClick={() => sendMessage()} disabled={!input.trim()} className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M0.99 7.67c-.48-.16-.49-.42.01-.59L18.71 1.17c.49-.16.77.08.63.57L14.28 19.5c-.14.49-.42.5-.63.04L10.32 12.02l5.57-7.43-7.42 5.57L0.99 7.67z" fill="currentColor"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
