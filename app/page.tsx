"use client";

import { useEffect, useRef, useState } from "react";
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading AI...");
  const [ready, setReady] = useState(false);

  const engineRef = useRef<MLCEngine | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAI() {
      try {
        setStatus("Loading AI model...");

        const engine = await CreateMLCEngine(MODEL, {
          initProgressCallback: (progress) => {
            if (!cancelled) {
              setStatus(progress.text);
            }
          },
        });

        if (cancelled) return;

        engineRef.current = engine;
        setReady(true);
        setStatus("AI ready");
      } catch (error) {
        console.error("AI loading error:", error);

        if (!cancelled) {
          setStatus(
            "Could not load the AI. Please use a browser with WebGPU support."
          );
        }
      }
    }

    loadAI();

    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage() {
    if (!input.trim() || loading || !ready || !engineRef.current) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `
You are My AI, a friendly and helpful AI assistant.

Understand the user's question even when:
- there are spelling mistakes
- grammar is incorrect
- words are shortened
- the user writes casually
- the user mixes simple English with common Indian English

Answer questions across many subjects.

When explaining a difficult concept:
1. Start with a very simple explanation.
2. Explain it as if teaching a five-year-old when appropriate.
3. Give a simple real-world example.
4. Then provide the more detailed technical explanation.
5. Use headings and bullet points when they make the answer easier to understand.

Be conversational and helpful.

If the user asks a technical question, provide accurate technical details and examples.

If the question is genuinely unclear, ask a short clarification question instead of guessing.

Do not claim that you searched the internet or accessed information that you did not actually access.

Keep answers reasonably organized and avoid unnecessary repetition.
            `,
          },
          ...newMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I couldn't generate an answer.";

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      console.error("AI response error:", error);

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't generate a response. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="min-h-screen bg-[#212121] text-white flex flex-col">

      <header className="h-14 border-b border-white/10 flex items-center justify-between px-5">
        <h1 className="font-semibold text-lg">
          My AI
        </h1>

        <div className="text-xs text-gray-400">
          {ready ? "● AI Ready" : status}
        </div>
      </header>

      <section className="flex-1 overflow-y-auto">

        {messages.length === 0 ? (
          <div className="min-h-[75vh] flex items-center justify-center">
            <div className="text-center px-5">

              <h2 className="text-3xl font-semibold mb-3">
                How can I help you?
              </h2>

              <p className="text-gray-400 mb-6">
                Ask me anything.
              </p>

              {!ready && (
                <div className="max-w-md mx-auto">
                  <div className="bg-[#2f2f2f] rounded-xl px-4 py-3 text-sm text-gray-300">
                    {status}
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    The AI model is loaded directly in your browser.
                    The first load may take some time.
                  </p>
                </div>
              )}

            </div>
          </div>
        ) : (

          <div className="max-w-3xl mx-auto px-4 py-8">

            {messages.map((message, index) => (

              <div
                key={index}
                className={`flex mb-6 ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-blue-600"
                      : "bg-[#2f2f2f]"
                  }`}
                >
                  {message.content}
                </div>

              </div>

            ))}

            {loading && (
              <div className="bg-[#2f2f2f] rounded-2xl px-4 py-3 inline-block">
                Thinking...
              </div>
            )}

          </div>

        )}

      </section>

      <footer className="border-t border-white/10 p-4">

        <div className="max-w-3xl mx-auto">

          <div className="bg-[#2f2f2f] rounded-2xl flex items-end p-2">

            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={
                ready
                  ? "Message My AI..."
                  : "Loading AI..."
              }
              rows={1}
              disabled={!ready || loading}
              className="flex-1 bg-transparent resize-none outline-none px-3 py-3 placeholder-gray-500 disabled:opacity-50"
            />

            <button
              onClick={sendMessage}
              disabled={
                !ready ||
                loading ||
                !input.trim()
              }
              className="bg-white text-black rounded-xl px-4 py-3 font-semibold disabled:opacity-30"
            >
              ↑
            </button>

          </div>

          <p className="text-center text-xs text-gray-500 mt-2">
            My AI runs locally in your browser. AI responses may contain mistakes.
          </p>

        </div>

      </footer>

    </main>
  );
}
