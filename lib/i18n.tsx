'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const translations = {
  en: {
    title: 'AI Chat Assistant',
    online: 'Online',
    placeholder: 'Type a message…',
    send: 'Send',
    stop: 'Stop',
    welcome: 'Hi! How can I help you today?',
    poweredBy: 'Powered by EdgeOne Makers',
    clear: 'Clear',
    thinking: 'Thinking…',
  },
  zh: {
    title: 'AI 助手',
    online: '在线',
    placeholder: '输入消息…',
    send: '发送',
    stop: '停止',
    welcome: '你好！有什么可以帮你的吗？',
    poweredBy: '由 EdgeOne Makers 驱动',
    clear: '清空',
    thinking: '思考中…',
  },
} as const;

type Locale = keyof typeof translations;
type TKey = keyof (typeof translations)['en'];

const I18nContext = createContext<{
  locale: Locale;
  t: (key: TKey) => string;
  toggle: () => void;
}>({
  locale: 'en',
  t: (k) => k,
  toggle: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with 'en' to match SSR; detect browser locale after mount.
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    if (navigator.language.startsWith('zh')) {
      setLocale('zh');
    }
  }, []);

  const t = useCallback((key: TKey) => translations[locale][key] || key, [locale]);
  const toggle = useCallback(() => setLocale((l) => (l === 'en' ? 'zh' : 'en')), []);

  return (
    <I18nContext.Provider value={{ locale, t, toggle }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
