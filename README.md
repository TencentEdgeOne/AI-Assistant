# SiteAgent

AI-powered site agent that can be embedded into any website with a single line of code. Built on EdgeOne Makers with DeepAgents framework.

**Framework:** DeepAgents · **Category:** Site Agent · **Language:** TypeScript

## Deploy

1. Fork this repo: [https://github.com/xiaban-x/site-agent](https://github.com/xiaban-x/site-agent)
2. Go to [EdgeOne Makers](https://console.tencentcloud.com/edgeone/makers) → **New Project** → **Import from Git**
3. Select your forked repo and follow the prompts to deploy

## Overview

This template provides a production-ready AI site agent with three layers of context awareness:

| Layer | Capability | Setup Cost |
|-------|-----------|------------|
| **A. Page Context** | AI automatically understands the current page content | Zero config (embed.js extracts it) |
| **B. Site Knowledge** | AI can search your entire site via sitemap indexing | One env var (`SITEMAP_URL`) |
| **C. Business API** | AI queries your backend in real time via function calling | Provide an API schema JSON |

Two usage modes:
- **Standalone page** (`/`) — Full-screen chat interface
- **Embeddable widget** (`/widget`) — Compact chat panel for iframe embedding

## Embed on Your Website

Add this single line to any webpage (blog, docs site, e-commerce, etc.):

```html
<script src="https://your-site-agent.edgeone.app/embed.js" async></script>
```

A floating chat bubble appears in the bottom-right corner. Clicking it opens an iframe pointing to `/widget` on the same origin — the AI automatically reads the current page content. **No backend changes needed**.

### Customization

```html
<script
  src="https://your-site-agent.edgeone.app/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  data-name="My Assistant"
  async>
</script>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-color` | `#6366f1` | Accent color (bubble, buttons, avatar) |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-name` | `AI Assistant` | Display name in the chat header |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | Model gateway API key. |
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL. For Makers Models, use `https://ai-gateway.edgeone.link/v1`. |
| `AI_GATEWAY_MODEL` | No | Model ID. Defaults to `@makers/deepseek-v4-flash`. |
| `SYSTEM_PROMPT` | No | Custom system prompt for the assistant. |
| `ASSISTANT_NAME` | No | Display name shown in the chat header. |
| `WELCOME_MESSAGE` | No | First message shown to users. |
| `SITEMAP_URL` | No | Your site's sitemap.xml URL. Enables full-site knowledge search (Layer B). |
| `DATA_API_BASE_URL` | No | Your backend API base URL (Layer C). |
| `DATA_API_KEY` | No | Auth token for your backend API. |

## Layer C: Business API Integration

To let the AI query your backend, place an `api-schema.json` in the project root:

```json
{
  "tools": [
    {
      "name": "search_posts",
      "description": "Search blog posts by keyword",
      "endpoint": "GET /posts",
      "parameters": {
        "q": { "type": "string", "description": "Search keyword" }
      }
    },
    {
      "name": "get_post",
      "description": "Get full content of a specific post by ID",
      "endpoint": "GET /posts/{id}",
      "parameters": {
        "id": { "type": "string", "description": "Post ID", "required": true }
      }
    }
  ]
}
```

Set `DATA_API_BASE_URL` to your backend address. The AI will automatically call your API when it needs data to answer user questions.

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
