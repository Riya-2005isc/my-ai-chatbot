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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function detectIntent(
  prompt: string,
  hasImage: boolean
): Promise<"chat" | "analyze" | "edit" | "generate"> {
  if (!hasImage) {
    const generateWords = [
      "generate an image",
      "create an image",
      "make an image",
      "draw an image",
      "create a picture",
      "generate a picture",
      "make a picture",
      "create artwork",
      "generate artwork",
    ];

    if (
      generateWords.some((word) =>
        prompt.toLowerCase().includes(word)
      )
    ) {
      return "generate";
    }

    return "chat";
  }

  try {
    const result = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",

      messages: [
        {
          role: "system",
          content: `
Classify the user's request into exactly one category.

Possible categories:

chat:
Normal conversation that does not require image understanding.

analyze:
The user wants to understand, inspect, describe, read, OCR, identify,
explain, summarize, or answer a question about the uploaded image.

edit:
The user wants to modify the uploaded image.
Examples include:
- remove something
- replace something
- change background
- change clothes
- change colors
- improve image
- make it cinematic
- make it professional
- add something
- remove something
- restore
- enhance
- resize
- transform the visual appearance

generate:
The user wants to create a completely new image rather than modify
the uploaded image.

Return ONLY valid JSON:

{"intent":"chat"}

or

{"intent":"analyze"}

or

{"intent":"edit"}

or

{"intent":"generate"}
          `,
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      response_format: {
        type: "json_object",
      },

      temperature: 0,
    });

    const content = result.choices[0]?.message?.content;

    if (content) {
      const parsed = JSON.parse(content);

      if (
        parsed.intent === "chat" ||
        parsed.intent === "analyze" ||
        parsed.intent === "edit" ||
        parsed.intent === "generate"
      ) {
        return parsed.intent;
      }
    }
  } catch (error) {
    console.error("Intent detection error:", error);
  }

  return hasImage ? "analyze" : "chat";
}

async function analyzeImage(
  messages: Message[]
): Promise<Response> {
  const formattedMessages = messages.map((message) => {
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

  const stream = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",

    messages: [
      {
        role: "system",
        content: `
You are My AI, a helpful multimodal AI assistant.

When an image is provided:
- Carefully inspect what is actually visible.
- Answer questions about the image.
- Read visible text when asked.
- Analyze charts, diagrams and documents when possible.
- Identify objects, colors, layouts and visible details.
- Do not invent details.
- If something cannot be determined from the image, say so.
- Give useful and natural answers.

Do not claim that you edited an image.
If the user asks for an actual image modification, that request
should be handled by the image editing system.
        `,
      },
      ...formattedMessages,
    ],

    stream: true,
    temperature: 0.7,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;

          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (error) {
        console.error("Groq stream error:", error);

        controller.enqueue(
          encoder.encode(
            "\n\nSorry, something went wrong while analyzing the image."
          )
        );

        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function editImage(
  imageData: string,
  prompt: string
) {
  const response = await fetch(
    "https://api.openai.com/v1/images/edits",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: (() => {
        const form = new FormData();

        const match = imageData.match(
          /^data:(image\/[^;]+);base64,(.+)$/
        );

        if (!match) {
          throw new Error("Invalid image format.");
        }

        const mimeType = match[1];
        const base64Data = match[2];

        const binary = Buffer.from(base64Data, "base64");

        const extension =
          mimeType === "image/jpeg"
            ? "jpg"
            : mimeType === "image/webp"
            ? "webp"
            : "png";

        const blob = new Blob([binary], {
          type: mimeType,
        });

        form.append(
          "image",
          blob,
          `uploaded-image.${extension}`
        );

        form.append("model", "gpt-image-2.5-sunburst");

        form.append(
          "prompt",
          `
Edit the uploaded image according to the user's instruction.

Preserve the important identity, composition and details of
the original image unless the user specifically asks to change them.

User instruction:
${prompt}
          `.trim()
        );

        form.append("size", "1024x1024");

        form.append("quality", "medium");

        return form;
      })(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Image editing API error: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  const base64 = data?.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error(
      "Image editing API did not return an image."
    );
  }

  return `data:image/png;base64,${base64}`;
}

async function generateImage(prompt: string) {
  const response = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "gpt-image-2.5-flare",
        prompt,
        size: "1024x1024",
        quality: "medium",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Image generation API error: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  const base64 = data?.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error(
      "Image generation API did not return an image."
    );
  }

  return `data:image/png;base64,${base64}`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return jsonResponse(
        {
          error: "GROQ_API_KEY is missing.",
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

    const prompt = latestMessage.content || "";

    const hasImage = Boolean(latestMessage.image);

    const intent = await detectIntent(
      prompt,
      hasImage
    );

    console.log("Detected intent:", intent);

    // --------------------------------
    // IMAGE EDIT
    // --------------------------------

    if (intent === "edit") {
      if (!process.env.OPENAI_API_KEY) {
        return jsonResponse(
          {
            error:
              "OPENAI_API_KEY is missing. Add it to your environment variables.",
          },
          500
        );
      }

      if (!latestMessage.image) {
        return jsonResponse(
          {
            error:
              "Please upload an image that you want to edit.",
          },
          400
        );
      }

      const image = await editImage(
        latestMessage.image,
        prompt
      );

      return jsonResponse({
        type: "image",
        intent: "edit",
        image,
        text: "I've created the edited version based on your instruction.",
      });
    }

    // --------------------------------
    // IMAGE GENERATION
    // --------------------------------

    if (intent === "generate") {
      if (!process.env.OPENAI_API_KEY) {
        return jsonResponse(
          {
            error:
              "OPENAI_API_KEY is missing. Add it to your environment variables.",
          },
          500
        );
      }

      const image = await generateImage(prompt);

      return jsonResponse({
        type: "image",
        intent: "generate",
        image,
        text: "I've generated the image based on your prompt.",
      });
    }

    // --------------------------------
    // IMAGE ANALYSIS
    // --------------------------------

    if (intent === "analyze") {
      return analyzeImage(messages);
    }

    // --------------------------------
    // NORMAL CHAT
    // --------------------------------

    const stream = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",

      messages: [
        {
          role: "system",
          content:
            "You are My AI, a helpful general-purpose AI assistant. " +
            "Answer clearly, accurately, naturally and concisely. " +
            "Do not make up information.",
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
          console.error("Chat stream error:", error);

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
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("AI API error:", error);

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
