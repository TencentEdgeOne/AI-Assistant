'use client';

import ChatPanel from './components/chat-panel';

export default function Home() {
  return (
    <main className="h-screen">
      <ChatPanel mode="full" />
    </main>
  );
}
