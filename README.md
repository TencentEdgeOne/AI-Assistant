# AI Assistant

Embeddable AI assistant for any website. One line of code to add a chat widget that understands page content and queries your backend APIs via function calling.

**Framework:** DeepAgents · **Category:** Chat · **Language:** TypeScript

## Deploy

[![Deploy to EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=ai-assistant&from=within&fromAgent=1&agentLang=typescript)

## Overview

Two layers of context awareness:

| Layer | Capability | Setup Cost |
|-------|-----------|------------|
| **A. Page Context** | AI automatically understands the current page content | Zero config (embed.js extracts it) |
| **B. Business API** | AI queries your backend in real time via function calling | Provide an `api-schema.json` |

## Embed on Your Website

```html
<script src="https://your-ai-assistant.edgeone.app/embed.js" async></script>
```

A floating chat bubble appears in the bottom-right corner. Clicking it opens an iframe pointing to `/widget` on the same origin — the AI automatically reads the current page content. **No backend changes needed**.

### Customization

```html
<script
  src="https://your-ai-assistant.edgeone.app/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  async>
</script>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-color` | `#6366f1` | Accent color (bubble, buttons, avatar) |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |

## Configuration

Edit `ai-assistant.config.json` in the project root:

```json
{
  "name": "AI Assistant",
  "welcome": "Hi! How can I help you?",
  "systemPrompt": "You are a helpful assistant.",
  "suggestedQuestions": ["What is this page about?"]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | Model gateway API key |
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL. For Makers Models, use `https://ai-gateway.edgeone.link/v1` |
| `AI_GATEWAY_MODEL` | No | Model ID. Defaults to `@makers/deepseek-v3` |
| `DATA_API_BASE_URL` | No | Your backend API base URL |
| `DATA_API_KEY` | No | Auth token for your backend API |

## Business API Integration

Place an `api-schema.json` in the project root to let AI query your backend:

```json
{
  "tools": [
    {
      "name": "search_posts",
      "description": "Search blog posts by keyword",
      "endpoint": "GET /api/posts",
      "parameters": {
        "q": { "type": "string", "description": "Search keyword" }
      }
    }
  ]
}
```

Set `DATA_API_BASE_URL` to your backend address.

## Quick Start

```bash
npm install
npm run dev
npm run deploy
```

## Documentation

- [Integration Guide (中文)](./docs/integration-guide.md)
- [EdgeOne Makers](https://edgeone.ai/makers)
- [EdgeOne Pages Docs](https://edgeone.ai/document/pages/overview)
