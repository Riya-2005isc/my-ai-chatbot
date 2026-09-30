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

// Small model for faster browser inference
const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

const SYSTEM_PROMPT = `
You are My AI, a helpful and friendly AI assistant.

Answer the user's question directly and naturally.

IMPORTANT:
- Understand spelling mistakes, grammar mistakes, casual English, Hindi and Hinglish.
- Use previous messages to understand follow-up questions.
- Do not introduce yourself unless asked.
- Do not give unnecessary information about being an AI.
- Do not claim to have internet access or web search unless you actually have it.
- Do not repeat the user's question.

EXPLANATIONS:
- Start with a simple explanation.
- Use easy language.
- If the user says "explain like I'm 5", make it extremely simple.
- Give a real-world example when useful.
- If the user asks for detail, provide a deeper explanation.

TECHNICAL TOPICS:
You can answer questions about programming, Python, SQL,
Data Science, Machine Learning, statistics, mathematics,
Power BI, Tableau, Excel, and other general topics.

CODE:
- Give correct and simple code.
- Explain important parts of the code.
- Do not invent libraries or functions.

STYLE:
- Be concise for simple questions.
- Be detailed when requested.
- Use headings and bullet points when useful.
- Be conversational.
`;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading AI...");
  const [ready, setReady] = useState(false);

  const engineRef = useRef<MLCEngine | null>(null);

  // Load the AI once
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
        setStatus("AI Ready");
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setStatus(
            "Could not load AI. Please use Chrome or Edge with WebGPU enabled."
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
    const text = input.trim();

    if (
      !text ||
      loading ||
      !ready ||
      !engineRef.current
    ) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: text,
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      /*
       * Only send the latest 8 messages.
       * This keeps the prompt smaller and makes generation faster.
       */
      const recentMessages =
        updatedMessages.slice(-8);

      const response =
        await engineRef.current.chat.completions.create({
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            ...recentMessages,
          ],

          // Lower temperature = more direct answers
          temperature: 0.5,

          // Shorter answers generate faster
          max_tokens: 400,

          // Stop when the answer is complete
          stream: false,
        });

      const answer =
        response.choices[0]?.message?.content?.trim() ||
        "I couldn't generate an answer.";

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      console.error("AI response error:", error);

      setMessages([
        ...updatedMessages,
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

  function newChat() {
    setMessages([]);
    setInput("");
  }

  function useSuggestion(text: string) {
    setInput(text);
  }

  return (
    <main className="min-h-screen bg-[#212121] text-white flex flex-col">

      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-5">

        <button
          onClick={newChat}
          className="font-semibold text-lg hover:opacity-80"
        >
          My AI
        </button>

        <div className="flex items-center gap-3">

          <span
            className={`text-xs ${
              ready
                ? "text-green-400"
                : "text-gray-400"
            }`}
          >
            {ready ? "● AI Ready" : status}
          </span>

          {messages.length > 0 && (
            <button
              onClick={newChat}
              className="text-xs bg-[#2f2f2f] hover:bg-[#3a3a3a] px-3 py-2 rounded-lg"
            >
              New chat
            </button>
          )}

        </div>

      </header>

      {/* CHAT */}
      <section className="flex-1 overflow-y-auto">

        {messages.length === 0 ? (

          <div className="min-h-[75vh] flex items-center justify-center">

            <div className="text-center px-5 max-w-xl">

              <h2 className="text-3xl font-semibold mb-3">
                How can I help you?
              </h2>

              <p className="text-gray-400">
                Ask me anything.
              </p>

              {!ready && (
                <div className="mt-6">

                  <div className="bg-[#2f2f2f] rounded-xl px-4 py-3 text-sm text-gray-300">
                    {status}
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    The AI model is loaded in your browser.
                    The first load may take some time.
                  </p>

                </div>
              )}

              {ready && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-7">

                  <button
                    onClick={() =>
                      useSuggestion(
                        "Explain machine learning like I'm 5"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#383838] rounded-xl p-3 text-left text-sm"
                  >
                    🧠 Explain Machine Learning
                  </button>

                  <button
                    onClick={() =>
                      useSuggestion(
                        "What is Python and why is it used?"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#383838] rounded-xl p-3 text-left text-sm"
                  >
                    🐍 Ask about Python
                  </button>

                  <button
                    onClick={() =>
                      useSuggestion(
                        "Explain Data Science in simple language"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#383838] rounded-xl p-3 text-left text-sm"
                  >
                    📊 Learn Data Science
                  </button>

                  <button
                    onClick={() =>
                      useSuggestion(
                        "Write a simple Python program"
                      )
                    }
                    className="bg-[#2f2f2f] hover:bg-[#383838] rounded-xl p-3 text-left text-sm"
                  >
                    💻 Write Code
                  </button>

                </div>
              )}

            </div>

          </div>

        ) : (

          <div className="max-w-3xl mx-auto px-4 py-8">

            {messages.map(
              (message, index) => (

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

              )
            )}

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
