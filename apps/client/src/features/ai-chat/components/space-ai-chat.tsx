import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowUp,
  IconCheck,
  IconCopy,
  IconFileText,
  IconPlayerStop,
  IconRefresh,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
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

const STREAM_RENDER_INTERVAL_MS = 32;

export function SpaceAiChat({ spaceId, spaceSlug }: SpaceAiChatProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AiChatSource[]>([]);
  const [suggestions, setSuggestions] = useState<AiChatSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef("");

  // Streaming can produce many tiny chunks per second. Keep the generated text
  // outside React state and publish it at most once per animation frame. This
  // prevents the whole message tree from re-rendering for every token/chunk.
  const streamedAnswerRef = useRef("");
  const pendingStreamTextRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const lastStreamRenderRef = useRef(0);

  const flushStream = (force = false) => {
    if (!pendingStreamTextRef.current) return;

    const now = performance.now();
    if (!force && now - lastStreamRenderRef.current < STREAM_RENDER_INTERVAL_MS) {
      return;
    }

    streamedAnswerRef.current += pendingStreamTextRef.current;
    pendingStreamTextRef.current = "";
    lastStreamRenderRef.current = now;
    setAnswer(streamedAnswerRef.current);
  };

  const scheduleStreamFlush = () => {
    if (streamFrameRef.current !== null) return;

    streamFrameRef.current = requestAnimationFrame(() => {
      streamFrameRef.current = null;
      flushStream();

      // If another chunk arrived while the frame was being processed, make sure
      // it is not left waiting indefinitely when the browser is busy.
      if (pendingStreamTextRef.current) {
        streamFrameRef.current = requestAnimationFrame(() => {
          streamFrameRef.current = null;
          flushStream(true);
        });
      }
    });
  };

  const appendStreamText = (text: string) => {
    if (!text) return;
    pendingStreamTextRef.current += text;
    scheduleStreamFlush();
  };

  const resetStream = () => {
    if (streamFrameRef.current !== null) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
    pendingStreamTextRef.current = "";
    streamedAnswerRef.current = "";
    lastStreamRenderRef.current = 0;
  };

  useEffect(() => {
    chatIdRef.current = null;
    abortRef.current?.abort();
    resetStream();
    setLoading(false);
    setAnswer("");
    setSources([]);
    setSuggestions([]);
    setError(null);
    setMessage("");
    setCopied(false);
    lastPromptRef.current = "";

    return () => resetStream();
  }, [spaceId]);

  const submit = async (prompt = message) => {
    const content = prompt.trim();
    if (!content || loading) return;

    setOpen(true);
    setLoading(true);
    setError(null);
    resetStream();
    setAnswer("");
    setSources([]);
    setSuggestions([]);
    setMessage(content);
    setCopied(false);
    lastPromptRef.current = content;
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
          onSuggestions: setSuggestions,
          onContent: appendStreamText,
          onDone: () => flushStream(true),
          onError: (message) => {
            flushStream(true);
            setError(message);
          },
        },
        abortRef.current.signal,
      );
      flushStream(true);
      setMessage("");
    } catch (err) {
      flushStream(true);
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "AI request failed");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const stop = () => {
    flushStream(true);
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const retry = () => {
    if (lastPromptRef.current) void submit(lastPromptRef.current);
  };

  const copyAnswer = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy the answer");
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
      <Collapse expanded={open} transitionDuration={180}>
        <Paper withBorder shadow="md" radius="md" mb={8} p="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconSparkles size={18} />
              <Text fw={600}>Ask this space</Text>
            </Group>
            <Group gap={4}>
              {answer && !loading && (
                <Tooltip label={copied ? "Copied" : "Copy answer"}>
                  <ActionIcon variant="subtle" onClick={() => void copyAnswer()} aria-label="Copy answer">
                    {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
                  </ActionIcon>
                </Tooltip>
              )}
              <ActionIcon
                variant="subtle"
                onClick={() => setOpen(false)}
                aria-label="Close AI chat"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <ScrollArea.Autosize mah={360}>
            {answer ? (
              <Text style={{ whiteSpace: "pre-wrap" }}>{answer}</Text>
            ) : loading ? (
              <Group gap="xs" c="dimmed" py="xs">
                <Text size="sm">Thinking</Text>
                <Text component="span" aria-label="AI is thinking">
                  <span className="ai-chat-thinking-dots">•••</span>
                </Text>
              </Group>
            ) : null}

            {loading && (
              <Group justify="flex-end" mt="sm">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPlayerStop size={14} />}
                  onClick={stop}
                >
                  Stop
                </Button>
              </Group>
            )}

            {error && (
              <Group justify="space-between" align="center" mt="sm" gap="sm">
                <Text c="red" size="sm">{error}</Text>
                {lastPromptRef.current && (
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconRefresh size={14} />}
                    onClick={retry}
                  >
                    Retry
                  </Button>
                )}
              </Group>
            )}

            {suggestions.length > 0 && !loading && (
              <Stack gap="xs" mt="md">
                <Text size="xs" c="dimmed" fw={600}>
                  Try asking about
                </Text>
                <Group gap="xs">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.pageId}
                      variant="light"
                      size="xs"
                      leftSection={<IconFileText size={14} />}
                      onClick={() => void submit(`Tell me about "${suggestion.title}"`)}
                    >
                      {suggestion.title}
                    </Button>
                  ))}
                </Group>
              </Group>
            )}

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

      <Paper withBorder shadow="sm" radius="md" p={6}>
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
              radius="sm"
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
          radius="sm"
        />
      </Paper>
    </Box>
  );
}
