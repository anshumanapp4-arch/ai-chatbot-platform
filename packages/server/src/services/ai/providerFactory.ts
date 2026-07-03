// ============================================
// AI Provider Factory
// ============================================

import type { LLMProviderInterface, EmbeddingProviderInterface } from './providers/interface.js';
import { OpenAILLMProvider, OpenAIEmbeddingProvider } from './providers/openai.js';

/**
 * Get LLM provider instance based on provider name
 */
export function getLLMProvider(provider: string, model?: string): LLMProviderInterface {
  switch (provider) {
    case 'openai':
      return new OpenAILLMProvider(model);
    case 'gemini':
      // TODO: Implement Gemini provider
      throw new Error('Gemini LLM provider not yet implemented');
    case 'claude':
      // TODO: Implement Claude provider
      throw new Error('Claude LLM provider not yet implemented');
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Get Embedding provider instance based on provider name
 */
export function getEmbeddingProvider(provider: string, model?: string): EmbeddingProviderInterface {
  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider(model);
    case 'gemini':
      throw new Error('Gemini embedding provider not yet implemented');
    case 'claude':
      throw new Error('Claude embedding provider not yet implemented');
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
