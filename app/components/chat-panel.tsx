'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { useI18n } from '@/lib/i18n';

marked.setOptions({ gfm: true, breaks: true });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function MarkdownBlock({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ChatPanel({
  mode = 'full',
  assistantName,
  welcomeMessage,
}: {
  mode?: 'full' | 'widget';
  assistantName?: string;
  welcomeMessage?: string;
}) {
  const { t, locale, toggle } = useI18n();
  const name = assistantName || t('title');
  const welcome = welcomeMessage || t('welcome');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'site-agent-cid';
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

  // Listen for page context from parent window (embed.js sends via postMessage)
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === '__sa_page_context' && e.data.payload) {
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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    setIsStreaming(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
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
          message: text,
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
      localStorage.removeItem('site-agent-cid');
    }
  }, []);

  const isWidget = mode === 'widget';

  return (
    <div className={`flex flex-col ${isWidget ? 'h-full' : 'h-screen'} bg-white dark:bg-gray-950`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800 ${isWidget ? 'py-3' : 'py-3'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          <div>
            <div className="text-sm font-semibold">{name}</div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {t('online')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="px-2 py-1 text-[10px] rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
            {locale === 'zh' ? 'EN' : '中'}
          </button>
          {messages.length > 0 && (
            <button onClick={clearChat} className="px-2 py-1 text-[10px] rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 transition">
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome */}
        {messages.length === 0 && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">AI</div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
              <p className="text-sm text-gray-700 dark:text-gray-300">{welcome}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">AI</div>
            )}
            <div
              className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-tr-sm'
                  : 'bg-gray-50 dark:bg-gray-900 rounded-tl-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : msg.content ? (
                <div className="relative">
                  <MarkdownBlock content={msg.content} />
                  {isStreaming && msg.id === messages[messages.length - 1]?.id && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm bg-current opacity-60 animate-pulse" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                  {t('thinking')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-end gap-2">
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
            placeholder={t('placeholder')}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 transition placeholder:text-gray-400"
          />
          {isStreaming ? (
            <button onClick={stopStream} className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">
              {t('stop')}
            </button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()} className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition">
              {t('send')}
            </button>
          )}
        </div>
        {!isWidget && (
          <p className="text-center text-[10px] text-gray-300 dark:text-gray-700 mt-2">{t('poweredBy')}</p>
        )}
      </div>
    </div>
  );
}
