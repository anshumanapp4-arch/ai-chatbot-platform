// ============================================
// AI Provider Interfaces
// ============================================

export interface LLMProviderInterface {
  /**
   * Generate a chat completion given a list of messages
   */
  chatCompletion(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

export interface EmbeddingProviderInterface {
  /**
   * Generate embeddings for one or more texts
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Get the embedding dimension for this provider/model
   */
  getDimension(): number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: string;
}
