import { Injectable, Logger } from '@nestjs/common';

interface RerankResponse {
  results?: Array<{
    index?: number;
    relevance_score?: number;
    score?: number;
  }>;
  data?: Array<{
    index?: number;
    relevance_score?: number;
    score?: number;
  }>;
}

@Injectable()
export class AiRerankerService {
  private readonly logger = new Logger(AiRerankerService.name);
  private readonly baseUrl = (process.env.AI_RERANKING_BASE_URL || 'http://172.16.0.171:11433/v1').replace(/\/$/, '');
  private readonly model = process.env.AI_RERANKING_MODEL || 'bge-reranker-v2-m3-Q8_0.gguf';
  private readonly timeoutMs = Number(process.env.AI_RERANKING_TIMEOUT_MS || 30000);
  private readonly enabled = process.env.AI_RERANKING_ENABLED !== 'false';

  async rerank(query: string, documents: string[], topN = documents.length): Promise<number[]> {
    if (!this.enabled || !documents.length || !query.trim()) {
      return documents.map((_, index) => index);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/reranking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_API_KEY && { Authorization: `Bearer ${process.env.AI_API_KEY}` }),
        },
        body: JSON.stringify({
          model: this.model,
          query,
          documents,
          top_n: topN,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Reranking API error: ${response.status} ${await response.text()}`);
      }

      const payload = (await response.json()) as RerankResponse;
      const results = payload.results || payload.data || [];
      const ranked = results
        .map((item) => ({
          index: item.index,
          score: item.relevance_score ?? item.score,
        }))
        .filter((item): item is { index: number; score: number } =>
          Number.isInteger(item.index) && Number.isFinite(item.score),
        )
        .sort((a, b) => b.score - a.score)
        .map((item) => item.index);

      if (!ranked.length) throw new Error('Reranking API returned no usable results');

      // Keep any omitted documents at the end rather than dropping them.
      const seen = new Set(ranked);
      for (let index = 0; index < documents.length; index++) {
        if (!seen.has(index)) ranked.push(index);
      }
      return ranked;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Reranking unavailable; keeping hybrid order: ${message}`);
      return documents.map((_, index) => index);
    } finally {
      clearTimeout(timeout);
    }
  }
}
