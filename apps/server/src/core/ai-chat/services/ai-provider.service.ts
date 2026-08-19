import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

interface AiMessage {
  role: 'system' | 'user';
  content: string;
}

@Injectable()
export class AiProviderService {
  constructor(private readonly environmentService: EnvironmentService) {}

  async complete(messages: AiMessage[]): Promise<string> {
    const driver = this.environmentService.getAiDriver()?.toLowerCase();

    if (!driver) {
      throw new BadRequestException(
        'AI is not configured. Set AI_DRIVER and the corresponding provider settings.',
      );
    }

    if (driver === 'ollama') {
      return this.completeOllama(messages);
    }

    if (driver === 'openai' || driver === 'openai-compatible') {
      return this.completeOpenAi(messages);
    }

    if (driver === 'gemini' || driver === 'google') {
      return this.completeGemini(messages);
    }

    throw new BadRequestException(`Unsupported AI driver: ${driver}`);
  }

  private async completeOpenAi(messages: AiMessage[]): Promise<string> {
    const apiKey = this.environmentService.getOpenAiApiKey();
    const baseUrl = (
      this.environmentService.getOpenAiApiUrl() || 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model = this.environmentService.getAiChatModel();

    if (!apiKey || !model) {
      throw new BadRequestException(
        'OpenAI AI requires OPENAI_API_KEY and AI_CHAT_MODEL (or AI_COMPLETION_MODEL).',
      );
    }

    return this.postChatCompletions(`${baseUrl}/chat/completions`, apiKey, model, messages);
  }

  private async completeOllama(messages: AiMessage[]): Promise<string> {
    const baseUrl = this.environmentService.getOllamaApiUrl().replace(/\/$/, '');
    const model = this.environmentService.getAiChatModel();

    if (!model) {
      throw new BadRequestException(
        'Ollama AI requires AI_CHAT_MODEL (or AI_COMPLETION_MODEL).',
      );
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Ollama request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || '';
  }

  private async completeGemini(messages: AiMessage[]): Promise<string> {
    const apiKey = this.environmentService.getGeminiApiKey();
    const model = this.environmentService.getAiChatModel();

    if (!apiKey || !model) {
      throw new BadRequestException(
        'Gemini AI requires GEMINI_API_KEY and AI_CHAT_MODEL (or AI_COMPLETION_MODEL).',
      );
    }

    const system = messages.find((message) => message.role === 'system')?.content;
    const contents = messages
      .filter((message) => message.role === 'user')
      .map((message) => ({
        role: 'user',
        parts: [{ text: message.content }],
      }));

    const body: Record<string, unknown> = { contents };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Gemini request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    return (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || ''
    );
  }

  private async postChatCompletions(
    url: string,
    apiKey: string,
    model: string,
    messages: AiMessage[],
  ): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.1 }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `OpenAI-compatible request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
}
