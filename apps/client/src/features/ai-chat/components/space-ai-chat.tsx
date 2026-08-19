import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconArrowUp, IconSparkles, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAiChat,
  sendAiChatMessage,
  type AiChatSource,
} from "@/features/ai-chat/services/ai-chat-service";

interface SpaceAiChatProps {
  spaceId: string;
  spaceSlug: string;
}

export function SpaceAiChat({ spaceId, spaceSlug }: SpaceAiChatProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AiChatSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatIdRef.current = null;
    abortRef.current?.abort();
    setLoading(false);
    setAnswer("");
    setSources([]);
    setError(null);
    setMessage("");
  }, [spaceId]);

  const submit = async () => {
    const content = message.trim();
    if (!content || loading) return;

    setOpen(true);
    setLoading(true);
    setError(null);
    setAnswer("");
    setSources([]);
    abortRef.current = new AbortController();

    try {
      if (!chatIdRef.current) {
        chatIdRef.current = await createAiChat(spaceId);
      }

      await sendAiChatMessage(
        chatIdRef.current,
        content,
        {
          onSources: setSources,
          onContent: (text) => setAnswer((current) => current + text),
          onError: (message) => setError(message),
        },
        abortRef.current.signal,
      );
      setMessage("");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "AI request failed");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <Box
      pos="fixed"
      bottom={16}
      left="50%"
      style={{
        zIndex: 200,
        width: "min(760px, calc(100vw - 32px))",
        transform: "translateX(-50%)",
      }}
    >
      <Collapse in={open}>
        <Paper withBorder shadow="md" radius="lg" mb={8} p="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconSparkles size={18} />
              <Text fw={600}>Ask this space</Text>
            </Group>
            <ActionIcon
              variant="subtle"
              onClick={() => setOpen(false)}
              aria-label="Close AI chat"
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>

          <ScrollArea.Autosize mah={360}>
            {answer ? (
              <Text style={{ whiteSpace: "pre-wrap" }}>{answer}</Text>
            ) : loading ? (
              <Text c="dimmed">Thinking…</Text>
            ) : null}

            {error && <Text c="red" mt="sm">{error}</Text>}

            {sources.length > 0 && (
              <Stack gap={4} mt="md">
                <Text size="xs" c="dimmed" fw={600}>Sources</Text>
                {sources.map((source, index) => (
                  <Text
                    key={source.pageId}
                    size="sm"
                    component={Link}
                    to={`/s/${spaceSlug}/p/${source.slugId}`}
                    c="dimmed"
                  >
                    [{index + 1}] {source.title}
                  </Text>
                ))}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </Paper>
      </Collapse>

      <Paper withBorder shadow="sm" radius="xl" p={6}>
        <Textarea
          autosize
          minRows={1}
          maxRows={4}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Ask anything about this space…"
          rightSection={
            <ActionIcon
              variant="filled"
              radius="xl"
              size="sm"
              onClick={() => void submit()}
              loading={loading}
              disabled={!message.trim()}
              aria-label="Ask AI"
            >
              <IconArrowUp size={15} />
            </ActionIcon>
          }
          rightSectionWidth={42}
          radius="xl"
        />
      </Paper>
    </Box>
  );
}
