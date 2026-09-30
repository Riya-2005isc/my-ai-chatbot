"use client";

import { useEffect, useRef, useState } from "react";
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

type Message = {
role: "user" | "assistant";
content: string;
};

const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

const SYSTEM_PROMPT = `
You are My AI, a helpful and intelligent AI assistant.

Answer the user's questions naturally and directly.

Understand:

* spelling mistakes
* grammar mistakes
* casual English
* Hindi
* Hinglish
* follow-up questions
* previous conversation context

Do not repeat the user's question.
Do not unnecessarily introduce yourself.
Do not claim to have internet access.

EXPLANATIONS:

* Use simple language.
* Give examples when useful.
* If the user says "explain like I'm 5", make it very simple.
* If the user asks for detail, give a detailed explanation.

You can help with:
Python, SQL, Data Science, Machine Learning,
Statistics, Mathematics, Power BI, Tableau,
Excel, programming and general topics.

For code:

* Give readable code.
* Explain important parts.
* Do not invent libraries or functions.

Be helpful, clear and conversational.
`;

export default function Home() {
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [loading, setLoading] = useState(false);
const [status, setStatus] = useState("Loading My AI...");
const [ready, setReady] = useState(false);

const engineRef = useRef<MLCEngine | null>(null);

useEffect(() => {
let cancelled = false;

```
async function loadAI() {
  try {
    setStatus("Preparing My AI...");

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
        "Unable to load AI. Please use Chrome or Edge with WebGPU enabled."
      );
    }
  }
}

loadAI();

return () => {
  cancelled = true;
};
```

}, []);

async function sendMessage() {
const text = input.trim();

```
if (!text || loading || !ready || !engineRef.current) {
  return;
}

const userMessage: Message = {
  role: "user",
  content: text,
};

const updatedMessages = [...messages, userMessage];

setMessages(updatedMessages);
setInput("");
setLoading(true);

try {
  const recentMessages = updatedMessages.slice(-8);

  const response =
    await engineRef.current.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...recentMessages,
      ],
      temperature: 0.5,
      max_tokens: 400,
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
```

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
setMessages([]);
setInput("");
}

function useSuggestion(text: string) {
setInput(text);
}

return ( <main className="min-h-screen bg-[#0b0d10] text-white flex flex-col">

```
  <header className="h-16 shrink-0 border-b border-white/10 bg-[#0b0d10] flex items-center justify-between px-5 sm:px-8">

    <button
      onClick={newChat}
      className="flex items-center gap-3 hover:opacity-90 transition"
    >
      <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg">
        M
      </div>

      <div className="text-left">
        <h1 className="font-semibold text-[17px]">
          My AI
        </h1>

        <p className="text-[10px] text-gray-500">
          Personal AI Assistant
        </p>
      </div>
    </button>

    <div className="flex items-center gap-3">

      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
        <span
          className={`w-2 h-2 rounded-full ${
            ready ? "bg-green-400" : "bg-yellow-400"
          }`}
        />
        {ready ? "Online" : "Preparing"}
      </div>

      {messages.length > 0 && (
        <button
          onClick={newChat}
          className="border border-white/10 bg-[#15181d] hover:bg-[#1d2127] transition px-3.5 py-2 rounded-xl text-xs font-medium"
        >
          + New Chat
        </button>
      )}

    </div>
  </header>

  <section className="flex-1 overflow-y-auto">

    {messages.length === 0 ? (

      <div className="min-h-[calc(100vh-145px)] flex items-center justify-center px-5">

        <div className="w-full max-w-3xl text-center">

          <div className="mx-auto mb-7 w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center text-2xl font-bold shadow-2xl">
            M
          </div>

          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
            How can I help you?
          </h2>

          <p className="text-gray-400 text-base sm:text-lg mb-10">
            Ask My AI anything. Get simple, clear and useful answers.
          </p>

          {!ready ? (

            <div className="max-w-md mx-auto">

              <div className="border border-white/10 bg-[#15181d] rounded-2xl px-5 py-4">

                <div className="flex items-center justify-center gap-3">

                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>

                  <span className="text-sm text-gray-300">
                    {status}
                  </span>

                </div>

              </div>

              <p className="text-xs text-gray-600 mt-4">
                The AI model runs directly in your browser.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">

              <button
                onClick={() =>
                  useSuggestion(
                    "Explain machine learning like I'm 5"
                  )
                }
                className="text-left border border-white/10 bg-[#12151a] hover:bg-[#191d23] hover:border-white/20 transition rounded-2xl p-4"
              >
                <div className="text-lg mb-2">🧠</div>

                <div className="font-medium text-sm">
                  Explain a concept
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Make difficult topics simple
                </div>
              </button>

              <button
                onClick={() =>
                  useSuggestion(
                    "Write a simple Python program and explain it"
                  )
                }
                className="text-left border border-white/10 bg-[#12151a] hover:bg-[#191d23] hover:border-white/20 transition rounded-2xl p-4"
              >
                <div className="text-lg mb-2">💻</div>

                <div className="font-medium text-sm">
                  Write code
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Python, SQL and more
                </div>
              </button>

              <button
                onClick={() =>
                  useSuggestion(
                    "Explain Data Science in simple language"
                  )
                }
                className="text-left border border-white/10 bg-[#12151a] hover:bg-[#191d23] hover:border-white/20 transition rounded-2xl p-4"
              >
                <div className="text-lg mb-2">📊</div>

                <div className="font-medium text-sm">
                  Learn Data Science
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Learn with simple examples
                </div>
              </button>

              <button
                onClick={() =>
                  useSuggestion(
                    "Help me understand SQL joins with examples"
                  )
                }
                className="text-left border border-white/10 bg-[#12151a] hover:bg-[#191d23] hover:border-white/20 transition rounded-2xl p-4"
              >
                <div className="text-lg mb-2">📚</div>

                <div className="font-medium text-sm">
                  Study with My AI
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Get step-by-step explanations
                </div>
              </button>

            </div>
          )}

        </div>
      </div>

    ) : (

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {messages.map((message, index) => (

          <div
            key={index}
            className={`flex gap-3 mb-7 ${
              message.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >

            {message.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm mt-1">
                M
              </div>
            )}

            <div
              className={`max-w-[85%] px-4 py-3.5 rounded-2xl whitespace-pre-wrap leading-7 text-[15px] ${
                message.role === "user"
                  ? "bg-[#252a31] border border-white/5"
                  : "bg-[#12151a] border border-white/5"
              }`}
            >
              {message.content}
            </div>

          </div>

        ))}

        {loading && (

          <div className="flex gap-3 items-start">

            <div className="shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm">
              M
            </div>

            <div className="bg-[#12151a] border border-white/5 rounded-2xl px-5 py-4">

              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
              </div>

            </div>

          </div>

        )}

      </div>

    )}

  </section>

  <footer className="shrink-0 bg-[#0b0d10] px-4 sm:px-6 pb-5 pt-3">

    <div className="max-w-3xl mx-auto">

      <div className="border border-white/10 bg-[#15181d] rounded-2xl p-2 flex items-end shadow-2xl focus-within:border-white/20 transition">

        <textarea
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={
            ready
              ? "Message My AI..."
              : "Preparing My AI..."
          }
          rows={1}
          disabled={!ready || loading}
          className="flex-1 min-h-[48px] max-h-32 bg-transparent resize-none outline-none px-3 py-3.5 text-sm placeholder:text-gray-600 disabled:opacity-50"
        />

        <button
          onClick={sendMessage}
          disabled={
            !ready ||
            loading ||
            !input.trim()
          }
          className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center text-xl font-semibold disabled:opacity-20 hover:bg-gray-200 transition mb-0.5 mr-0.5"
          aria-label="Send message"
        >
          ↑
        </button>

      </div>

      <p className="text-center text-[11px] text-gray-600 mt-3">
        My AI may make mistakes. Verify important information.
      </p>

    </div>

  </footer>


