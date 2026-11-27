import { useState } from "react";
import { MessageCircle, Send, X, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { apiSendChatMessage } from "@/lib/backend";

type Message = { role: "assistant" | "user"; text: string };

export function ChatAssistant() {
  const { me, isPreview } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I can help with UMAppoint bookings, appointment statuses and live consultation availability." },
  ]);

  if (!me || isPreview) return null;

  async function send(value = draft) {
    const question = value.trim();
    if (!question || busy) return;
    setMessages((items) => [...items, { role: "user", text: question }]);
    setDraft("");
    setBusy(true);
    try {
      const reply = await apiSendChatMessage(question);
      setMessages((items) => [
        ...items,
        { role: "assistant", text: reply.answer },
        ...(reply.suggestions?.length
          ? [{ role: "assistant" as const, text: "You can also ask: " + reply.suggestions.join(" · ") }]
          : []),
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        { role: "assistant", text: error instanceof Error ? error.message : "I couldn't reach the UMAppoint assistant. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <section className="mb-3 flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div><p className="font-semibold">UMAppoint Assistant</p><p className="text-xs opacity-80">Booking help and live slots</p></div>
            </div>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80" onClick={() => setOpen(false)} aria-label="Close assistant"><X /></Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-8 rounded-xl bg-primary p-3 text-sm text-primary-foreground" : "mr-5 whitespace-pre-line rounded-xl bg-muted p-3 text-sm"}>
                {message.text}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking UMAppoint…</div>}
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about bookings or slots…" maxLength={1000} disabled={busy} />
            <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button>
          </form>
        </section>
      ) : null}
      <div className="flex justify-end">
        <Button className="h-12 rounded-full px-5 shadow-lg" onClick={() => setOpen((value) => !value)}>
          {open ? <X className="mr-2 h-4 w-4" /> : <MessageCircle className="mr-2 h-4 w-4" />}
          {open ? "Close" : "Ask UMAppoint"}
        </Button>
      </div>
    </div>
  );
}
