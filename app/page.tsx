"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function sendMessage() {
    const text = input.trim();

    if (!text || loading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
    };

    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to get a response.";

        try {
          const errorData = await response.json();

          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore parsing errors
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("No response received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "",
        },
      ]);

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, {
          stream: true,
        });

        assistantText += chunk;

        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: assistantText,
          },
        ]);
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        assistantText += finalChunk;

        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: assistantText,
          },
        ]);
      }
    } catch (error) {
      console.error(error);

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Sorry, something went wrong.",
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

  function newChat() {
    if (loading) return;

    setMessages([]);
    setInput("");
  }

  async function copyMessage(
    content: string,
    index: number
  ) {
    try {
      await navigator.clipboard.writeText(content);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch {
      console.error("Copy failed");
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d10] text-white flex">

      {/* SIDEBAR */}
      <aside className="hidden md:flex w-[260px] shrink-0 border-r border-white/[0.07] bg-[#101216] flex-col">

        {/* Logo */}
        <div className="h-[70px] flex items-center px-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">

            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
              <span className="text-black font-bold text-sm">
                AI
              </span>
            </div>

            <div>
              <h1 className="font-semibold text-[15px]">
                My AI
              </h1>

              <p className="text-[11px] text-gray-500">
                Intelligent assistant
              </p>
            </div>

          </div>
        </div>

        {/* New chat */}
        <div className="p-4">

          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 text-sm font-medium hover:bg-gray-200 transition"
          >
            <span className="text-lg leading-none">
              +
            </span>

            New chat
          </button>

        </div>

        {/* Navigation */}
        <div className="px-4 mt-2">

          <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-3 px-2">
            Workspace
          </p>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.06] text-sm text-gray-200">
            <span>💬</span>
            Chat
          </button>

        </div>

        {/* Bottom */}
        <div className="mt-auto p-4 border-t border-white/[0.06]">

          <div className="flex items-center gap-3 px-2 py-2">

            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs">
              U
            </div>

            <div className="min-w-0">
              <p className="text-sm text-gray-200">
                User
              </p>

              <p className="text-xs text-gray-500 truncate">
                AI workspace
              </p>
            </div>

          </div>

        </div>

      </aside>

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* HEADER */}
        <header className="h-[70px] shrink-0 border-b border-white/[0.07] flex items-center justify-between px-5 md:px-8 bg-[#0b0d10]/95 backdrop-blur">

          <div className="flex items-center gap-3">

            <div className="md:hidden w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">
              AI
            </div>

            <div>
              <h2 className="font-semibold text-sm">
                My AI
              </h2>

              <p className="text-[11px] text-gray-500">
                Powered by Groq
              </p>
            </div>

          </div>

          <button
            onClick={newChat}
            className="md:hidden text-gray-400 hover:text-white text-xl"
          >
            +
          </button>

        </header>

        {/* CHAT */}
        <section className="flex-1 overflow-y-auto">

          {messages.length === 0 ? (

            /* WELCOME */
            <div className="min-h-full flex items-center justify-center px-5">

              <div className="w-full max-w-3xl text-center">

                <div className="mx-auto mb-7 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl">
                  <span className="text-black font-bold text-lg">
                    AI
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
                  How can I help you?
                </h1>

                <p className="text-gray-500 max-w-lg mx-auto text-sm md:text-base">
                  Ask questions, explore ideas, analyze information,
                  write content, or learn something new.
                </p>

                {/* Suggestions */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 text-left">

                  {[
                    "Explain machine learning simply",
                    "Help me write a professional resume",
                    "Analyze a dataset with Python",
                    "Give me ideas for a project",
                  ].map((suggestion) => (

                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/[0.14] text-sm text-gray-300 text-left transition"
                    >
                      {suggestion}
                    </button>

                  ))}

                </div>

              </div>

            </div>

          ) : (

            /* MESSAGES */
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">

              {messages.map((message, index) => (

                <div
                  key={index}
                  className={`flex gap-4 mb-8 ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  {/* AI avatar */}
                  {message.role === "assistant" && (

                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-[10px] font-bold">
                      AI
                    </div>

                  )}

                  <div
                    className={`max-w-[80%] ${
                      message.role === "user"
                        ? "bg-[#1d222a] border border-white/[0.06] rounded-2xl px-4 py-3"
                        : ""
                    }`}
                  >

                    <div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-200">
                      {message.content}

                      {message.role === "assistant" &&
                        loading &&
                        index === messages.length - 1 && (
                          <span className="inline-block ml-1 animate-pulse">
                            ▌
                          </span>
                        )}
                    </div>

                    {/* Copy */}
                    {message.role === "assistant" &&
                      message.content && (
                        <button
                          onClick={() =>
                            copyMessage(
                              message.content,
                              index
                            )
                          }
                          className="mt-3 text-xs text-gray-600 hover:text-gray-300 transition"
                        >
                          {copiedIndex === index
                            ? "✓ Copied"
                            : "Copy"}
                        </button>
                      )}

                  </div>

                </div>

              ))}

              {/* THINKING */}

              {loading &&
                messages[messages.length - 1]?.role ===
                  "user" && (

                  <div className="flex gap-4">

                    <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-[10px] font-bold">
                      AI
                    </div>

                    <div className="flex items-center gap-1 pt-2">

                      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />

                      <span
                        className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                        style={{
                          animationDelay: "150ms",
                        }}
                      />

                      <span
                        className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                        style={{
                          animationDelay: "300ms",
                        }}
                      />

                    </div>

                  </div>

                )}

            </div>

          )}

        </section>

        {/* INPUT AREA */}
        <footer className="shrink-0 px-4 md:px-8 pb-5 pt-3 bg-[#0b0d10]">

          <div className="max-w-4xl mx-auto">

            <div className="relative rounded-2xl border border-white/[0.1] bg-[#15181d] focus-within:border-white/[0.18] transition">

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Message My AI..."
                rows={1}
                disabled={loading}
                className="w-full bg-transparent resize-none outline-none px-4 pt-4 pb-14 text-sm text-white placeholder-gray-600 disabled:opacity-60"
              />

              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">

                <span className="text-[11px] text-gray-600">
                  Enter to send · Shift + Enter for new line
                </span>

                <button
                  onClick={sendMessage}
                  disabled={
                    loading || !input.trim()
                  }
                  className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-semibold disabled:opacity-20 hover:bg-gray-200 transition"
                >
                  ↑
                </button>

              </div>

            </div>

            <p className="text-center text-[10px] text-gray-600 mt-3">
              My AI can make mistakes. Check important information.
            </p>

          </div>

        </footer>

      </div>

    </main>
  );
}
