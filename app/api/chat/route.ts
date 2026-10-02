import OpenAI from "openai";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  image?: string;
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

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const body = await request.json();
    const messages = body.messages as IncomingMessage[];

    if (!messages || !Array.isArray(messages)) {
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

    const formattedMessages = messages.map((message) => {
      if (message.image) {
        return {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text:
                message.content ||
                "Please analyze this image and describe what you see.",
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

      if (message.role === "assistant") {
        return {
          role: "assistant" as const,
          content: message.content,
        };
      }

      return {
        role: "user" as const,
        content: message.content,
      };
    });

    const stream = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",

      messages: [
        {
          role: "system",
          content:
            "You are My AI, a helpful general-purpose AI assistant. " +
            "Answer clearly, accurately, naturally, and concisely. " +
            "Explain difficult topics in simple language when appropriate. " +
            "Do not make up information. " +
            "When an image is provided, carefully analyze only what is visible " +
            "in the image and clearly state when something cannot be determined.",
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
            const content = chunk.choices[0]?.delta?.content;

            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Groq streaming error:", error);

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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
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
