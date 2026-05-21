import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { CrawlResult } from './crawler.js';
import { analyzeImage } from './vision.js';
import { env } from './env.js';

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface AuditFinding {
  type: 'text' | 'visual';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  source: string;
}

export interface AuditResult {
  url: string;
  findings: AuditFinding[];
  summary: string;
  auditedAt: string;
}

export async function auditPage(crawl: CrawlResult, guidelines: string): Promise<AuditResult> {
  const findings: AuditFinding[] = [];

  const textResult = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages: [
      {
        role: 'user',
        content: `You are a brand compliance auditor. Analyze this page content against brand guidelines and report issues.

Brand Guidelines:
${guidelines}

Page URL: ${crawl.url}
Page Title: ${crawl.title}
Page Text (first 5000 chars): ${crawl.text.slice(0, 5000)}

Report each issue on a new line starting with [CRITICAL], [WARNING], or [INFO] followed by description.`,
      },
    ],
    maxTokens: 1024,
  });

  for (const line of textResult.text.split('\n')) {
    const match = line.match(/^\[(CRITICAL|WARNING|INFO)\]\s*(.+)/i);
    if (match) {
      findings.push({
        type: 'text',
        severity: match[1].toLowerCase() as AuditFinding['severity'],
        description: match[2],
        source: crawl.url,
      });
    }
  }

  const imagesToAudit = crawl.imageUrls.slice(0, 3);
  for (const imgUrl of imagesToAudit) {
    const analysis = await analyzeImage(
      imgUrl,
      `Analyze this image for brand compliance. Guidelines: ${guidelines.slice(0, 500)}. List issues as bullet points.`
    );
    for (const issue of analysis.issues) {
      findings.push({
        type: 'visual',
        severity: 'warning',
        description: issue,
        source: imgUrl,
      });
    }
  }

  return {
    url: crawl.url,
    findings,
    summary: `Found ${findings.length} issues (${findings.filter((f) => f.severity === 'critical').length} critical)`,
    auditedAt: new Date().toISOString(),
  };
}
