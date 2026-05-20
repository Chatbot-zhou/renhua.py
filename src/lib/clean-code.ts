import { FALLBACK_CODE } from '@/lib/prompt';

const MAX_CODE_LINES = 10;

const PYTHON_LIKE_LINE =
  /^\s*(if|elif|else|while|for|try|except|finally|def|class|return|print|with|import|from|raise|pass|break|continue)\b|^\s*#|^\s*[\u3400-\u9fff\w.]+\s*(=|\+=|-=|\*=|\/=|\(|\.)/u;

const DANGEROUS_PATTERNS = [
  /\bos\.system\b/i,
  /\bsubprocess\b/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bopen\s*\([^)]*['"][wa]/i,
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[fq]/i,
  /\bformat\s+c:/i,
];

function stripMarkdownFence(raw: string): string {
  return raw
    .replace(/^```(?:python|py)?\s*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();
}

function removeExplanationLines(lines: string[]): string[] {
  const firstCodeLine = lines.findIndex((line) => PYTHON_LIKE_LINE.test(line));
  const codeLines = firstCodeLine >= 0 ? lines.slice(firstCodeLine) : lines;

  return codeLines.filter((line) => {
    const trimmed = line.trim();
    return !/^(输入|输出|解释|说明|代码)[:：]/.test(trimmed);
  });
}

export function cleanCode(raw: string): string {
  let code = stripMarkdownFence(raw);

  if (code.startsWith('`') && code.endsWith('`')) {
    code = code.slice(1, -1).trim();
  }

  if (!code) {
    return FALLBACK_CODE;
  }

  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(code))) {
    return `if 用户输入.有点危险():
    温和拒绝()
else:
    翻译成人话_py()`;
  }

  const lines = removeExplanationLines(
    code
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+$/u, '')),
  );

  const compactLines = lines.filter((line, index, allLines) => {
    if (line.trim()) {
      return true;
    }

    return index > 0 && index < allLines.length - 1;
  });

  const cleaned = compactLines.slice(0, MAX_CODE_LINES).join('\n').trim();

  return cleaned || FALLBACK_CODE;
}
