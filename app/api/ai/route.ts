import OpenAI from "openai";

export const runtime = "nodejs";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function buildMessages(messages: Message[]) {
  return messages.map((message) => {
    if (message.image) {
      return {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text:
              message.content ||
              "Analyze this image carefully.",
          },
          {
            type: "image_url" as const,
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
  });
}

async function analyzeImage(
  messages: Message[]
): Promise<Response> {
  const stream = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",

    messages: [
      {
        role: "system",
        content: `
You are My AI, a helpful multimodal AI assistant.

You can understand images and answer questions about them.

When an image is provided:

- Carefully inspect what is actually visible.
- Describe important visual information when requested.
- Read visible text when possible.
- Help with OCR and document understanding.
- Analyze charts, graphs and diagrams when possible.
- Identify visible objects, colors, layouts and details.
- Answer questions about the image.
- Do not invent details.
- If something cannot be determined, clearly say so.

If the user asks you to edit an image:
Explain that you can analyze the uploaded image, but this version
does not have a pixel-level image editing tool available.

Be helpful and concise.
        `,
      },

      ...buildMessages(messages),
    ],

    stream: true,
    temperature: 0.5,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text =
            chunk.choices[0]?.delta?.content;

          if (text) {
            controller.enqueue(
              encoder.encode(text)
            );
          }
        }

        controller.close();
      } catch (error) {
        console.error(
          "Groq image analysis error:",
          error
        );

        controller.enqueue(
          encoder.encode(
            "\n\nSorry, I couldn't analyze the image."
          )
        );

        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type":
        "text/plain; charset=utf-8",

      "Cache-Control":
        "no-cache, no-transform",
    },
  });
}

async function normalChat(
  messages: Message[]
): Promise<Response> {
  const stream = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",

    messages: [
      {
        role: "system",
        content: `
You are My AI, a helpful general-purpose AI assistant.

Answer clearly, naturally and accurately.

Rules:
- Be helpful.
- Keep answers reasonably concise.
- Explain technical topics clearly.
- Do not invent information.
- If you are uncertain, say so.
- Use markdown when it improves readability.
        `,
      },

      ...buildMessages(messages),
    ],

    stream: true,
    temperature: 0.7,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text =
            chunk.choices[0]?.delta?.content;

          if (text) {
            controller.enqueue(
              encoder.encode(text)
            );
          }
        }

        controller.close();
      } catch (error) {
        console.error(
          "Groq chat error:",
          error
        );

        controller.enqueue(
          encoder.encode(
            "\n\nSorry, something went wrong."
          )
        );

        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type":
        "text/plain; charset=utf-8",

      "Cache-Control":
        "no-cache, no-transform",
    },
  });
}

export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return jsonResponse(
        {
          error:
            "GROQ_API_KEY is missing. Add it to your environment variables.",
        },
        500
      );
    }

    const body = await request.json();

    const messages = body.messages as Message[];

    if (!Array.isArray(messages)) {
      return jsonResponse(
        {
          error: "Invalid messages.",
        },
        400
      );
    }

    if (messages.length === 0) {
      return jsonResponse(
        {
          error: "No messages provided.",
        },
        400
      );
    }

    const latestMessage =
      messages[messages.length - 1];

    if (!latestMessage) {
      return jsonResponse(
        {
          error: "No message provided.",
        },
        400
      );
    }

    const hasImage =
      Boolean(latestMessage.image);

    console.log(
      "AI request:",
      hasImage
        ? "Image analysis"
        : "Normal chat"
    );

    if (hasImage) {
      return analyzeImage(messages);
    }

    return normalChat(messages);
  } catch (error) {
    console.error(
      "AI API error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      500
    );
  }
}
