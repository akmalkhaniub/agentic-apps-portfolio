export type Complexity = 'simple' | 'moderate' | 'complex';

const COMPLEX_KEYWORDS = [
  'analyze',
  'compare',
  'evaluate',
  'design',
  'architect',
  'implement',
  'debug',
  'optimize',
  'refactor',
  'explain step by step',
  'write code',
  'create a plan',
  'multi-step',
  'reasoning',
];

const SIMPLE_KEYWORDS = ['translate', 'summarize', 'define', 'what is', 'list', 'hello', 'hi', 'thanks', 'yes', 'no'];

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

export function classifyComplexity(messages: { role: string; content: string }[]): Complexity {
  const fullText = messages
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();
  const tokens = estimateTokens(fullText);

  if (tokens < 30) {
    const hasComplex = COMPLEX_KEYWORDS.some((kw) => fullText.includes(kw));
    if (!hasComplex) return 'simple';
  }

  if (tokens > 500 || COMPLEX_KEYWORDS.filter((kw) => fullText.includes(kw)).length >= 2) {
    return 'complex';
  }

  if (SIMPLE_KEYWORDS.some((kw) => fullText.includes(kw)) && tokens < 100) {
    return 'simple';
  }

  return 'moderate';
}

const MODEL_MAP: Record<Complexity, string> = {
  simple: 'claude-3-5-haiku-latest',
  moderate: 'claude-sonnet-4-20250514',
  complex: 'claude-opus-4-20250514',
};

export function getModel(complexity: Complexity): string {
  return MODEL_MAP[complexity];
}

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-latest': { input: 0.001, output: 0.005 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model] ?? { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
