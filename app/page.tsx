"use client";

import { useEffect, useRef, useState } from "react";
import {
  CreateMLCEngine,
  MLCEngine,
} from "@mlc-ai/web-llm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

const SYSTEM_PROMPT = `
You are My AI, a friendly, intelligent, and helpful AI assistant.

GENERAL BEHAVIOR:
- Answer the user's actual question directly.
- Do not introduce yourself unnecessarily.
- Do not repeat generic information about being an AI.
- Do not say that you are constantly learning.
- Do not claim to have searched the internet unless a real web-search tool was used.
- Be natural, conversational, and helpful.
- Understand the context of previous messages.
- Remember relevant information from the current conversation and use it in follow-up questions.

UNDERSTANDING THE USER:
- Understand questions even when there are spelling mistakes.
- Understand grammar mistakes and casual wording.
- Understand shortened words and common Indian English.
- Understand simple Hindi and Hinglish when possible.
- If the meaning is clear despite mistakes, answer normally instead of correcting the user.
- Only ask for clarification when the question is genuinely unclear.

EXPLANATIONS:
When the user asks about a difficult topic:
1. Start with a very simple explanation.
2. Explain it in easy language, like teaching a five-year-old, when appropriate.
3. Give a simple real-world example.
4. Then explain the deeper or technical meaning.
5. Use headings, bullet points, and examples when helpful.

If the user specifically says:
"explain like I'm 5",
"explain simply",
"simple explanation",
"easy language",
or similar,
make the explanation especially easy to understand.

TECHNICAL QUESTIONS:
For programming, Data Science, Machine Learning, Python, SQL,
Power BI, Tableau, Excel, statistics, mathematics, and related topics:
- Give accurate explanations.
- Give practical examples.
- Provide code when useful.
- Explain the code when appropriate.
- Point out important mistakes or edge cases.
- Do not make up functions, libraries, or results.

CONVERSATION:
- Answer follow-up questions using the previous conversation.
- If the user says "it", "this", "that", "the above", or similar, determine what they are referring to from the conversation.
- Do not restart the explanation unnecessarily.
- If the user asks for more detail, expand the previous answer.

STYLE:
- Be friendly but not overly enthusiastic.
- Avoid unnecessary emojis.
- Avoid repetitive introductions.
- Keep simple questions concise.
- Give detailed answers when the user asks for detail.
- Use clear formatting.
`;

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

        if (cancelled) {
          return;
        }

        engineRef.current = engine;
        setReady(true);
        setStatus("AI Ready");
      } catch (error) {
        console.error("AI loading error:", error);

        if (!cancelled) {
          setStatus(
            "AI could not load. Please use a browser with WebGPU support."
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
    const trimmedInput = input.trim();

    if (
      !trimmedInput ||
      loading ||
      !ready ||
      !engineRef.current
    ) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: trimmedInput,
    };

    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response =
        await engineRef.current.chat.completions.create({
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            ...newMessages,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

      const answer =
        response.choices[0]?.message?.content?.trim() ||
        "I couldn't generate a response. Please try again.";

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
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
  }

  return (
    <main className="min-h-screen bg-[#212121] text-white flex flex-col">

      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-5">

        <button
          onClick={startNewChat}
          className="font-semibold text-lg hover:opacity-80"
        >
          My AI
        </button>

        <div className="flex items-center gap-3">

          <div className="text-xs text-gray-400">
            {ready ? "● AI Ready" : status}
          </div>

          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="text-xs bg-[#2f2f2f] hover:bg-[#3a3a3a] px-3 py-2 rounded-lg"
            >
              New chat
            </button>
          )}

        </div>

      </header>

      {/* CHAT AREA */}
      <section className="flex-1 overflow-y-auto">

        {messages.length === 0 ? (

          <div className="min-h-[75vh] flex items-center justify-center">

            <div className="text-center px-5 max-w-xl">

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
                    The AI model runs directly in your browser.
                    The first load may take some time.
                  </p>

                </div>
              )}

              {ready && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 text-sm">

                  <button
                    onClick={() =>
                      setInput(
                        "Explain machine learning like I'm 5"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#3a3a3a] rounded-xl p-3 text-left"
                  >
                    Explain Machine Learning
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "What is the difference between Python and SQL?"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#3a3a3a] rounded-xl p-3 text-left"
                  >
                    Python vs SQL
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Explain Data Science in simple language"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#3a3a3a] rounded-xl p-3 text-left"
                  >
                    Learn Data Science
                  </button>

                  <button
                    onClick={() =>
                      setInput(
                        "Write a simple Python program and explain it"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#3a3a3a] rounded-xl p-3 text-left"
                  >
                    Write Python Code
                  </button>

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
              <div className="bg-[#2f2f2f] rounded-2xl px-4 py-3 inline-block text-gray-300">
                Thinking...
              </div>
            )}

          </div>

        )}

      </section>

      {/* INPUT */}
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
              className="bg-white text-black rounded-xl px-4 py-3 font-semibold disabled:opacity-30 hover:bg-gray-200"
            >
              ↑
            </button>

          </div>

          <p className="text-center text-xs text-gray-500 mt-2">
            My AI can make mistakes. Check important information.
          </p>

        </div>

      </footer>

    </main>
  );
}
