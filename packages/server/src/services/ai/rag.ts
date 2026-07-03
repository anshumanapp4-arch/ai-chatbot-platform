// ============================================
// RAG Pipeline — Retrieve & Generate
// ============================================

import { query } from '../../db/client.js';
import { getLLMProvider, getEmbeddingProvider } from './providerFactory.js';
import { buildSystemPrompt } from './promptBuilder.js';
import { extractLeadOrder } from './leadCapture.js';
import type { Tenant, Message, Citation } from '@chatbot/shared';
import { logger } from '../../utils/logger.js';

interface RAGResult {
  response: string;
  citations: Citation[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  leadCaptured: any | null;
}

/**
 * Execute the full RAG pipeline:
 * 1. Embed the user's question
 * 2. Vector search for relevant chunks (tenant-scoped)
 * 3. Build prompt with context + conversation history
 * 4. LLM completion
 * 5. Check for lead/order extraction
 */
export async function ragPipeline(
  tenant: Tenant,
  userMessage: string,
  conversationHistory: Message[],
  conversationId: string
): Promise<RAGResult> {
  const embeddingProvider = getEmbeddingProvider(tenant.embedding_provider, tenant.embedding_model);
  const llmProvider = getLLMProvider(tenant.llm_provider, tenant.llm_model);

  // 1. Embed the user's question
  const [questionEmbedding] = await embeddingProvider.generateEmbeddings([userMessage]);
  const embeddingStr = `[${questionEmbedding.join(',')}]`;

  // 2. Vector similarity search — tenant-scoped
  const searchResult = await query(
    `SELECT c.id, c.content, c.metadata, c.source_id,
            1 - (c.embedding <=> $1::vector) as similarity
     FROM chunks c
     WHERE c.tenant_id = $2 AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT 5`,
    [embeddingStr, tenant.id]
  );

  const relevantChunks = searchResult.rows;
  const citations: Citation[] = relevantChunks.map(chunk => ({
    source_id: chunk.source_id,
    chunk_id: chunk.id,
    snippet: chunk.content.slice(0, 200),
  }));

  // 3. Build the prompt
  const contextText = relevantChunks.length > 0
    ? relevantChunks.map((c, i) => `[Source ${i + 1}]: ${c.content}`).join('\n\n')
    : 'No relevant information found in the knowledge base.';

  const systemPrompt = buildSystemPrompt(tenant, contextText);

  // Build conversation messages
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    // Include last 10 messages for context
    ...conversationHistory.slice(-10).map(m => ({
      role: (m.role === 'customer' ? 'user' : m.role) as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  // 4. LLM completion
  const llmResponse = await llmProvider.chatCompletion(messages, {
    temperature: 0.3,
    max_tokens: 1024,
  });

  // 5. Check for lead/order extraction (async, non-blocking for response)
  let leadCaptured = null;
  try {
    leadCaptured = await extractLeadOrder(
      llmProvider,
      tenant,
      conversationHistory,
      userMessage,
      llmResponse.content,
      conversationId
    );
  } catch (error) {
    logger.error('Lead extraction failed', { error: String(error) });
  }

  return {
    response: llmResponse.content,
    citations: relevantChunks.length > 0 ? citations : [],
    usage: llmResponse.usage,
    leadCaptured,
  };
}
