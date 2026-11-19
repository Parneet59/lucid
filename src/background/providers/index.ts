import type { ExplainConfig, ExplainRequest, ProviderId } from '../../shared/explain';
import { anthropicProvider } from './anthropic';

// A provider streams an explanation. Add OpenAI, Gemini, a local model, etc.
// by implementing this and registering it here and in shared/explain.ts.
export interface Provider {
  explain(cfg: ExplainConfig, req: ExplainRequest, onText: (t: string) => void, signal: AbortSignal): Promise<void>;
  test(cfg: ExplainConfig): Promise<void>;
  describeError(err: unknown): { error: string; needsKey?: boolean };
}

const providers: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
};

export const getProvider = (id: ProviderId): Provider => providers[id] ?? anthropicProvider;

export const SYSTEM_PROMPT = `You help someone understand a passage while they read an article.
They selected some text and want it explained in plain language.

- If the selection is a word, name, or term: say what it means here, in this article's context.
- If it is a phrase or sentence: say what it means in simpler words, and why it matters to the point being made.
- Use the surrounding paragraph for context. Do not summarise the whole article.
- Be brief: two to four short sentences. No headings, no preamble, no restating the question.
- If the meaning is genuinely unclear from the text, say so and give the most likely reading.`;

export function userPrompt(req: ExplainRequest): string {
  return [
    `Article: ${req.title}`,
    `URL: ${req.url}`,
    '',
    '<context>',
    req.context,
    '</context>',
    '',
    '<selection>',
    req.selection,
    '</selection>',
    '',
    'Explain the selection.',
  ].join('\n');
}
