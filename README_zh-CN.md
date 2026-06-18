# AI Assistant（AI 助手）

可嵌入任何网站的 AI 助手。一行代码添加聊天 Widget，自动理解页面内容，通过 Function Calling 实时查询你的后端 API。

**框架：** DeepAgents · **类别：** 对话 · **语言：** TypeScript

## 部署

[![部署到 EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?template=ai-chat-assistant&from=within&fromAgent=1&agentLang=typescript)

## 概览

两层上下文感知能力：

| 层级 | 能力 | 接入成本 |
|------|------|----------|
| **A. 页面上下文** | AI 自动理解当前页面内容 | 零配置（embed.js 自动提取） |
| **B. 业务 API** | AI 通过 Function Calling 实时查询你的后端 | 提供 `api-schema.json` |

## 嵌入到你的网站

```html
<script src="https://your-ai-chat-assistant.edgeone.app/embed.js" async></script>
```

页面右下角会出现一个浮动聊天气泡，点击后弹出 iframe 对话面板。脚本自动提取当前页面内容并发送给 AI — **无需修改任何后端代码**。

### 自定义配置

```html
<script
  src="https://your-ai-chat-assistant.edgeone.app/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  async>
</script>
```

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `data-color` | `#6366f1` | 主题色（气泡、按钮、头像背景） |
| `data-position` | `bottom-right` | `bottom-right` 或 `bottom-left` |

## 配置文件

编辑项目根目录的 `ai-chat-assistant.config.json`：

```json
{
  "name": "AI 助手",
  "welcome": "你好！有什么可以帮你的？",
  "systemPrompt": "你是一个友好的 AI 助手。",
  "suggestedQuestions": ["这个页面讲了什么？"]
}
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_GATEWAY_MODEL` | 否 | 模型 ID，默认 `@makers/deepseek-v3` |
| `DATA_API_BASE_URL` | 否 | 你的后端 API 基础地址 |
| `DATA_API_KEY` | 否 | 后端 API 的认证 Token |

> `AI_GATEWAY_API_KEY` 和 `AI_GATEWAY_BASE_URL` 通过一键部署时会自动注入。

## 业务 API 对接

在项目根目录放置 `api-schema.json`，描述你的后端接口：

```json
{
  "tools": [
    {
      "name": "search_posts",
      "description": "按关键字搜索博客文章",
      "endpoint": "GET /api/posts",
      "parameters": {
        "q": { "type": "string", "description": "搜索关键词" }
      }
    }
  ]
}
```

设置 `DATA_API_BASE_URL` 指向你的后端地址。

## 本地开发

**前置条件：**
- Node.js 18+
- EdgeOne CLI（`npm i -g edgeone`）
- 一个 `AI_GATEWAY_API_KEY` — 在 [Makers 控制台](https://edgeone.ai/makers/new?s_url=https://console.tencentcloud.com/edgeone/makers) → **Models → API Key** 中创建

```bash
npm install
cp .env.example .env
# 编辑 .env 填入 AI_GATEWAY_API_KEY 和 AI_GATEWAY_BASE_URL
edgeone makers dev
```

打开 http://localhost:8088 查看应用。

> 内置模型在配额内免费，适合测试验证。生产环境建议绑定自己的付费模型 Key（BYOK）。

## 相关资源

- [EdgeOne Makers Agents 文档](https://cloud.tencent.com/document/product/1552/132759)
- [EdgeOne Makers 快速开始](https://cloud.tencent.com/document/product/1552/132786)
- [Makers Models](https://cloud.tencent.com/document/product/1552/132748)

## 许可证

MIT
