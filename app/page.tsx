"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const STORAGE_KEY = "my-ai-chat-history";

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);

  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  // -----------------------------
  // LOAD HISTORY
  // -----------------------------

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      }
    } catch (error) {
      console.error(
        "History loading error:",
        error
      );
    }

    createNewChat();
  }, []);

  // -----------------------------
  // SAVE HISTORY
  // -----------------------------

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    }
  }, [chats]);

  // -----------------------------
  // AUTO SCROLL
  // -----------------------------

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    chats,
    activeChatId,
    loading,
  ]);

  // -----------------------------
  // CURRENT CHAT
  // -----------------------------

  const activeChat =
    chats.find(
      (chat) =>
        chat.id === activeChatId
    ) || null;

  // -----------------------------
  // CREATE CHAT
  // -----------------------------

  function createNewChat() {
    const newChat: Chat = {
      id:
        Date.now().toString() +
        Math.random()
          .toString(36)
          .slice(2),

      title: "New conversation",

      messages: [],

      createdAt: Date.now(),
    };

    setChats((previous) => [
      newChat,
      ...previous,
    ]);

    setActiveChatId(newChat.id);

    setInput("");

    setSelectedImage(null);
  }

  // -----------------------------
  // DELETE CHAT
  // -----------------------------

  function deleteChat(id: string) {
    setChats((previous) => {
      const remaining =
        previous.filter(
          (chat) => chat.id !== id
        );

      if (id === activeChatId) {
        if (remaining.length > 0) {
          setActiveChatId(
            remaining[0].id
          );
        } else {
          const newChat: Chat = {
            id:
              Date.now().toString(),

            title:
              "New conversation",

            messages: [],

            createdAt:
              Date.now(),
          };

          setActiveChatId(
            newChat.id
          );

          return [newChat];
        }
      }

      return remaining;
    });
  }

  // -----------------------------
  // IMAGE UPLOAD
  // -----------------------------

  function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert(
        "Please select an image file."
      );

      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "Image must be smaller than 5 MB."
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setSelectedImage(
        reader.result as string
      );
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  }

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------

  async function handleSubmit(
    event?: FormEvent
  ) {
    event?.preventDefault();

    if (loading) return;

    const text =
      input.trim();

    if (
      !text &&
      !selectedImage
    ) {
      return;
    }

    if (!activeChatId) {
      createNewChat();
      return;
    }

    const userMessage: Message = {
      role: "user",
      content:
        text ||
        "Please analyze this image.",
      image:
        selectedImage || undefined,
    };

    const currentChat =
      chats.find(
        (chat) =>
          chat.id === activeChatId
      );

    if (!currentChat) return;

    const updatedMessages = [
      ...currentChat.messages,
      userMessage,
    ];

    const title =
      currentChat.messages.length === 0
        ? text ||
          "Image analysis"
        : currentChat.title;

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title:
                title.length > 45
                  ? title.slice(
                      0,
                      45
                    ) + "..."
                  : title,
              messages:
                updatedMessages,
            }
          : chat
      )
    );

    setInput("");
    setSelectedImage(null);

    setLoading(true);

    try {
      const response =
        await fetch("/api/ai", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            messages:
              updatedMessages,
          }),
        });

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          errorData?.error ||
            "AI request failed."
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      // -------------------------
      // JSON RESPONSE
      // -------------------------

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const data =
          await response.json();

        const assistantMessage: Message =
          {
            role: "assistant",

            content:
              data.text ||
              "Done.",

            image:
              data.image ||
              undefined,
          };

        setChats((previous) =>
          previous.map(
            (chat) =>
              chat.id ===
              activeChatId
                ? {
                    ...chat,

                    messages: [
                      ...chat.messages,
                      assistantMessage,
                    ],
                  }
                : chat
          )
        );

        return;
      }

      // -------------------------
      // STREAM RESPONSE
      // -------------------------

      if (!response.body) {
        throw new Error(
          "No response body."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let assistantText = "";

      // Add empty assistant message
      setChats((previous) =>
        previous.map((chat) =>
          chat.id ===
          activeChatId
            ? {
                ...chat,

                messages: [
                  ...chat.messages,
                  {
                    role:
                      "assistant",
                    content: "",
                  },
                ],
              }
            : chat
        )
      );

      while (true) {
        const {
          value,
          done,
        } =
          await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        assistantText += chunk;

        setChats((previous) =>
          previous.map(
            (chat) => {
              if (
                chat.id !==
                activeChatId
              ) {
                return chat;
              }

              const messages =
                [...chat.messages];

              const lastIndex =
                messages.length -
                1;

              messages[lastIndex] =
                {
                  role:
                    "assistant",
                  content:
                    assistantText,
                };

              return {
                ...chat,
                messages,
              };
            }
          )
        );
      }
    } catch (error) {
      console.error(
        "Send error:",
        error
      );

      const errorMessage: Message =
        {
          role: "assistant",

          content:
            error instanceof Error
              ? `Sorry, ${error.message}`
              : "Sorry, something went wrong.",
        };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id ===
          activeChatId
            ? {
                ...chat,

                messages: [
                  ...chat.messages,
                  errorMessage,
                ],
              }
            : chat
        )
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // SUGGESTIONS
  // -----------------------------

  const suggestions = [
    "Explain machine learning simply",
    "Help me write Python code",
    "What is SQL?",
    "Explain data science concepts",
  ];

  function useSuggestion(
    suggestion: string
  ) {
    setInput(suggestion);
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#0b0d10] text-white">
      {/* SIDEBAR */}

      <aside
        className={`${
          sidebarOpen
            ? "w-[270px]"
            : "w-0"
        } flex-shrink-0 overflow-hidden border-r border-white/10 bg-[#101216] transition-all duration-300`}
      >
        <div className="flex h-full w-[270px] flex-col">
          {/* LOGO */}

          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black font-bold">
                AI
              </div>

              <div>
                <div className="font-semibold">
                  My AI
                </div>

                <div className="text-xs text-gray-500">
                  Groq AI Assistant
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                setSidebarOpen(false)
              }
              className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          {/* NEW CHAT */}

          <div className="p-3">
            <button
              onClick={
                createNewChat
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm transition hover:bg-white/[0.08]"
            >
              <span className="mr-2">
                +
              </span>

              New chat
            </button>
          </div>

          {/* HISTORY */}

          <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Recent chats
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group mb-1 flex items-center rounded-xl ${
                  activeChatId ===
                  chat.id
                    ? "bg-white/[0.09]"
                    : "hover:bg-white/[0.05]"
                }`}
              >
                <button
                  onClick={() => {
                    setActiveChatId(
                      chat.id
                    );
                    setSelectedImage(
                      null
                    );
                    setInput("");
                  }}
                  className="min-w-0 flex-1 px-3 py-3 text-left text-sm"
                >
                  <div className="truncate">
                    {chat.title}
                  </div>
                </button>

                <button
                  onClick={() =>
                    deleteChat(
                      chat.id
                    )
                  }
                  className="mr-2 hidden rounded-lg px-2 py-1 text-gray-500 hover:bg-white/10 hover:text-white group-hover:block"
                  title="Delete chat"
                >
                  🗑
                </button>
              </div>
            ))}

            {chats.length ===
              0 && (
              <div className="px-3 py-5 text-sm text-gray-500">
                No conversations yet.
              </div>
            )}
          </div>

          {/* FOOTER */}

          <div className="border-t border-white/10 p-4 text-xs text-gray-500">
            Powered by Groq
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <section className="relative flex min-w-0 flex-1 flex-col">
        {/* HEADER */}

        <header className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() =>
                  setSidebarOpen(
                    true
                  )
                }
                className="rounded-lg px-3 py-2 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ☰
              </button>
            )}

            <div>
              <div className="font-semibold">
                My AI
              </div>

              <div className="text-xs text-gray-500">
                AI Assistant
              </div>
            </div>
          </div>

          <button
            onClick={
              createNewChat
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
          >
            + New chat
          </button>
        </header>

        {/* CHAT */}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-8">
            {!activeChat ||
            activeChat.messages.length ===
              0 ? (
              <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-bold text-black shadow-xl">
                  AI
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">
                  How can I help you?
                </h1>

                <p className="mt-3 max-w-lg text-sm leading-6 text-gray-500">
                  Ask questions, learn
                  concepts, write code,
                  or upload an image for
                  analysis.
                </p>

                <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {suggestions.map(
                    (suggestion) => (
                      <button
                        key={
                          suggestion
                        }
                        onClick={() =>
                          useSuggestion(
                            suggestion
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/[0.07]"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                {activeChat.messages.map(
                  (
                    message,
                    index
                  ) => (
                    <div
                      key={
                        `${activeChat.id}-${index}`
                      }
                      className={`flex ${
                        message.role ===
                        "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] ${
                          message.role ===
                          "user"
                            ? "rounded-2xl rounded-br-md bg-white px-4 py-3 text-black"
                            : "w-full max-w-3xl px-2 py-1 text-gray-200"
                        }`}
                      >
                        {/* IMAGE */}

                        {message.image && (
                          <img
                            src={
                              message.image
                            }
                            alt="Uploaded image"
                            className="mb-3 max-h-[420px] max-w-full rounded-xl border border-black/10 object-contain"
                          />
                        )}

                        {/* TEXT */}

                        {message.content && (
                          <div className="whitespace-pre-wrap text-sm leading-7">
                            {message.content}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {loading && (
                  <div className="flex items-center gap-2 px-2 text-sm text-gray-500">
                    <span className="animate-pulse">
                      ●
                    </span>

                    My AI is thinking...
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* IMAGE PREVIEW */}

        {selectedImage && (
          <div className="mx-auto w-full max-w-4xl px-4">
            <div className="mb-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-[#15181d] p-3">
              <img
                src={selectedImage}
                alt="Selected image"
                className="h-20 w-20 rounded-xl object-cover"
              />

              <div className="flex-1">
                <div className="text-sm font-medium">
                  Image attached
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Ask anything about
                  this image.
                </div>
              </div>

              <button
                onClick={() =>
                  setSelectedImage(
                    null
                  )
                }
                className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* INPUT */}

        <div className="border-t border-white/10 bg-[#0b0d10] p-4">
          <form
            onSubmit={
              handleSubmit
            }
            className="mx-auto max-w-4xl"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#15181d] p-2 shadow-2xl">
              {/* IMAGE BUTTON */}

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={loading}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                title="Upload image"
              >
                📎
              </button>

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/*"
                onChange={
                  handleImageUpload
                }
                className="hidden"
              />

              {/* TEXT */}

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    handleSubmit();
                  }
                }}
                placeholder={
                  selectedImage
                    ? "Ask something about this image..."
                    : "Message My AI..."
                }
                rows={1}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-gray-600"
              />

              {/* SEND */}

              <button
                type="submit"
                disabled={
                  loading ||
                  (!input.trim() &&
                    !selectedImage)
                }
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
            </div>

            <div className="mt-2 text-center text-[11px] text-gray-600">
              My AI can make mistakes.
              Check important
              information.
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
