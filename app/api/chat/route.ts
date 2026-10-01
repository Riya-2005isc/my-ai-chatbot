import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is missing.",
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
    });

    const { messages } = await request.json();

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

    const stream = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions:
        "You are My AI, a helpful general-purpose AI assistant. Answer clearly, accurately, naturally, and concisely. Explain difficult topics in simple language when appropriate. Do not make up information.",
      input: messages,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(
                encoder.encode(event.delta)
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);

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
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred.",
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
