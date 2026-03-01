"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { trading } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  subscriptionId: number;
  modelName: string;
  capital: number | null;
  onSetCapital: (amount: number) => void;
  onReady: () => void;
}

export default function StrategyAgent({ subscriptionId, modelName, capital, onSetCapital, onReady }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 Hi! I'm your AI assistant for **${modelName}**. I know this strategy inside out.\n\nI can help you:\n- Understand the strategy logic\n- Decide how much capital to allocate\n- Discuss risk management\n- Suggest modifications\n\nWhat would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await trading.agentChat(
        subscriptionId,
        userMsg,
        newMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        capital ?? undefined,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);

      // Parse capital from response if mentioned
      const capitalMatch = res.response.match(/\$(\d[\d,]*(?:\.\d{2})?)/);
      if (capitalMatch && !capital) {
        const parsed = parseFloat(capitalMatch[1].replace(/,/g, ""));
        if (parsed > 0 && parsed < 1_000_000) {
          // Don't auto-set, let the user decide
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "How does this strategy work?",
    "What's the risk level?",
    "How much should I invest?",
    "What profit sharing do I pay?",
    "Can I modify the stop-loss?",
    "I'm ready to trade",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-toll-blue to-indigo-500 flex items-center justify-center">
            <Icon name="smart_toy" className="text-white text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Strategy Agent</h3>
            <p className="text-[10px] text-slate-500">Trained on {modelName}</p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
            Online
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-toll-blue text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}
            >
              <div
                className="prose prose-sm prose-slate max-w-none [&_p]:mb-1 [&_ul]:mt-1 [&_li]:my-0.5"
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n- /g, "<br/>• ")
                    .replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setInput(prompt);
                setTimeout(() => {
                  setInput(prompt);
                  send();
                }, 50);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-600 hover:bg-toll-blue/5 hover:border-toll-blue/20 hover:text-toll-blue transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about the strategy..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-toll-blue/30 focus:ring-2 focus:ring-toll-blue/10"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-toll-blue text-white rounded-xl text-sm font-medium hover:bg-toll-blue-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="send" className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}
