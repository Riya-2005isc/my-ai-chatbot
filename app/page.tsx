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
  fileName?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const STORAGE_KEY = "my-ai-chat-history";

function createChat(): Chat {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] =
    useState<string>("");

  const [input, setInput] = useState("");
  const [loading, setLoading] =
    useState(false);

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileLoading, setFileLoading] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const imageInputRef =
    useRef<HTMLInputElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      } catch {
        // Ignore invalid local storage
      }
    }

    const firstChat = createChat();

    setChats([firstChat]);
    setActiveChatId(firstChat.id);
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    }
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chats, loading]);

  const activeChat =
    chats.find(
      (chat) => chat.id === activeChatId
    ) || null;

  function updateChat(
    chatId: string,
    updater: (chat: Chat) => Chat
  ) {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? updater(chat)
          : chat
      )
    );
  }

  function handleNewChat() {
    const newChat = createChat();

    setChats((previous) => [
      newChat,
      ...previous,
    ]);

    setActiveChatId(newChat.id);
    setInput("");
    setSelectedImage(null);
    setSelectedFile(null);
  }

  function handleDeleteChat(
    chatId: string
  ) {
    const remaining = chats.filter(
      (chat) => chat.id !== chatId
    );

    if (remaining.length === 0) {
      const newChat = createChat();

      setChats([newChat]);
      setActiveChatId(newChat.id);
      return;
    }

    setChats(remaining);

    if (activeChatId === chatId) {
      setActiveChatId(
        remaining[0].id
      );
    }
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        "Please choose an image smaller than 10 MB."
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

    setSelectedFile(null);

    event.target.value = "";
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const allowedExtensions = [
      ".pdf",
      ".docx",
      ".xlsx",
      ".xls",
      ".csv",
      ".txt",
    ];

    const lowerName =
      file.name.toLowerCase();

    const valid =
      allowedExtensions.some(
        (extension) =>
          lowerName.endsWith(extension)
      );

    if (!valid) {
      alert(
        "Supported files: PDF, DOCX, XLSX, XLS, CSV and TXT."
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert(
        "Please choose a file smaller than 15 MB."
      );
      return;
    }

    setSelectedFile(file);
    setSelectedImage(null);

    event.target.value = "";
  }

  function removeAttachment() {
    setSelectedImage(null);
    setSelectedFile(null);
  }

  async function sendMessage(
    event?: FormEvent
  ) {
    event?.preventDefault();

    if (loading || fileLoading) {
      return;
    }

    const text = input.trim();

    if (
      !text &&
      !selectedImage &&
      !selectedFile
    ) {
      return;
    }

    if (!activeChat) {
      return;
    }

    if (selectedFile) {
      await analyzeFile(
        selectedFile,
        text ||
          "Analyze this file and give me the most important information."
      );

      return;
    }

    const userMessage: Message = {
      role: "user",
      content:
        text ||
        "Please analyze this image.",
      image: selectedImage || undefined,
    };

    const updatedMessages = [
      ...activeChat.messages,
      userMessage,
    ];

    const title =
      activeChat.messages.length === 0
        ? text.slice(0, 40) ||
          "Image Analysis"
        : activeChat.title;

    updateChat(
      activeChat.id,
      (chat) => ({
        ...chat,
        title:
          chat.title === "New Chat"
            ? title
            : chat.title,
        messages: updatedMessages,
      })
    );

    setInput("");
    setSelectedImage(null);
    setLoading(true);

    try {
      const apiMessages =
        updatedMessages.map(
          (message) => {
            if (message.image) {
              return {
                role: message.role,
                content: [
                  {
                    type: "text",
                    text: message.content,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: message.image,
                    },
                  },
                ],
              };
            }

            return {
              role: message.role,
              content: message.content,
            };
          }
        );

      const response =
        await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages: apiMessages,
          }),
        });

      if (!response.ok) {
        let errorMessage =
          "Something went wrong.";

        try {
          const error =
            await response.json();

          errorMessage =
            error.error ||
            errorMessage;
        } catch {
          // Ignore JSON parsing errors
        }

        throw new Error(
          errorMessage
        );
      }

      if (!response.body) {
        throw new Error(
          "No response received from the server."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let assistantText = "";

      updateChat(
        activeChat.id,
        (chat) => ({
          ...chat,
          messages: [
            ...chat.messages,
            {
              role: "assistant",
              content: "",
            },
          ],
        })
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

        updateChat(
          activeChat.id,
          (chat) => {
            const messages = [
              ...chat.messages,
            ];

            const last =
              messages[
                messages.length - 1
              ];

            if (
              last?.role ===
              "assistant"
            ) {
              messages[
                messages.length - 1
              ] = {
                ...last,
                content:
                  assistantText,
              };
            }

            return {
              ...chat,
              messages,
            };
          }
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      updateChat(
        activeChat.id,
        (chat) => ({
          ...chat,
          messages: [
            ...chat.messages,
            {
              role: "assistant",
              content:
                `Sorry, I couldn't complete that request.\n\n${message}`,
            },
          ],
        })
      );
    } finally {
      setLoading(false);
    }
  }

  async function analyzeFile(
    file: File,
    question: string
  ) {
    if (!activeChat) return;

    setFileLoading(true);

    const userMessage: Message = {
      role: "user",
      content: question,
      fileName: file.name,
    };

    const newMessages = [
      ...activeChat.messages,
      userMessage,
    ];

    updateChat(
      activeChat.id,
      (chat) => ({
        ...chat,
        title:
          chat.messages.length === 0
            ? file.name.slice(0, 40)
            : chat.title,
        messages: newMessages,
      })
    );

    setInput("");
    setSelectedFile(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "question",
        question
      );

      const response =
        await fetch(
          "/api/analyze-file",
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "File analysis failed."
        );
      }

      updateChat(
        activeChat.id,
        (chat) => ({
          ...chat,
          messages: [
            ...chat.messages,
            {
              role: "assistant",
              content:
                result.answer,
            },
          ],
        })
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "File analysis failed.";

      updateChat(
        activeChat.id,
        (chat) => ({
          ...chat,
          messages: [
            ...chat.messages,
            {
              role: "assistant",
              content:
                `I couldn't analyze this file.\n\n${message}`,
            },
          ],
        })
      );
    } finally {
      setFileLoading(false);
    }
  }

  async function copyMessage(
    content: string
  ) {
    try {
      await navigator.clipboard.writeText(
        content
      );
    } catch {
      alert(
        "Unable to copy the message."
      );
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#0b0d10] text-white">
      {/* SIDEBAR */}

      <aside
        className={`${
          sidebarOpen
            ? "w-[280px]"
            : "w-0"
        } shrink-0 overflow-hidden border-r border-white/10 bg-[#111318] transition-all duration-200`}
      >
        <div className="flex h-full w-[280px] flex-col">
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
            >
              <span className="text-lg">
                +
              </span>
              New chat
            </button>
          </div>

          <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wider text-white/40">
            Chat history
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group mb-1 flex items-center rounded-lg ${
                  activeChatId ===
                  chat.id
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <button
                  onClick={() =>
                    setActiveChatId(
                      chat.id
                    )
                  }
                  className="min-w-0 flex-1 truncate px-3 py-3 text-left text-sm text-white/80"
                >
                  {chat.title ||
                    "New Chat"}
                </button>

                <button
                  onClick={() =>
                    handleDeleteChat(
                      chat.id
                    )
                  }
                  className="mr-2 hidden rounded p-1 text-white/30 hover:bg-white/10 hover:text-white group-hover:block"
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 p-4 text-xs text-white/35">
            My AI
            <br />
            Powered by Groq
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <section className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}

        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f1115]/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setSidebarOpen(
                  (value) => !value
                )
              }
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              title="Toggle sidebar"
            >
              ☰
            </button>

            <div>
              <div className="font-semibold">
                My AI
              </div>
              <div className="text-[11px] text-white/35">
                Groq AI Assistant
              </div>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            New chat
          </button>
        </header>

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto">
          {activeChat?.messages.length ===
            0 && (
            <div className="flex min-h-full items-center justify-center px-6">
              <div className="w-full max-w-2xl text-center">
                <div className="mb-4 text-5xl">
                  ✨
                </div>

                <h1 className="mb-3 text-3xl font-semibold">
                  How can I help you?
                </h1>

                <p className="mx-auto max-w-xl text-sm leading-6 text-white/45">
                  Ask anything, upload an
                  image, or upload a PDF,
                  Word document, Excel file,
                  CSV or text file.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "Explain machine learning simply",
                    "Write a Python program",
                    "Analyze my PDF",
                    "Analyze this Excel file",
                  ].map(
                    (suggestion) => (
                      <button
                        key={
                          suggestion
                        }
                        onClick={() =>
                          setInput(
                            suggestion
                          )
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-white/65 transition hover:bg-white/[0.07]"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mx-auto w-full max-w-4xl px-4 py-8">
            {activeChat?.messages.map(
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
                        ? "rounded-2xl bg-[#2b2f36] px-4 py-3"
                        : "w-full"
                    }`}
                  >
                    {message.image && (
                      <img
                        src={
                          message.image
                        }
                        alt="Uploaded"
                        className="mb-3 max-h-[400px] max-w-full rounded-xl object-contain"
                      />
                    )}

                    {message.fileName && (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                        📄
                        <span className="truncate">
                          {
                            message.fileName
                          }
                        </span>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap text-sm leading-7">
                      {message.content}
                    </div>

                    {message.role ===
                      "assistant" &&
                      message.content && (
                        <button
                          onClick={() =>
                            copyMessage(
                              message.content
                            )
                          }
                          className="mt-3 rounded-lg px-2 py-1 text-xs text-white/30 hover:bg-white/5 hover:text-white/70"
                        >
                          Copy
                        </button>
                      )}
                  </div>
                </div>
              )
            )}

            {(loading ||
              fileLoading) && (
              <div className="mb-8 flex items-center gap-3 text-sm text-white/45">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" />
                </div>

                {fileLoading
                  ? "Analyzing file..."
                  : "Thinking..."}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* COMPOSER */}

        <div className="border-t border-white/10 bg-[#0b0d10] p-4">
          <div className="mx-auto max-w-4xl">
            {(selectedImage ||
              selectedFile) && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                {selectedImage && (
                  <img
                    src={
                      selectedImage
                    }
                    alt="Preview"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {selectedImage
                      ? "Image attached"
                      : selectedFile?.name}
                  </div>

                  <div className="text-xs text-white/40">
                    {selectedImage
                      ? "Ready for image analysis"
                      : "Ready for file analysis"}
                  </div>
                </div>

                <button
                  onClick={
                    removeAttachment
                  }
                  className="rounded-lg px-3 py-2 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={sendMessage}
              className="rounded-2xl border border-white/10 bg-[#15181d] shadow-2xl"
            >
              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Message My AI..."
                rows={1}
                className="max-h-40 min-h-[58px] w-full resize-none bg-transparent px-4 py-4 text-sm outline-none placeholder:text-white/30"
              />

              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  {/* IMAGE UPLOAD */}

                  <button
                    type="button"
                    onClick={() =>
                      imageInputRef.current?.click()
                    }
                    className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white"
                    title="Upload image"
                  >
                    🖼️
                  </button>

                  {/* FILE UPLOAD */}

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white"
                    title="Upload PDF, DOCX, Excel, CSV or TXT"
                  >
                    📎
                  </button>

                  <input
                    ref={
                      imageInputRef
                    }
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={
                      handleImageChange
                    }
                  />

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={
                      handleFileChange
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    fileLoading ||
                    (!input.trim() &&
                      !selectedImage &&
                      !selectedFile)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Send"
                >
                  ↑
                </button>
              </div>
            </form>

            <p className="mt-2 text-center text-[11px] text-white/25">
              My AI can make mistakes. Check
              important information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
