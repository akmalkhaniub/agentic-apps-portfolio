import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from './env.js';

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface VisionAnalysis {
  imageUrl: string;
  description: string;
  issues: string[];
}

export async function analyzeImage(imageUrl: string, prompt: string): Promise<VisionAnalysis> {
  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: new URL(imageUrl) },
            { type: 'text', text: prompt },
          ],
        },
      ],
      maxTokens: 1024,
    });

    const text = result.text;
    const issues = text
      .split('\n')
      .filter((line) => line.startsWith('- ') || line.startsWith('* '))
      .map((line) => line.replace(/^[-*]\s*/, ''));

    return { imageUrl, description: text, issues };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Vision analysis failed';
    return { imageUrl, description: msg, issues: [`Error: ${msg}`] };
  }
}
