import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { chatWithAssistant, AI_MODE, AI_MODEL, type ChatMessage } from "@/services/aiService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "SOC Assistant | SentinelView" },
      {
        name: "description",
        content: "Context-aware AI assistant for SOC analysts, powered locally by Qwen2.5.",
      },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "What does MITRE T1110.001 mean?",
  "How do I block an IP that is repeatedly failing SSH logins?",
  "Explain Wazuh rule levels",
  "What does a T1003.001 alert mean and how do I respond?",
];

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const reply = await chatWithAssistant(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "I couldn't reach the local model. Make sure Ollama is running and `qwen2.5:14b` is pulled.",
        },
      ]);
    } finally {
      setPending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="space-y-5">
      <div className="soc-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            SOC Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about alerts, MITRE techniques, or response actions. Runs locally —
            no data leaves the machine.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-primary font-medium">
            {AI_MODE === "mock" ? "Mock model" : AI_MODEL}
          </span>
        </div>
      </div>

      <Card className="soc-card soc-rise soc-delay-1">
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="h-[60vh] overflow-y-auto px-4 py-5 md:px-6"
          >
            {messages.length === 0 && !pending && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="mt-3 text-sm font-medium">How can I help today?</div>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  I have context on Wazuh rules, MITRE ATT&CK techniques, and SOC playbooks.
                </p>
                <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-md border border-border bg-card/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              {pending && (
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-background/50 p-3"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a MITRE technique, rule ID, or response action…"
              disabled={pending}
              className="flex-1"
            />
            <Button type="submit" disabled={pending || !input.trim()} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          isUser ? "bg-muted text-foreground" : "bg-primary/15 text-primary"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div
        className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "border-primary/30 bg-primary/10"
            : "border-border bg-card/50"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2 prose-code:text-primary prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background prose-pre:border prose-pre:border-border">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}