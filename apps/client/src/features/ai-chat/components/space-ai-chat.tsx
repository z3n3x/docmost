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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  createAiChat,
  sendAiChatMessage,
  type AiChatSource,
} from "@/features/ai-chat/services/ai-chat-service";

interface SpaceAiChatProps {
  spaceId: string;
  spaceSlug: string;
  spaceName?: string;
}

const STREAM_RENDER_INTERVAL_MS = 32;

function renderInlineMarkdown(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^]]+\]\(https?:\/\/[^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > last) result.push(value.slice(last, match.index));
    const token = match[0];
    const link = token.match(/^\[([^]]+)\]\((https?:\/\/[^)]+)\)$/);

    if (link) {
      result.push(<a key={key++} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      result.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      result.push(<code key={key++} style={{ fontFamily: "monospace" }}>{token.slice(1, -1)}</code>);
    } else {
      result.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < value.length) result.push(value.slice(last));
  return result;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] = [];
  let inCode = false;
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<Text key={key++} component="div" lh={1.6} mb="xs">{renderInlineMarkdown(paragraph.join(" "))}</Text>);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={key++} style={{ marginTop: 4, marginBottom: 10, paddingLeft: 24 }}>{list.map((item, index) => <li key={index} style={{ marginBottom: 4 }}>{renderInlineMarkdown(item)}</li>)}</ul>);
    list = [];
  };

  const flushCode = () => {
    blocks.push(<Box key={key++} component="pre" p="sm" mb="sm" style={{ overflowX: "auto", borderRadius: 4, background: "var(--mantine-color-default-hover)" }}><code>{code.join("\n")}</code></Box>);
    code = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      else { flushParagraph(); flushList(); }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }

    if (!line.trim()) { flushParagraph(); flushList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const size = heading[1].length === 1 ? "lg" : heading[1].length === 2 ? "md" : "sm";
      blocks.push(<Text key={key++} fw={700} size={size} mt="sm" mb={4}>{renderInlineMarkdown(heading[2])}</Text>);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) { flushParagraph(); list.push(bullet[1]); continue; }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(<Text key={key++} component="div" c="dimmed" pl="sm" mb="xs" style={{ borderLeft: "2px solid var(--mantine-color-default-border)" }}>{renderInlineMarkdown(quote[1])}</Text>);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) flushCode();
  flushParagraph();
  flushList();
  return <>{blocks}</>;
}

export function SpaceAiChat({ spaceId, spaceSlug, spaceName }: SpaceAiChatProps) {
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
  const streamedAnswerRef = useRef("");
  const pendingStreamTextRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const lastStreamRenderRef = useRef(0);

  const flushStream = (force = false) => {
    if (!pendingStreamTextRef.current) return;
    const now = performance.now();
    if (!force && now - lastStreamRenderRef.current < STREAM_RENDER_INTERVAL_MS) return;
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
    if (streamFrameRef.current !== null) cancelAnimationFrame(streamFrameRef.current);
    streamFrameRef.current = null;
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
      if (!chatIdRef.current) chatIdRef.current = await createAiChat(spaceId);
      await sendAiChatMessage(chatIdRef.current, content, {
        onSources: setSources,
        onSuggestions: setSuggestions,
        onContent: appendStreamText,
        onDone: () => flushStream(true),
        onError: (message) => { flushStream(true); setError(message); },
      }, abortRef.current.signal);
      flushStream(true);
      setMessage("");
    } catch (err) {
      flushStream(true);
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Не удалось выполнить запрос к AI");
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
      setError("Не удалось скопировать ответ");
    }
  };

  const placeholder = spaceName ? `Спросить у агента о «${spaceName}»` : "Спросить у агента об этом пространстве";

  return (
    <Box pos="fixed" bottom={16} left="50%" style={{ zIndex: 200, width: "min(760px, calc(100vw - 32px))", transform: "translateX(-50%)" }}>
      <Collapse expanded={open} transitionDuration={180}>
        <Paper withBorder shadow="md" radius="sm" mb={8} p="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs"><IconSparkles size={18} /><Text fw={600}>AI-чат пространства</Text></Group>
            <Group gap={4}>
              {answer && !loading && <Tooltip label={copied ? "Скопировано" : "Скопировать ответ"}><ActionIcon variant="subtle" onClick={() => void copyAnswer()} aria-label="Скопировать ответ">{copied ? <IconCheck size={17} /> : <IconCopy size={17} />}</ActionIcon></Tooltip>}
              <ActionIcon variant="subtle" onClick={() => setOpen(false)} aria-label="Закрыть AI-чат"><IconX size={18} /></ActionIcon>
            </Group>
          </Group>

          <ScrollArea.Autosize mah={360}>
            {answer ? <MarkdownContent content={answer} /> : loading ? <Group gap="xs" c="dimmed" py="xs"><Text size="sm">Думаю</Text><Text component="span" aria-label="AI обрабатывает запрос"><span className="ai-chat-thinking-dots">•••</span></Text></Group> : null}
            {loading && <Group justify="flex-end" mt="sm"><Button variant="subtle" size="xs" leftSection={<IconPlayerStop size={14} />} onClick={stop}>Остановить</Button></Group>}
            {error && <Group justify="space-between" align="center" mt="sm" gap="sm"><Text c="red" size="sm">{error}</Text>{lastPromptRef.current && <Button variant="light" color="red" size="xs" leftSection={<IconRefresh size={14} />} onClick={retry}>Повторить</Button>}</Group>}
            {suggestions.length > 0 && !loading && <Stack gap="xs" mt="md"><Text size="xs" c="dimmed" fw={600}>Попробуйте спросить о</Text><Group gap="xs">{suggestions.map((suggestion) => <Button key={suggestion.pageId} variant="light" size="xs" leftSection={<IconFileText size={14} />} onClick={() => void submit(`Расскажи о странице «${suggestion.title}»`)}>{suggestion.title}</Button>)}</Group></Stack>}
            {sources.length > 0 && <Stack gap={4} mt="md"><Text size="xs" c="dimmed" fw={600}>Источники</Text>{sources.map((source, index) => <Text key={source.pageId} size="sm" component={Link} to={`/s/${spaceSlug}/p/${source.slugId}`} c="dimmed">[{index + 1}] {source.title}</Text>)}</Stack>}
          </ScrollArea.Autosize>
        </Paper>
      </Collapse>

      <Paper withBorder shadow="sm" radius="sm" p={6}>
        <Textarea
          autosize minRows={1} maxRows={4} value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
          placeholder={placeholder}
          rightSection={<ActionIcon variant="filled" radius="sm" size="sm" onClick={() => void submit()} loading={loading} disabled={!message.trim()} aria-label="Отправить запрос"><IconArrowUp size={15} /></ActionIcon>}
          rightSectionWidth={42} radius="sm"
        />
      </Paper>
    </Box>
  );
}
