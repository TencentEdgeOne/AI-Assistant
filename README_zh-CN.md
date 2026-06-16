# SiteAgent（智能站点助手）

一行代码为任何网站添加 AI 对话能力。基于 EdgeOne Makers 的 DeepAgents 框架构建。

**框架：** DeepAgents · **类别：** 站点智能助手 · **语言：** TypeScript

## 部署

1. Fork 本项目：[https://github.com/xiaban-x/site-agent](https://github.com/xiaban-x/site-agent)
2. 进入 [EdgeOne Makers](https://console.cloud.tencent.com/edgeone/makers) → **新建项目** → **从 Git 导入**
3. 选择你 Fork 的仓库，按提示完成部署

## 概览

本模板提供一个生产级 AI 站点助手，具备三层上下文感知能力：

| 层级 | 能力 | 接入成本 |
|------|------|----------|
| **A. 页面上下文** | AI 自动理解当前页面内容 | 零配置（embed.js 自动提取） |
| **B. 全站知识** | AI 通过 sitemap 索引搜索全站内容 | 配一个环境变量 `SITEMAP_URL` |
| **C. 业务 API** | AI 通过 Function Calling 实时查询你的后端 | 提供 API schema JSON |

两种使用模式：
- **独立页面**（`/`）— 全屏对话界面
- **可嵌入 Widget**（`/widget`）— 精简版对话面板（iframe 嵌入）

## 嵌入到你的网站

在任何网页（博客、文档站、电商等）中添加这一行代码：

```html
<script src="https://your-site-agent.edgeone.app/embed.js" async></script>
```

页面右下角会出现一个浮动聊天气泡，点击后弹出 iframe 对话面板。脚本自动提取当前页面内容并发送给 AI — **无需修改任何后端代码**。

### 自定义配置

```html
<script
  src="https://your-site-agent.edgeone.app/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  data-name="小助手"
  async>
</script>
```

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `data-color` | `#6366f1` | 主题色（气泡、按钮、头像背景） |
| `data-position` | `bottom-right` | `bottom-right` 或 `bottom-left` |
| `data-name` | `AI 助手` | 对话面板顶部显示的名称 |

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_GATEWAY_API_KEY` | 是 | 模型网关 API Key |
| `AI_GATEWAY_BASE_URL` | 是 | 网关基础地址。使用 Makers Models 时填写 `https://ai-gateway.edgeone.link/v1` |
| `AI_GATEWAY_MODEL` | 否 | 模型 ID，默认为 `@makers/deepseek-v4-flash` |
| `SYSTEM_PROMPT` | 否 | 自定义系统提示词 |
| `ASSISTANT_NAME` | 否 | 对话界面顶部显示的助手名称 |
| `WELCOME_MESSAGE` | 否 | 用户首次打开时的欢迎语 |
| `SITEMAP_URL` | 否 | 你网站的 sitemap.xml 地址（层级 B） |
| `DATA_API_BASE_URL` | 否 | 你的后端 API 基础地址（层级 C） |
| `DATA_API_KEY` | 否 | 后端 API 的认证 Token |

## 层级 C：业务 API 对接

在项目根目录放置 `api-schema.json`，描述你的后端接口：

```json
{
  "tools": [
    {
      "name": "search_posts",
      "description": "按关键字搜索博客文章",
      "endpoint": "GET /posts",
      "parameters": {
        "q": { "type": "string", "description": "搜索关键词" }
      }
    },
    {
      "name": "get_post",
      "description": "获取指定文章全文",
      "endpoint": "GET /posts/{id}",
      "parameters": {
        "id": { "type": "string", "description": "文章 ID", "required": true }
      }
    }
  ]
}
```

设置 `DATA_API_BASE_URL` 指向你的后端地址。AI 会在需要数据时自动调用你的接口来回答用户问题。

## 快速开始

```bash
npm install
npm run dev
npm run deploy
```

## 文档链接

- [嵌入集成指南（中文）](./docs/integration-guide.md)
- [EdgeOne Makers](https://edgeone.ai/makers)
- [EdgeOne Pages 文档](https://edgeone.ai/document/pages/overview)
