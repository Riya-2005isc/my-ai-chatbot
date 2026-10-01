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
          // Ignore JSON parsing errors
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("No response stream received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";

      // Add an empty assistant message immediately.
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

      // Decode any remaining characters.
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
      console.error("Chat error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, I couldn't process your request.";

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `Sorry, I couldn't process your request.\n\n${errorMessage}`,
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
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center px-5 shrink-0">
        <h1 className="font-semibold text-lg">
          My AI
        </h1>
      </header>

      {/* Chat area */}
      <section className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="min-h-[75vh] flex items-center justify-center">
            <div className="text-center px-5">
              <h2 className="text-3xl font-semibold mb-3">
                How can I help you?
              </h2>

              <p className="text-gray-400">
                Ask me anything.
              </p>
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

                  {/* Cursor while streaming */}
                  {message.role === "assistant" &&
                    loading &&
                    index === messages.length - 1 && (
                      <span className="inline-block ml-1 animate-pulse">
                        ▌
                      </span>
                    )}
                </div>
              </div>
            ))}

            {/* Initial waiting indicator */}
            {loading &&
              messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start mb-6">
                  <div className="bg-[#2f2f2f] rounded-2xl px-4 py-3 text-gray-400">
                    Thinking...
                  </div>
                </div>
              )}
          </div>
        )}
      </section>

      {/* Input */}
      <footer className="border-t border-white/10 p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#2f2f2f] rounded-2xl flex items-end p-2">
            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Message My AI..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent resize-none outline-none px-3 py-3 placeholder-gray-500 disabled:opacity-60"
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-white text-black rounded-xl px-4 py-3 font-semibold disabled:opacity-30 transition-opacity"
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
