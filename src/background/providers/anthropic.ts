import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from './index';
import { SYSTEM_PROMPT, userPrompt } from './index';

function client(apiKey: string): Anthropic {
  // The user supplies their own key and it never leaves their browser except
  // to call Anthropic, so a browser-side client is the intended setup here.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

export const anthropicProvider: Provider = {
  async explain(cfg, req, onText, signal) {
    const stream = client(cfg.apiKey).beta.messages.stream(
      {
        model: cfg.model,
        max_tokens: 2000,
        // Quick, short answers: keep thinking light.
        output_config: { effort: 'low' },
        // If the model declines, retry on a suitable fallback model server-side.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(req) }],
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('The model declined to explain this passage.');
    }
  },

  async test(cfg) {
    await client(cfg.apiKey).models.retrieve(cfg.model);
  },

  describeError,
};

function describeError(err: unknown): { error: string; needsKey?: boolean } {
  if (err instanceof Anthropic.AuthenticationError) return { error: 'Your API key was rejected. Check it in Lucid options.', needsKey: true };
  if (err instanceof Anthropic.PermissionDeniedError) return { error: "Your API key doesn't have access to this model." };
  if (err instanceof Anthropic.NotFoundError) return { error: 'Model not found. Pick another in Lucid options.' };
  if (err instanceof Anthropic.RateLimitError) return { error: 'Rate limited by Anthropic. Try again in a moment.' };
  if (err instanceof Anthropic.APIConnectionError) return { error: "Couldn't reach Anthropic. Check your connection." };
  if (err instanceof Anthropic.APIError) return { error: `Anthropic error ${err.status ?? ''}: ${err.message}` };
  return { error: String((err as Error)?.message ?? err) };
}
