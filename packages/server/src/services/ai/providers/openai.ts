// ============================================
// OpenAI Provider — LLM & Embeddings
// ============================================

import OpenAI from 'openai';
import { config } from '../../../config/index.js';
import type { LLMProviderInterface, EmbeddingProviderInterface, ChatMessage, LLMOptions, LLMResponse } from './interface.js';

export class OpenAILLMProvider implements LLMProviderInterface {
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = model || config.openai.chatModel;
  }

  async chatCompletion(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens ?? 2048,
      response_format: options?.response_format,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || '',
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
      finish_reason: choice.finish_reason || 'stop',
    };
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProviderInterface {
  private client: OpenAI;
  private model: string;
  private dimension: number;

  constructor(model?: string) {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = model || config.openai.embeddingModel;
    // text-embedding-3-small = 1536, text-embedding-3-large = 3072
    this.dimension = this.model.includes('large') ? 3072 : 1536;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Process in batches of 100 (OpenAI limit per request)
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });

      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  getDimension(): number {
    return this.dimension;
  }
}
