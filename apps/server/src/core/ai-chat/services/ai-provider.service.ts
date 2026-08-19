import { Injectable, Inject } from '@nestjs/common';
import { AiRetrievalService, RetrievalResult } from './ai-retrieval.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamCallback {
  onToken: (token: string) => Promise<void>;
  onError: (error: Error) => Promise<void>;
  onComplete: (usage?: { promptTokens: number; completionTokens: number }) => Promise<void>;
}

@Injectable()
export class AiProviderService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    @Inject('AI_API_KEY') apiKey?: string,
    @Inject('AI_BASE_URL') baseUrl?: string,
    @Inject('AI_MODEL') model?: string,
    @Inject('AI_MAX_TOKENS') maxTokens?: string,
  ) {
    this.apiKey = apiKey || process.env.AI_API_KEY || '';
    this.baseUrl = baseUrl || process.env.AI_BASE_URL || 'http://localhost:11434/v1';
    this.model = model || process.env.AI_MODEL || 'llama3.1:8b';
    this.maxTokens = parseInt(maxTokens || process.env.AI_MAX_TOKENS || '2048', 10);
  }

  /**
   * Отправка запроса к LLM с streaming поддержкой
   */
  async generateStream(
    messages: ChatMessage[],
    contextPages: RetrievalResult[],
    callback: StreamCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemPrompt = this.buildSystemPrompt(contextPages);
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.model,
          messages: fullMessages,
          stream: true,
          max_tokens: this.maxTokens,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') {
                callback.onComplete();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                  callback.onToken(token);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      callback.onComplete();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      callback.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Построение системного промпта с контекстом из страниц
   */
  private buildSystemPrompt(contextPages: RetrievalResult[]): string {
    let prompt = `You are a helpful assistant for Docmost wiki.
You answer questions based on the provided context from wiki pages.
If you don't know the answer or it's not in the context, say so honestly.
Always cite your sources by mentioning page titles.

`;

    if (contextPages.length > 0) {
      prompt += '\n=== RELEVANT PAGES ===\n\n';
      contextPages.forEach((page, index) => {
        prompt += `[Page ${index + 1}]: ${page.title}\nSlug: ${page.slugId}\nSpace: ${page.spaceId}\n\n`;
        // Ограничиваем контент разумным размером
        const truncatedContent = page.content.slice(0, 3000);
        prompt += `${truncatedContent}\n\n`;
      });
      prompt += '\n=== END OF CONTEXT ===\n\n';
    } else {
      prompt += '\nNo specific context pages were provided. Answer based on your general knowledge.\n\n';
    }

    prompt += `Remember:\n- Cite pages when using information from them\n- If context doesn't contain the answer, acknowledge that\n- Be concise and helpful\n`;

    return prompt;
  }

  /**
   * Проверка доступности сервиса
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
