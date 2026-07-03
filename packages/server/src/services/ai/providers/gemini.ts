// ============================================
// Gemini Provider — LLM & Embeddings (Native Fetch)
// ============================================

import type { LLMProviderInterface, EmbeddingProviderInterface, ChatMessage, LLMOptions, LLMResponse } from './interface.js';

// We load the Gemini API key from environment variables (fallback to OpenAI key if user uses OpenAI-compatible endpoint)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export class GeminiLLMProvider implements LLMProviderInterface {
  private model: string;
  private apiKey: string;

  constructor(model?: string) {
    this.model = model || 'gemini-1.5-flash';
    this.apiKey = GEMINI_API_KEY;
  }

  async chatCompletion(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    // Convert messages to Gemini API format
    const contents = messages
      .filter(m => m.role !== 'system') // Gemini handles system instruction separately
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content;

    const payload = {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.max_tokens ?? 2048,
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json() as any;

    if (!res.ok) {
      console.error('Gemini API Error:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || 'Gemini API request failed');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = data.usageMetadata?.totalTokenCount || 0;

    return {
      content: text,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: candidatesTokens,
        total_tokens: totalTokens,
      },
      finish_reason: 'stop',
    };
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProviderInterface {
  private model: string;
  private apiKey: string;
  private dimension: number;

  constructor(model?: string) {
    this.model = model || 'gemini-embedding-2';
    this.apiKey = GEMINI_API_KEY;
    this.dimension = 1536; // Standard vector size for OpenAI migration compat
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const allEmbeddings: number[][] = [];
    const batchSize = 100;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const requests = batch.map(text => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        outputDimensionality: 1536,
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        }
      );

      const data = await res.json() as any;

      if (!res.ok) {
        console.error('Gemini Embedding API Error:', JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || 'Gemini embedding generation failed');
      }

      if (data.embeddings) {
        for (const item of data.embeddings) {
          allEmbeddings.push(item.values);
        }
      }
    }

    return allEmbeddings;
  }

  getDimension(): number {
    return this.dimension;
  }
}
