export interface AiChatSource {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
}

export interface AiChatStreamHandlers {
  onSources?: (sources: AiChatSource[]) => void;
  onContent?: (text: string) => void;
  onDone?: (messageId?: string) => void;
  onError?: (message: string, code?: string) => void;
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
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        const payload = JSON.parse(dataLine.slice(6));
        switch (payload.type) {
          case "sources":
            handlers.onSources?.(payload.sources || []);
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
      }
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
  return chat.id;
}

export async function sendAiChatMessage(
  chatId: string,
  content: string,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/ai/chats/send", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, content }),
    signal,
  });

  await parseSseStream(response, handlers);
}
