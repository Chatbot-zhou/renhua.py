'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Github,
  RefreshCw,
  Settings2,
  Square,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  LOCAL_BASE_URL_PLACEHOLDER,
  type ModelConfig,
  type ModelProvider,
  getProviderLabel,
  normalizeModelConfig,
} from '@/lib/model-config';

const STORAGE_KEY = 'renhua.py:model-config:v1';

const EXAMPLES = [
  '如果今天不加班，我就去健身。',
  '老板说这个需求很简单。',
  '我不是不想回消息，只是没有社交电量。',
  '只要工资还没涨，我就没有动力。',
  '我想努力，但是我真的很困。',
];

const PROVIDER_OPTIONS: ModelProvider[] = ['openai-compatible', 'local'];

type TranslateEvent = {
  content?: string;
  done?: boolean;
  code?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTranslateEvent(raw: string): TranslateEvent | null {
  try {
    const value: unknown = JSON.parse(raw);

    if (!isRecord(value)) {
      return null;
    }

    return {
      content: typeof value.content === 'string' ? value.content : undefined,
      done: typeof value.done === 'boolean' ? value.done : undefined,
      code: typeof value.code === 'string' ? value.code : undefined,
      error: typeof value.error === 'string' ? value.error : undefined,
    };
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightCodeSegment(segment: string): string {
  const keywords = [
    'if',
    'else',
    'elif',
    'while',
    'for',
    'in',
    'try',
    'except',
    'finally',
    'def',
    'class',
    'return',
    'with',
    'as',
    'not',
    'and',
    'or',
    'True',
    'False',
    'None',
    'pass',
    'break',
    'continue',
    'raise',
  ];
  const builtins = ['print', 'range', 'len', 'int', 'str', 'float', 'list', 'dict'];
  let highlighted = escapeHtml(segment);

  for (const keyword of keywords) {
    highlighted = highlighted.replace(
      new RegExp(`\\b(${keyword})\\b`, 'g'),
      '<span class="code-keyword">$1</span>',
    );
  }

  for (const builtin of builtins) {
    highlighted = highlighted.replace(
      new RegExp(`\\b(${builtin})(\\()`, 'g'),
      '<span class="code-builtin">$1</span>$2',
    );
  }

  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="code-number">$1</span>',
  );
  highlighted = highlighted.replace(
    /(\+=|-=|\*=|\/=|==|!=|&lt;=|&gt;=|&lt;|&gt;)/g,
    '<span class="code-operator">$1</span>',
  );

  return highlighted;
}

function highlightLine(line: string): string {
  const commentIndex = line.indexOf('#');
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : '';
  const parts = codePart.split(/(["'][^"']*["'])/g);

  const highlightedCode = parts
    .map((part) => {
      if (/^["'][^"']*["']$/u.test(part)) {
        return `<span class="code-string">${escapeHtml(part)}</span>`;
      }

      return highlightCodeSegment(part);
    })
    .join('');

  if (!commentPart) {
    return highlightedCode;
  }

  return `${highlightedCode}<span class="code-comment">${escapeHtml(
    commentPart,
  )}</span>`;
}

function highlightPython(code: string): string {
  return code
    .split('\n')
    .map((line) => highlightLine(line))
    .join('\n');
}

function GiteeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.6 4.5h10.8a2.1 2.1 0 0 1 2.1 2.1v10.8a2.1 2.1 0 0 1-2.1 2.1H6.6a2.1 2.1 0 0 1-2.1-2.1V6.6a2.1 2.1 0 0 1 2.1-2.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.1 12a3.9 3.9 0 0 1 3.9-3.9h3.9v3.1H12a.8.8 0 0 0-.8.8v.1c0 .4.4.8.8.8h3.9v3H12A3.9 3.9 0 0 1 8.1 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function HomePage() {
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [streamingCode, setStreamingCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [configReady, setConfigReady] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(() =>
    normalizeModelConfig(undefined),
  );
  const abortRef = useRef<AbortController | null>(null);
  const lastInputRef = useRef('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setModelConfig(normalizeModelConfig(JSON.parse(saved)));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setConfigReady(true);
  }, []);

  useEffect(() => {
    if (!configReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modelConfig));
  }, [configReady, modelConfig]);

  const displayCode = code || streamingCode;
  const providerLabel = useMemo(
    () => getProviderLabel(modelConfig.provider),
    [modelConfig.provider],
  );

  const patchModelConfig = useCallback((patch: Partial<ModelConfig>) => {
    setModelConfig((current) => normalizeModelConfig({ ...current, ...patch }));
  }, []);

  const changeProvider = useCallback((provider: ModelProvider) => {
    setModelConfig((current) =>
      normalizeModelConfig({
        ...current,
        provider,
      }),
    );
  }, []);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const translate = useCallback(
    async (text?: string) => {
      const inputText = (text ?? input).trim();
      if (!inputText) {
        setErrorMsg('先输入一句人话。');
        return;
      }

      if (!modelConfig.baseUrl || !modelConfig.model) {
        setSettingsOpen(true);
        setErrorMsg('先配置模型 URL 和模型名称。');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastInputRef.current = inputText;

      setIsGenerating(true);
      setCode('');
      setStreamingCode('');
      setErrorMsg('');

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: inputText, modelConfig }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`翻译接口返回 ${response.status}`);
        }

        if (!response.body) {
          throw new Error(`翻译接口返回 ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\n\n/u);
          buffer = events.pop() ?? '';

          for (const event of events) {
            const dataLine = event
              .split(/\r?\n/u)
              .find((line) => line.startsWith('data:'));
            if (!dataLine) {
              continue;
            }

            const data = parseTranslateEvent(dataLine.slice(5).trim());
            if (!data) {
              continue;
            }

            if (data.content) {
              accumulated += data.content;
              setStreamingCode(accumulated);
            }

            if (data.done) {
              setCode(data.code ?? accumulated);
              setStreamingCode('');
              if (data.error) {
                setErrorMsg(data.error);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setErrorMsg(error instanceof Error ? error.message : '翻译失败，请稍后再试');
        setCode(
          'try:\n    理解这句话()\nexcept 太难理解:\n    print("翻译失败，再来一次")',
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [input, modelConfig],
  );

  const handleCopy = useCallback(async () => {
    const textToCopy = displayCode;
    if (!textToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [displayCode]);

  return (
    <main className="min-h-dvh bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                <Terminal className="size-5" aria-hidden="true" />
              </span>
              <h1 className="text-4xl font-semibold">人话.py</h1>
            </div>
            <p className="text-base text-muted-foreground">
              把你的中文，翻译成 Python 话。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-lg border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary md:w-auto"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings2 className="size-4" aria-hidden="true" />
            {providerLabel}
          </Button>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <form
              className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void translate();
              }}
            >
              <Textarea
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (errorMsg) {
                    setErrorMsg('');
                  }
                }}
                placeholder="如果今天不加班，我就去健身。"
                className="min-h-36 resize-none rounded-lg border-input bg-[#0d0d0f] p-4 text-base leading-7 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-primary/30"
                disabled={isGenerating}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-h-5 text-sm text-amber-300">{errorMsg}</p>
                <div className="flex gap-2">
                  {isGenerating ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-lg"
                      onClick={stopGenerating}
                    >
                      <Square className="size-4" aria-hidden="true" />
                      停止
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    className="rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                    disabled={isGenerating || !input.trim()}
                  >
                    {isGenerating ? (
                      <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    )}
                    {isGenerating ? '翻译中' : '翻译'}
                  </Button>
                </div>
              </div>
            </form>

            {settingsOpen ? (
              <section className="rounded-lg border border-border bg-card p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-2" role="tablist">
                  {PROVIDER_OPTIONS.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      className={`min-h-10 rounded-lg border px-2 text-sm transition ${
                        modelConfig.provider === provider
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => changeProvider(provider)}
                    >
                      {getProviderLabel(provider)}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-muted-foreground sm:col-span-2">
                    URL
                    <Input
                      value={modelConfig.baseUrl}
                      onChange={(event) =>
                        patchModelConfig({ baseUrl: event.target.value })
                      }
                      placeholder={
                        modelConfig.provider === 'local'
                          ? LOCAL_BASE_URL_PLACEHOLDER
                          : 'https://api.example.com/v1'
                      }
                      className="rounded-lg border-input bg-[#0d0d0f] text-foreground"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-muted-foreground">
                    API Key
                    <Input
                      type="password"
                      value={modelConfig.apiKey}
                      onChange={(event) =>
                        patchModelConfig({ apiKey: event.target.value })
                      }
                      placeholder="按服务要求填写"
                      className="rounded-lg border-input bg-[#0d0d0f] text-foreground"
                    />
                  </label>

                  <label className="grid gap-1 text-sm text-muted-foreground">
                    模型
                    <Input
                      value={modelConfig.model}
                      onChange={(event) =>
                        patchModelConfig({ model: event.target.value })
                      }
                      placeholder={
                        modelConfig.provider === 'local'
                          ? '本地模型名称'
                          : '模型名称'
                      }
                      className="rounded-lg border-input bg-[#0d0d0f] text-foreground"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-muted-foreground sm:col-span-2">
                    温度 {modelConfig.temperature.toFixed(1)}
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.1"
                      value={modelConfig.temperature}
                      onChange={(event) =>
                        patchModelConfig({
                          temperature: Number(event.target.value),
                        })
                      }
                      className="h-2 w-full accent-primary"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setInput(example);
                    void translate(example);
                  }}
                  disabled={isGenerating}
                  className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </section>
          </div>

          <section className="flex min-w-0 flex-col rounded-lg border border-border bg-[#111215] shadow-sm">
            <div className="flex min-h-12 items-center justify-between border-b border-border px-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-400" />
                <span className="size-3 rounded-full bg-amber-300" />
                <span className="size-3 rounded-full bg-primary" />
              </div>
              <span className="font-mono text-sm text-muted-foreground">
                renhua.py
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                  disabled={isGenerating || !lastInputRef.current}
                  onClick={() => void translate(lastInputRef.current || input)}
                  title="重新生成"
                >
                  <RefreshCw
                    className={`size-4 ${isGenerating ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                  disabled={!displayCode}
                  onClick={() => void handleCopy()}
                  title="复制"
                >
                  {copied ? (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            <div className="min-h-72 flex-1 overflow-auto p-4 sm:min-h-[28rem]">
              {displayCode ? (
                <pre className="min-h-full whitespace-pre font-mono text-sm leading-7 text-foreground sm:text-[15px]">
                  <code
                    dangerouslySetInnerHTML={{
                      __html: highlightPython(displayCode),
                    }}
                  />
                  {isGenerating && !code ? (
                    <span className="ml-1 inline-block h-5 w-2 translate-y-1 bg-primary" />
                  ) : null}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-muted-foreground">
                  {`# 人话.py
if 今天.适合表达():
    输出 = "一段中文 Python 话"
else:
    print("也可以再想想")`}
                </pre>
              )}
            </div>
          </section>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>人话.py</span>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Chatbot-zhou/renhua.py"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
              title="GitHub 仓库"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
            >
              <Github className="size-4" aria-hidden="true" />
            </a>
            <a
              href="https://gitee.com/chatbotzhou/renhua.py"
              target="_blank"
              rel="noreferrer"
              aria-label="Gitee 仓库"
              title="Gitee 仓库"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
            >
              <GiteeIcon />
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
