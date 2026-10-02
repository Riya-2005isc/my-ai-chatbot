"use client";

import { useEffect, useRef, useState } from "react";

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
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const messages = activeChat?.messages ?? [];

  // =========================================================
  // LOAD CHAT HISTORY
  // =========================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: Chat[] = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setChats(parsed);

          if (parsed.length > 0) {
            setActiveChatId(parsed[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Could not load chat history:", error);
    }
  }, []);

  // =========================================================
  // SAVE CHAT HISTORY
  // =========================================================

  useEffect(() => {
    if (chats.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error(
        "Could not save chat history:",
        error
      );
    }
  }, [chats]);

  // =========================================================
  // CREATE NEW CHAT
  // =========================================================

  function createChat() {
    if (loading) return;

    const newChat: Chat = {
      id: crypto.randomUUID(),
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
    setImageName(null);
  }

  // =========================================================
  // DELETE CHAT
  // =========================================================

  function deleteChat(id: string) {
    if (loading) return;

    setChats((previous) => {
      const updated = previous.filter(
        (chat) => chat.id !== id
      );

      if (activeChatId === id) {
        setActiveChatId(
          updated.length > 0
            ? updated[0].id
            : null
        );
      }

      return updated;
    });
  }

  // =========================================================
  // UPDATE MESSAGES
  // =========================================================

  function updateChatMessages(
    chatId: string,
    newMessages: Message[]
  ) {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: newMessages,
            }
          : chat
      )
    );
  }

  // =========================================================
  // UPDATE CHAT TITLE
  // =========================================================

  function updateChatTitle(
    chatId: string,
    firstMessage: string
  ) {
    const cleanTitle =
      firstMessage.trim() || "Image conversation";

    const title =
      cleanTitle.length > 45
        ? cleanTitle.substring(0, 45) + "..."
        : cleanTitle;

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title,
            }
          : chat
      )
    );
  }

  // =========================================================
  // IMAGE SELECT
  // =========================================================

  function handleImageSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert(
        "Please select a valid image file."
      );

      event.target.value = "";
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      alert(
        "Image must be smaller than 5MB."
      );

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage(
        reader.result as string
      );

      setImageName(file.name);
    };

    reader.onerror = () => {
      alert("Could not read the image.");
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  }

  // =========================================================
  // REMOVE IMAGE
  // =========================================================

  function removeSelectedImage() {
    setSelectedImage(null);
    setImageName(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  async function sendMessage() {
    const text = input.trim();

    if (
      (!text && !selectedImage) ||
      loading
    ) {
      return;
    }

    let chatId = activeChatId;

    // Automatically create chat
    if (!chatId) {
      const newChat: Chat = {
        id: crypto.randomUUID(),
        title:
          text.length > 45
            ? text.substring(0, 45) + "..."
            : text || "Image conversation",
        messages: [],
        createdAt: Date.now(),
      };

      chatId = newChat.id;

      setChats((previous) => [
        newChat,
        ...previous,
      ]);

      setActiveChatId(chatId);
    }

    const currentMessages =
      chats.find(
        (chat) => chat.id === chatId
      )?.messages ?? [];

    const userMessage: Message = {
      role: "user",
      content: text,
      image:
        selectedImage || undefined,
    };

    const newMessages = [
      ...currentMessages,
      userMessage,
    ];

    updateChatMessages(
      chatId,
      newMessages
    );

    if (currentMessages.length === 0) {
      updateChatTitle(
        chatId,
        text || "Image conversation"
      );
    }

    // Clear input
    setInput("");
    removeSelectedImage();

    setLoading(true);

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            messages: newMessages,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Failed to get a response.";

        try {
          const errorData =
            await response.json();

          if (errorData?.error) {
            errorMessage =
              errorData.error;
          }
        } catch {
          // Ignore JSON error
        }

        throw new Error(
          errorMessage
        );
      }

      if (!response.body) {
        throw new Error(
          "No response received."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let assistantText = "";

      // Add empty assistant message
      updateChatMessages(
        chatId,
        [
          ...newMessages,
          {
            role: "assistant",
            content: "",
          },
        ]
      );

      while (true) {
        const {
          value,
          done,
        } = await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value, {
            stream: true,
          });

        assistantText += chunk;

        updateChatMessages(
          chatId,
          [
            ...newMessages,
            {
              role: "assistant",
              content:
                assistantText,
            },
          ]
        );
      }

      const finalChunk =
        decoder.decode();

      if (finalChunk) {
        assistantText += finalChunk;
      }

      updateChatMessages(
        chatId,
        [
          ...newMessages,
          {
            role: "assistant",
            content:
              assistantText,
          },
        ]
      );
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      updateChatMessages(
        chatId,
        [
          ...newMessages,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? `Sorry, something went wrong.\n\n${error.message}`
                : "Sorry, something went wrong.",
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // KEYBOARD
  // =========================================================

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

  // =========================================================
  // COPY MESSAGE
  // =========================================================

  async function copyMessage(
    content: string,
    index: number
  ) {
    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch {
      console.error(
        "Copy failed"
      );
    }
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-[#0b0d10] text-white flex">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="hidden md:flex w-[270px] shrink-0 border-r border-white/[0.07] bg-[#101216] flex-col">

        {/* LOGO */}

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

        {/* NEW CHAT */}

        <div className="p-4">

          <button
            onClick={createChat}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-40"
          >

            <span className="text-lg">
              +
            </span>

            New chat

          </button>

        </div>

        {/* HISTORY */}

        <div className="flex-1 overflow-y-auto px-3">

          <p className="text-[10px] uppercase tracking-wider text-gray-600 px-2 mb-3">
            Chat history
          </p>

          {chats.length === 0 ? (

            <div className="px-2 py-5 text-xs text-gray-600">
              No conversations yet.
            </div>

          ) : (

            <div className="space-y-1">

              {chats.map(
                (chat) => (

                  <div
                    key={chat.id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition ${
                      activeChatId ===
                      chat.id
                        ? "bg-white/[0.08] text-white"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                    }`}
                    onClick={() => {

                      if (!loading) {
                        setActiveChatId(
                          chat.id
                        );
                      }

                    }}
                  >

                    <span className="text-sm shrink-0">
                      💬
                    </span>

                    <span className="text-sm truncate flex-1">
                      {chat.title}
                    </span>

                    <button
                      onClick={(
                        event
                      ) => {

                        event.stopPropagation();

                        deleteChat(
                          chat.id
                        );

                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition text-sm"
                      title="Delete chat"
                    >
                      ×
                    </button>

                  </div>

                )
              )}

            </div>

          )}

        </div>

        {/* USER */}

        <div className="p-4 border-t border-white/[0.06]">

          <div className="flex items-center gap-3 px-2 py-2">

            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs">
              U
            </div>

            <div className="min-w-0">

              <p className="text-sm text-gray-200">
                User
              </p>

              <p className="text-xs text-gray-500">
                AI workspace
              </p>

            </div>

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="flex-1 min-w-0 flex flex-col">

        {/* HEADER */}

        <header className="h-[70px] shrink-0 border-b border-white/[0.07] flex items-center justify-between px-5 md:px-8 bg-[#0b0d10]/95 backdrop-blur">

          <div className="flex items-center gap-3">

            <div className="md:hidden w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">
              AI
            </div>

            <div>

              <h2 className="font-semibold text-sm">
                {activeChat?.title ||
                  "My AI"}
              </h2>

              <p className="text-[11px] text-gray-500">
                Powered by Groq
              </p>

            </div>

          </div>

          <button
            onClick={createChat}
            disabled={loading}
            className="md:hidden text-gray-400 hover:text-white text-xl disabled:opacity-40"
          >
            +
          </button>

        </header>

        {/* ===================================================
            CHAT
        =================================================== */}

        <section className="flex-1 overflow-y-auto">

          {messages.length === 0 ? (

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
                  Ask questions, explore
                  ideas, analyze
                  information, write
                  content, or learn
                  something new.
                </p>

                {/* SUGGESTIONS */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 text-left">

                  {[
                    "Explain machine learning simply",
                    "Help me write a professional resume",
                    "Analyze a dataset with Python",
                    "Give me ideas for a project",
                  ].map(
                    (suggestion) => (

                      <button
                        key={suggestion}
                        onClick={() =>
                          setInput(
                            suggestion
                          )
                        }
                        className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/[0.14] text-sm text-gray-300 text-left transition"
                      >
                        {suggestion}
                      </button>

                    )
                  )}

                </div>

              </div>

            </div>

          ) : (

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">

              {messages.map(
                (
                  message,
                  index
                ) => (

                  <div
                    key={index}
                    className={`flex gap-4 mb-8 ${
                      message.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >

                    {/* AI AVATAR */}

                    {message.role ===
                      "assistant" && (

                      <div className="shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-[10px] font-bold">
                        AI
                      </div>

                    )}

                    {/* MESSAGE */}

                    <div
                      className={`max-w-[80%] ${
                        message.role ===
                        "user"
                          ? "bg-[#1d222a] border border-white/[0.06] rounded-2xl px-4 py-3"
                          : ""
                      }`}
                    >

                      {/* IMAGE */}

                      {message.image && (

                        <div className="mb-3">

                          <img
                            src={
                              message.image
                            }
                            alt="Uploaded image"
                            className="max-w-[320px] max-h-[360px] object-cover rounded-xl border border-white/[0.08]"
                          />

                        </div>

                      )}

                      {/* TEXT */}

                      {message.content && (

                        <div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-200">

                          {message.content}

                          {message.role ===
                            "assistant" &&
                            loading &&
                            index ===
                              messages.length -
                                1 && (

                              <span className="inline-block ml-1 animate-pulse">
                                ▌
                              </span>

                            )}

                        </div>

                      )}

                      {/* COPY */}

                      {message.role ===
                        "assistant" &&
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
                          {copiedIndex ===
                          index
                            ? "✓ Copied"
                            : "Copy"}
                        </button>

                      )}

                    </div>

                  </div>

                )
              )}

              {/* THINKING */}

              {loading &&
                messages[
                  messages.length - 1
                ]?.role === "user" && (

                  <div className="flex gap-4">

                    <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-[10px] font-bold">
                      AI
                    </div>

                    <div className="flex items-center gap-1 pt-2">

                      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />

                      <span
                        className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                        style={{
                          animationDelay:
                            "150ms",
                        }}
                      />

                      <span
                        className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                        style={{
                          animationDelay:
                            "300ms",
                        }}
                      />

                    </div>

                  </div>

                )}

            </div>

          )}

        </section>

        {/* ===================================================
            INPUT
        =================================================== */}

        <footer className="shrink-0 px-4 md:px-8 pb-5 pt-3 bg-[#0b0d10]">

          <div className="max-w-4xl mx-auto">

            <div className="relative rounded-2xl border border-white/[0.1] bg-[#15181d] focus-within:border-white/[0.18] transition">

              {/* IMAGE PREVIEW */}

              {selectedImage && (

                <div className="px-4 pt-4">

                  <div className="relative inline-block">

                    <img
                      src={
                        selectedImage
                      }
                      alt="Selected image"
                      className="w-24 h-24 object-cover rounded-xl border border-white/[0.1]"
                    />

                    <button
                      type="button"
                      onClick={
                        removeSelectedImage
                      }
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border border-white/[0.15] text-white text-xs hover:bg-red-500 transition"
                      title="Remove image"
                    >
                      ×
                    </button>

                  </div>

                  {imageName && (

                    <p className="text-[10px] text-gray-500 mt-1">
                      {imageName}
                    </p>

                  )}

                </div>

              )}

              {/* TEXTAREA */}

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  selectedImage
                    ? "Ask something about this image..."
                    : "Message My AI..."
                }
                rows={1}
                disabled={loading}
                className="w-full bg-transparent resize-none outline-none px-4 pt-4 pb-14 text-sm text-white placeholder-gray-600 disabled:opacity-60"
              />

              {/* BOTTOM CONTROLS */}

              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">

                <div className="flex items-center gap-1">

                  {/* IMAGE UPLOAD */}

                  <label
                    htmlFor="image-upload"
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                      loading
                        ? "opacity-30 cursor-not-allowed"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                    }`}
                    title="Upload image"
                  >

                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >

                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                      />

                      <circle
                        cx="8.5"
                        cy="8.5"
                        r="1.5"
                      />

                      <path d="M21 15l-5-5L5 21" />

                    </svg>

                  </label>

                  <input
                    ref={
                      fileInputRef
                    }
                    id="image-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={
                      handleImageSelect
                    }
                    disabled={loading}
                    className="hidden"
                  />

                  <span className="text-[11px] text-gray-600 hidden sm:block ml-1">
                    Upload image
                  </span>

                </div>

                {/* SEND */}

                <button
                  onClick={
                    sendMessage
                  }
                  disabled={
                    loading ||
                    (!input.trim() &&
                      !selectedImage)
                  }
                  className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-semibold disabled:opacity-20 hover:bg-gray-200 transition"
                  title="Send message"
                >
                  ↑
                </button>

              </div>

            </div>

            <p className="text-center text-[10px] text-gray-600 mt-3">
              My AI can make mistakes.
              Check important
              information.
            </p>

          </div>

        </footer>

      </div>

    </main>
  );
}
