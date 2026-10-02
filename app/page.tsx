"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
  type?: "text" | "image";
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
    useState<string>("");

  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<string>("");

  const [imageName, setImageName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [copied, setCopied] =
    useState<number | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  // --------------------------------
  // LOAD HISTORY
  // --------------------------------

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setChats(parsed);

          if (parsed.length > 0) {
            setActiveChatId(parsed[0].id);
          }
        }
      }
    } catch (error) {
      console.error(
        "Could not load chat history:",
        error
      );
    }
  }, []);

  // --------------------------------
  // SAVE HISTORY
  // --------------------------------

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.warn(
        "Chat history could not be saved:",
        error
      );
    }
  }, [chats]);

  // --------------------------------
  // CREATE CHAT
  // --------------------------------

  function createChat() {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };

    setChats((prev) => [
      newChat,
      ...prev,
    ]);

    setActiveChatId(newChat.id);

    setInput("");
    setSelectedImage("");
    setImageName("");
  }

  // --------------------------------
  // GET ACTIVE CHAT
  // --------------------------------

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const messages =
    activeChat?.messages || [];

  // --------------------------------
  // DELETE CHAT
  // --------------------------------

  function deleteChat(
    event: React.MouseEvent,
    id: string
  ) {
    event.stopPropagation();

    const remaining = chats.filter(
      (chat) => chat.id !== id
    );

    setChats(remaining);

    if (activeChatId === id) {
      setActiveChatId(
        remaining[0]?.id || ""
      );
    }
  }

  // --------------------------------
  // IMAGE UPLOAD
  // --------------------------------

  function handleImageUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    // Keep upload reasonably small because
    // the image is sent as base64.
    if (file.size > 3 * 1024 * 1024) {
      alert(
        "Please choose an image smaller than 3 MB."
      );
      return;
    }

    setImageName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      if (
        typeof reader.result === "string"
      ) {
        setSelectedImage(
          reader.result
        );
      }
    };

    reader.readAsDataURL(file);
  }

  // --------------------------------
  // REMOVE IMAGE
  // --------------------------------

  function removeSelectedImage() {
    setSelectedImage("");
    setImageName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // --------------------------------
  // UPDATE CHAT
  // --------------------------------

  function updateChat(
    chatId: string,
    newMessages: Message[]
  ) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }

        let title = chat.title;

        if (
          chat.messages.length === 0 &&
          newMessages.length > 0
        ) {
          const firstUserMessage =
            newMessages.find(
              (message) =>
                message.role === "user"
            );

          if (
            firstUserMessage?.content
          ) {
            title =
              firstUserMessage.content
                .slice(0, 35)
                .trim() || "New chat";
          } else {
            title = "Image chat";
          }
        }

        return {
          ...chat,
          title,
          messages: newMessages,
        };
      })
    );
  }

  // --------------------------------
  // SEND MESSAGE
  // --------------------------------

  async function sendMessage() {
    const text = input.trim();

    if (
      (!text && !selectedImage) ||
      loading
    ) {
      return;
    }

    let chatId = activeChatId;

    if (!chatId) {
      const newChat: Chat = {
        id: crypto.randomUUID(),
        title:
          text.slice(0, 35) ||
          "Image chat",
        messages: [],
        createdAt: Date.now(),
      };

      setChats((prev) => [
        newChat,
        ...prev,
      ]);

      chatId = newChat.id;
      setActiveChatId(chatId);
    }

    const userMessage: Message = {
      role: "user",
      content:
        text ||
        "Please analyze this image.",
      image: selectedImage || undefined,
      type: selectedImage
        ? "image"
        : "text",
    };

    const currentMessages =
      chats.find(
        (chat) => chat.id === chatId
      )?.messages || [];

    const newMessages = [
      ...currentMessages,
      userMessage,
    ];

    updateChat(
      chatId,
      newMessages
    );

    setInput("");
    setSelectedImage("");
    setImageName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai",
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
          "Something went wrong.";

        try {
          const error =
            await response.json();

          errorMessage =
            error.error ||
            errorMessage;
        } catch {}

        throw new Error(
          errorMessage
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      // --------------------------------
      // IMAGE RESPONSE
      // --------------------------------

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const result =
          await response.json();

        const assistantMessage: Message =
          {
            role: "assistant",
            content:
              result.text ||
              "Done.",
            image: result.image,
            type: "image",
          };

        updateChat(chatId, [
          ...newMessages,
          assistantMessage,
        ]);

        return;
      }

      // --------------------------------
      // STREAMING TEXT RESPONSE
      // --------------------------------

      if (!response.body) {
        throw new Error(
          "No response body received."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let assistantText = "";

      const assistantMessage: Message =
        {
          role: "assistant",
          content: "",
          type: "text",
        };

      updateChat(chatId, [
        ...newMessages,
        assistantMessage,
      ]);

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        assistantText += chunk;

        updateChat(chatId, [
          ...newMessages,
          {
            role: "assistant",
            content:
              assistantText,
            type: "text",
          },
        ]);
      }
    } catch (error) {
      console.error(error);

      updateChat(chatId, [
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

  // --------------------------------
  // ENTER KEY
  // --------------------------------

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

  // --------------------------------
  // COPY
  // --------------------------------

  async function copyMessage(
    content: string,
    index: number
  ) {
    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopied(index);

      setTimeout(() => {
        setCopied(null);
      }, 1500);
    } catch {
      console.error(
        "Copy failed."
      );
    }
  }

  // --------------------------------
  // SUGGESTION
  // --------------------------------

  function useSuggestion(
    suggestion: string
  ) {
    setInput(suggestion);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  return (
    <main className="flex h-screen bg-[#0b0d10] text-white overflow-hidden">
      {/* SIDEBAR */}

      <aside className="hidden md:flex w-[270px] flex-col border-r border-white/10 bg-[#101216]">
        <div className="p-4">
          <button
            onClick={createChat}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition"
          >
            <span className="text-lg">
              ＋
            </span>{" "}
            New chat
          </button>
        </div>

        <div className="px-4 pb-2 text-xs uppercase tracking-wider text-gray-500">
          History
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() =>
                setActiveChatId(chat.id)
              }
              className={`group mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
                activeChatId === chat.id
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              }`}
            >
              <span className="truncate">
                {chat.title}
              </span>

              <span
                onClick={(event) =>
                  deleteChat(
                    event,
                    chat.id
                  )
                }
                className="ml-2 hidden cursor-pointer text-gray-500 group-hover:block hover:text-red-400"
              >
                ×
              </span>
            </button>
          ))}

          {chats.length === 0 && (
            <div className="px-3 py-5 text-sm text-gray-600">
              No conversations yet.
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4 text-xs text-gray-500">
          My AI
          <br />
          Powered by Groq + AI image generation
        </div>
      </aside>

      {/* MAIN */}

      <section className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}

        <header className="flex h-16 items-center border-b border-white/10 px-5">
          <div>
            <h1 className="font-semibold">
              My AI
            </h1>

            <p className="text-xs text-gray-500">
              Multimodal AI Assistant
            </p>
          </div>
        </header>

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                ✦
              </div>

              <h2 className="text-3xl font-semibold">
                What can I help you with?
              </h2>

              <p className="mt-3 text-center text-gray-500">
                Ask questions, upload images,
                analyze photos or create new
                images.
              </p>

              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  "Analyze this image",
                  "Read the text in this image",
                  "Explain this chart",
                  "Create an image of a futuristic city",
                ].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() =>
                        useSuggestion(
                          suggestion
                        )
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-gray-300 hover:bg-white/[0.07] transition"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-5 py-8">
              {messages.map(
                (message, index) => (
                  <div
                    key={index}
                    className={`mb-8 flex ${
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
                          ? "rounded-2xl bg-white/10 px-4 py-3"
                          : ""
                      }`}
                    >
                      {/* IMAGE */}

                      {message.image && (
                        <div className="mb-3 overflow-hidden rounded-xl border border-white/10">
                          <img
                            src={
                              message.image
                            }
                            alt="Uploaded or generated"
                            className="max-h-[500px] w-auto max-w-full object-contain"
                          />
                        </div>
                      )}

                      {/* TEXT */}

                      {message.content && (
                        <div className="whitespace-pre-wrap text-[15px] leading-7">
                          {message.content}
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
                            className="mt-3 text-xs text-gray-500 hover:text-white"
                          >
                            {copied ===
                            index
                              ? "Copied"
                              : "Copy"}
                          </button>
                        )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="animate-pulse">
                    ●
                  </span>
                  My AI is working...
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT */}

        <div className="border-t border-white/10 bg-[#0b0d10] p-4">
          <div className="mx-auto max-w-3xl">
            {/* IMAGE PREVIEW */}

            {selectedImage && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {imageName ||
                      "Image attached"}
                  </p>

                  <p className="text-xs text-gray-500">
                    Ask My AI what to do with
                    this image.
                  </p>
                </div>

                <button
                  onClick={
                    removeSelectedImage
                  }
                  className="rounded-lg px-3 py-2 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#15181d] p-2 shadow-2xl">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedImage
                    ? "Tell My AI what to do with this image..."
                    : "Message My AI..."
                }
                rows={1}
                className="max-h-40 min-h-[48px] w-full resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-gray-600"
              />

              <div className="flex items-center justify-between px-1 pb-1">
                <div>
                  {/* FILE INPUT */}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={
                      handleImageUpload
                    }
                    className="hidden"
                  />

                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={loading}
                    title="Upload image"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.82-2.83l8.49-8.48" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={sendMessage}
                  disabled={
                    loading ||
                    (!input.trim() &&
                      !selectedImage)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
              </div>
            </div>

            <p className="mt-2 text-center text-[11px] text-gray-600">
              My AI can analyze images and
              create or edit images.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
