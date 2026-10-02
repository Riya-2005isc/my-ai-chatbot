import OpenAI from "openai";

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
    const messages = body?.messages;

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

    /*
     * Convert your frontend message format:
     *
     * {
     *   role: "user",
     *   content: "What is this?",
     *   image: "data:image/jpeg;base64,..."
     * }
     *
     * into Groq's multimodal format.
     */

    const formattedMessages = messages.map(
      (message: {
        role: "user" | "assistant";
        content: string;
        image?: string;
      }) => {
        // Normal text message
        if (!message.image) {
          return {
            role: message.role,
            content: message.content || "",
          };
        }

        // User message containing an image
        return {
          role: message.role,
          content: [
            {
              type: "text",
              text:
                message.content ||
                "Please analyze this image and describe what you see.",
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
    );

    /*
     * Vision-capable Groq model
     */
    const stream =
      await client.chat.completions.create({
        model:
          "meta-llama/llama-4-scout-17b-16e-instruct",

        messages: [
          {
            role: "system",
            content:
              "You are My AI, a helpful general-purpose AI assistant. Answer clearly, accurately, naturally, and concisely. When an image is provided, carefully analyze its visible contents and answer the user's question about it. Do not invent details that cannot be seen.",
          },

          ...formattedMessages,
        ],

        stream: true,

        temperature: 0.7,
      });

    const encoder = new TextEncoder();

    const readableStream =
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content =
                chunk.choices[0]?.delta
                  ?.content;

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

    return new Response(
      readableStream,
      {
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          "Connection": "keep-alive",
        },
      }
    );
  } catch (error) {
    console.error(
      "Groq API error:",
      error
    );

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
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}
