'use client';

import ChatPanel from '../components/chat-panel';

export default function Widget() {
  return (
    <div className="h-screen">
      <ChatPanel mode="widget" />
    </div>
  );
}
