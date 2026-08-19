import api from "@/lib/api-client";

export interface IAiChatSource {
  index: number;
  pageId: string;
  slugId: string;
  title: string;
  highlight?: string;
}

export interface IAiChatResponse {
  answer: string;
  sources: IAiChatSource[];
}

export async function askSpaceAiChat(
  spaceId: string,
  message: string,
): Promise<IAiChatResponse> {
  const response = await api.post<IAiChatResponse>("/ai-chat", {
    spaceId,
    message,
  });

  return response.data;
}
