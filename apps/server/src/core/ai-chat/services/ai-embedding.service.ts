import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiEmbeddingService {
  private readonly logger = new Logger(AiEmbeddingService.name);
  private readonly baseUrl = process.env.AI_EMBEDDINGS_BASE_URL || 'http://172.16.0.171:11432/v1';
  private readonly model = process.env.AI_EMBEDDINGS_MODEL || 'bge-m3-Q8_0.gguf';
  private readonly timeoutMs = Number(process.env.AI_EMBEDDINGS_TIMEOUT_MS || 30000);

  async embed(input: string | string[]): Promise<number[][]> {
    const values = Array.isArray(input) ? input : [input];
    if (values.length === 0) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_API_KEY && { Authorization: `Bearer ${process.env.AI_API_KEY}` }),
        },
        body: JSON.stringify({ model: this.model, input: values }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${await response.text()}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ index?: number; embedding?: number[] }>;
      };
      const data = payload.data || [];
      const ordered = new Array<number[]>(values.length);

      for (const item of data) {
        if (item.embedding && typeof item.index === 'number') ordered[item.index] = item.embedding;
      }

      if (ordered.some((embedding) => !embedding?.length)) {
        throw new Error('Embedding API returned incomplete embeddings');
      }

      return ordered;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Embedding request failed: ${normalized.message}`);
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
}
