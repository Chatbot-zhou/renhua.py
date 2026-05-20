# 人话.py

把中文自然语言翻译成 Python 风格代码的趣味 AI 工具。

它保留 `if` / `else` / `while` / `try` 等 Python 语法骨架，变量名、函数名和字符串优先使用中文，并保持一点轻松的表达。

## 功能

- 中文输入，一键生成 Python 风格代码
- SSE 流式输出
- 代码编辑器式展示和语法高亮
- 复制、重新生成、示例输入
- 模型配置：自定义 OpenAI 兼容 URL、本地模型 URL
- 响应式布局，适配手机、平板和桌面端

## 开发

本项目只使用 `pnpm`。

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 [http://localhost:5000](http://localhost:5000)。

## 常用命令

```bash
pnpm build
pnpm start
pnpm lint
pnpm run ts-check
pnpm validate
```

## 模型配置

前端的模型设置保存在浏览器本地，翻译时随请求发送到 `/api/translate`。

- 自定义 URL：适配 OpenAI Chat Completions 兼容接口，例如 `https://api.example.com/v1`
- 本地模型：适配 Ollama、LM Studio 等兼容 `/v1/chat/completions` 的本地服务，例如 `http://localhost:11434/v1`
- 项目不内置默认模型，发布后由使用者自行填写 URL、API Key 和模型名称

接口会自动把基础 URL 拼接为 `/chat/completions`，如果你填写的是完整路径，则会直接使用。

## 目录

```text
src/
├── app/
│   ├── api/translate/route.ts
│   ├── globals.css
│   ├── icon.svg
│   ├── layout.tsx
│   └── page.tsx
├── components/ui/
│   ├── button.tsx
│   ├── input.tsx
│   └── textarea.tsx
└── lib/
    ├── clean-code.ts
    ├── model-config.ts
    ├── prompt.ts
    └── utils.ts
```
