import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconArrowUp, IconSparkles, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { askSpaceAiChat, IAiChatResponse } from "@/features/ai-chat/services/ai-chat-service";

interface SpaceAiChatProps {
  spaceId: string;
  spaceSlug: string;
}

export function SpaceAiChat({ spaceId, spaceSlug }: SpaceAiChatProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<IAiChatResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const value = message.trim();
    if (!value || loading) return;

    setLoading(true);
    setOpen(true);

    try {
      const result = await askSpaceAiChat(spaceId, value);
      setResponse(result);
      setMessage("");
    } finally {
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
            <ActionIcon variant="subtle" onClick={() => setOpen(false)} aria-label="Close AI chat">
              <IconX size={18} />
            </ActionIcon>
          </Group>

          <ScrollArea.Autosize mah={360}>
            {loading && <Text c="dimmed">Thinking…</Text>}
            {!loading && response && (
              <Stack gap="sm">
                <Text style={{ whiteSpace: "pre-wrap" }}>{response.answer}</Text>
                {response.sources.length > 0 && (
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" fw={600}>Sources</Text>
                    {response.sources.map((source) => (
                      <Text
                        key={source.pageId}
                        size="sm"
                        component={Link}
                        to={`/s/${spaceSlug}/p/${source.slugId}`}
                        c="dimmed"
                      >
                        [{source.index}] {source.title}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </Paper>
      </Collapse>

      <Paper withBorder shadow="sm" radius="xl" p={6}>
        <TextInput
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
          leftSection={<IconSparkles size={18} />}
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
          radius="xl"
        />
      </Paper>
    </Box>
  );
}
