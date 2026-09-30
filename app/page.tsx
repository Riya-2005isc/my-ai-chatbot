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
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't process your request. Please try again.",
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

      <header className="h-14 border-b border-white/10 flex items-center px-5">
        <h1 className="font-semibold text-lg">
          My AI
        </h1>
      </header>

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
              placeholder="Message My AI..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none px-3 py-3 placeholder-gray-500"
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-white text-black rounded-xl px-4 py-3 font-semibold disabled:opacity-30"
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
