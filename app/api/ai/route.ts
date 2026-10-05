import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content:
    | string
    | Array<{
        type: "text" | "image_url";
        text?: string;
        image_url?: {
          url: string;
        };
      }>;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY is missing.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await request.json();

    const messages = body.messages as ChatMessage[];

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({
          error: "Invalid messages.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const hasImage = messages.some(
      (message) =>
        Array.isArray(message.content) &&
        message.content.some(
          (part) => part.type === "image_url"
        )
    );

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const systemMessage: ChatMessage = {
      role: "system",
      content: `
You are My AI, a helpful general-purpose AI assistant.

Your responsibilities:

- Answer questions clearly and accurately.
- Explain difficult topics in simple language when useful.
- Help with Python, SQL, Data Science, Machine Learning, statistics, mathematics, Excel, Power BI, Tableau and programming.
- Help users understand uploaded documents and images.
- When an image is supplied, carefully analyze only what is actually visible.
- Do not invent details that cannot be determined.
- If information is uncertain, say so.
- Use headings, bullets and examples when they improve readability.
- Keep normal answers reasonably concise unless the user asks for detail.
`,
    };

    const stream = await client.chat.completions.create({
      model: hasImage ? VISION_MODEL : TEXT_MODEL,
      messages: [systemMessage, ...messages] as any,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;

            if (content) {
              controller.enqueue(
                encoder.encode(content)
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error(
            "Groq streaming error:",
            error
          );

          controller.enqueue(
            encoder.encode(
              "\n\nSorry, something went wrong while generating the response."
            )
          );

          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Groq API error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown Groq API error.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
