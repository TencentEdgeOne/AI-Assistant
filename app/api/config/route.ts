import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

let _cache: any = null;

export async function GET() {
  if (!_cache) {
    let config: any = {};
    try {
      const content = await readFile(resolve(process.cwd(), 'ai-chat-assistant.config.json'), 'utf-8');
      config = JSON.parse(content);
    } catch {}

    let suggestedQuestions = config.suggestedQuestions || [];

    if (suggestedQuestions.length === 0) {
      try {
        const schemaContent = await readFile(resolve(process.cwd(), 'api-schema.json'), 'utf-8');
        const schema = JSON.parse(schemaContent);
        if (schema.tools && Array.isArray(schema.tools)) {
          suggestedQuestions = schema.tools.slice(0, 3).map((tool: any) => {
            const desc = (tool.description || tool.name).toLowerCase();
            if (desc.includes('search')) return 'Help me search for something';
            if (desc.includes('list') || desc.includes('all')) return `Show me all available ${tool.name.replace(/_/g, ' ').replace(/^get /, '')}`;
            if (desc.includes('get') && tool.parameters) return 'Tell me more about a specific item';
            return 'What can you help me with?';
          });
          suggestedQuestions = [...new Set(suggestedQuestions)];
        }
      } catch {}
    }

    if (suggestedQuestions.length === 0) {
      suggestedQuestions = [
        'What is this page about?',
        'Summarize the main content',
        'What can you help me with?',
      ];
    }

    _cache = {
      name: config.name || 'AI Chat Assistant',
      welcome: config.welcome || '',
      suggestedQuestions,
    };
  }

  return NextResponse.json(_cache, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
