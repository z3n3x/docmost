export interface AiChatSource {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
}

export interface AiChatStreamHandlers {
  onSources?: (sources: AiChatSource[]) => void;
  onSuggestions?: (suggestions: AiChatSource[]) => void;
  onContent?: (text: string) => void;
  onDone?: (messageId?: string) => void;
  onError?: (message: string, code?: string) => void;
}

function processSseEvent(event: string, handlers: AiChatStreamHandlers) {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return;

  try {
    const payload = JSON.parse(data);

    switch (payload.type) {
      case "sources":
        handlers.onSources?.(payload.sources || []);
        break;
      case "suggestions":
        handlers.onSuggestions?.(payload.suggestions || []);
        break;
      case "content":
        handlers.onContent?.(payload.text || "");
        break;
      case "done":
        handlers.onDone?.(payload.messageId);
        break;
      case "error":
        handlers.onError?.(payload.error || "AI generation failed", payload.code);
        break;
      default:
        break;
    }
  } catch {
    // Ignore malformed events and continue consuming the stream.
  }
}

async function parseSseStream(
  response: Response,
  handlers: AiChatStreamHandlers,
): Promise<void> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `AI request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("AI response stream is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        processSseEvent(event, handlers);
      }
    }

    // Some proxies/server implementations can close the stream without a final
    // blank line. Do not lose the last SSE event in that case.
    buffer += decoder.decode();
    if (buffer.trim()) {
      processSseEvent(buffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function createAiChat(spaceId: string): Promise<string> {
  const response = await fetch("/api/ai/chats/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaceId }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `Unable to create AI chat (${response.status})`);
  }

  const chat = await response.json();
  const chatId = chat?.id;

  if (typeof chatId !== "string" || !chatId) {
    throw new Error("AI chat was created but the server did not return a chat ID");
  }

  return chatId;
}

export async function sendAiChatMessage(
  chatId: string,
  content: string,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  if (!chatId) {
    throw new Error("AI chat ID is missing");
  }

  const response = await fetch("/api/ai/chats/send", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, content }),
    signal,
  });

  await parseSseStream(response, handlers);
}
