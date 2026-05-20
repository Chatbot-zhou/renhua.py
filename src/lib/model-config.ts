export type ModelProvider = 'openai-compatible' | 'local';

export type ModelConfig = {
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
};

export const LOCAL_BASE_URL_PLACEHOLDER = 'http://localhost:11434/v1';

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.9,
};

const PROVIDERS: ModelProvider[] = ['openai-compatible', 'local'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isModelProvider(value: unknown): value is ModelProvider {
  return typeof value === 'string' && PROVIDERS.includes(value as ModelProvider);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function temperatureValue(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MODEL_CONFIG.temperature;
  }

  return Math.min(1.5, Math.max(0, value));
}

export function normalizeModelConfig(value: unknown): ModelConfig {
  if (!isRecord(value)) {
    return DEFAULT_MODEL_CONFIG;
  }

  const provider = isModelProvider(value.provider)
    ? value.provider
    : DEFAULT_MODEL_CONFIG.provider;
  const baseUrl = stringValue(value.baseUrl);
  const apiKey = stringValue(value.apiKey);
  const submittedModel = stringValue(value.model);

  if (provider === 'local') {
    return {
      provider,
      baseUrl,
      apiKey,
      model: submittedModel,
      temperature: temperatureValue(value.temperature),
    };
  }

  if (provider === 'openai-compatible') {
    return {
      provider,
      baseUrl,
      apiKey,
      model: submittedModel,
      temperature: temperatureValue(value.temperature),
    };
  }

  return DEFAULT_MODEL_CONFIG;
}

export function getProviderLabel(provider: ModelProvider): string {
  const labels: Record<ModelProvider, string> = {
    'openai-compatible': '自定义 URL',
    local: '本地模型',
  };

  return labels[provider];
}
