"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { ai } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface StrategyTabProps {
  strategyCode: string;
  asset: string;
  periods: number;
}

export default function StrategyTab({ strategyCode, asset, periods }: StrategyTabProps) {
  const router = useRouter();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [askingAi, setAskingAi] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleExplain = async () => {
    setLoadingExplanation(true);
    try {
      const res = await ai.explain(strategyCode, asset, periods);
      setExplanation(res.explanation);
    } catch (e) {
      setExplanation("Failed to generate explanation. Make sure your Gemini API key is set.");
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setAskingAi(true);
    try {
      const res = await ai.ask(strategyCode, question, [...messages, userMsg]);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process your question. Please try again." },
      ]);
    } finally {
      setAskingAi(false);
    }
  };

  return (
    <div className="p-6 space-y-6 flex flex-col h-full min-h-0">
      {/* Strategy Explanation */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Icon name="auto_awesome" className="text-purple-500 text-lg" />
            Strategy Explanation
          </h3>
          <button
            onClick={handleExplain}
            disabled={loadingExplanation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Icon name={loadingExplanation ? "hourglass_top" : "psychology"} className="text-sm" />
            {loadingExplanation ? "Analyzing..." : explanation ? "Re-analyze" : "Explain with AI"}
          </button>
        </div>

        {loadingExplanation && (
          <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-purple-700">Gemini is analyzing your strategy...</span>
          </div>
        )}

        {!loadingExplanation && explanation && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-strong:text-slate-800 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded overflow-y-auto max-h-48 custom-scrollbar">
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(explanation) }} />
          </div>
        )}

        {!loadingExplanation && !explanation && (
          <div className="bg-slate-50 rounded-lg border border-dashed border-slate-200 p-6 text-center">
            <Icon name="auto_awesome" className="text-3xl text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 mb-1">No explanation generated yet.</p>
            <p className="text-xs text-slate-400">
              Click &quot;Explain with AI&quot; to get a Gemini-powered breakdown.
            </p>
          </div>
        )}
      </section>

      <div className="h-px bg-slate-200" />

      {/* AI Chat */}
      <section className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Icon name="chat" className="text-toll-blue text-lg" />
          Ask About Strategy
        </h3>

        {/* Chat messages */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-3 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">Ask Gemini anything about your strategy</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What are the risks?",
                  "How can I improve Sharpe?",
                  "Add a stop-loss",
                  "Explain the entry logic",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQuestion(q); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-toll-blue text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-700 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm max-w-none prose-p:my-1 prose-code:text-purple-700 prose-code:bg-purple-50/50 prose-code:px-1 prose-code:rounded"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {askingAi && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-auto">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
            placeholder="Ask about your strategy..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue"
          />
          <button
            onClick={handleAsk}
            disabled={askingAi || !question.trim()}
            className="px-3 py-2 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          >
            <Icon name="send" className="text-lg" />
          </button>
        </div>
      </section>

      <div className="h-px bg-slate-200" />

      {/* Fine-tune CTA */}
      <section className="shrink-0">
        <button
          onClick={() => router.push("/compute")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-toll-blue to-purple-600 hover:from-toll-blue-dark hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-toll-blue/20"
        >
          <Icon name="tune" className="text-lg" />
          Fine-Tune in Cloud Notebook
          <Icon name="arrow_forward" className="text-sm" />
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          Opens the compute environment with GPU acceleration on Modal.ai
        </p>
      </section>
    </div>
  );
}

/* Minimal markdown → HTML converter for AI responses */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-900 text-green-300 p-3 rounded-md text-xs font-mono overflow-x-auto my-2"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Headings
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>')
    // List items
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p>")
    // Single newlines inside paragraphs
    .replace(/\n/g, "<br/>")
    // Wrap in paragraph
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
