import { NextRequest } from 'next/server';

import { cleanCode } from '@/lib/clean-code';
import {
  type ModelConfig,
  normalizeModelConfig,
} from '@/lib/model-config';
import { FALLBACK_CODE, SYSTEM_PROMPT } from '@/lib/prompt';

export const runtime = 'nodejs';

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type SsePayload = {
  content?: string;
  done?: true;
  code?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeSse(payload: SsePayload): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function readInput(body: unknown): string {
  if (!isRecord(body) || typeof body.input !== 'string') {
    return '';
  }

  return body.input.trim();
}

function readModelConfig(body: unknown): ModelConfig {
  if (!isRecord(body)) {
    return normalizeModelConfig(undefined);
  }

  return normalizeModelConfig(body.modelConfig);
}

function buildChatCompletionsUrl(baseUrl: string): string {
  if (!baseUrl) {
    throw new Error('请先填写模型 URL');
  }

  const url = new URL(baseUrl);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('模型 URL 仅支持 http 或 https');
  }

  const path = url.pathname.replace(/\/+$/u, '');
  if (!path.endsWith('/chat/completions')) {
    url.pathname = `${path}/chat/completions`.replace(/\/{2,}/gu, '/');
  }

  url.search = '';
  return url.toString();
}

function assertModelConfig(modelConfig: ModelConfig): void {
  if (!modelConfig.baseUrl) {
    throw new Error('请先填写模型 URL');
  }

  if (!modelConfig.model) {
    throw new Error('请先填写模型名称');
  }
}

function extractOpenAiText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return '';
  }

  const [choice] = payload.choices;
  if (!isRecord(choice)) {
    return '';
  }

  if (isRecord(choice.delta) && typeof choice.delta.content === 'string') {
    return choice.delta.content;
  }

  if (isRecord(choice.message) && typeof choice.message.content === 'string') {
    return choice.message.content;
  }

  return typeof choice.text === 'string' ? choice.text : '';
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function* streamOpenAiCompatible(
  messages: ChatMessage[],
  modelConfig: ModelConfig,
): AsyncGenerator<string> {
  assertModelConfig(modelConfig);

  const response = await fetch(buildChatCompletionsUrl(modelConfig.baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...(modelConfig.apiKey
        ? { Authorization: `Bearer ${modelConfig.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages,
      stream: true,
      temperature: modelConfig.temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`模型接口返回 ${response.status}`);
  }

  if (!response.body) {
    throw new Error('模型接口没有返回可读取的流');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
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
      for (const line of event.split(/\r?\n/u)) {
        if (!line.startsWith('data:')) {
          continue;
        }

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }

        const text = extractOpenAiText(parseJsonLine(data));
        if (text) {
          yield text;
        }
      }
    }
  }
}

function createSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input = readInput(body);
  const modelConfig = readModelConfig(body);

  if (!input) {
    return createSseResponse(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encodeSse({
              done: true,
              code: FALLBACK_CODE,
              error: '请输入要翻译的内容',
            }),
          );
          controller.close();
        },
      }),
    );
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: input },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const textStream = streamOpenAiCompatible(messages, modelConfig);

        let fullContent = '';

        for await (const text of textStream) {
          fullContent += text;
          controller.enqueue(encodeSse({ content: text }));
        }

        controller.enqueue(
          encodeSse({ done: true, code: cleanCode(fullContent) }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '翻译失败，请稍后再试';
        controller.enqueue(
          encodeSse({
            done: true,
            code: FALLBACK_CODE,
            error: message,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return createSseResponse(stream);
}
