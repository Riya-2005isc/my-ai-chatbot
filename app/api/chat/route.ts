import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

export async function POST(request: Request) {
  try {
    console.log("=== CHAT API START ===");

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("GROQ_API_KEY is missing");

      return new Response(
        "GROQ_API_KEY is missing from the server environment.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain",
          },
        }
      );
    }

    console.log("API key exists");

    const body = await request.json();

    console.log("Request body received");

    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        "Invalid messages format.",
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain",
          },
        }
      );
    }

    const hasImage = messages.some(
      (message: any) =>
        Array.isArray(message?.content) &&
        message.content.some(
          (part: any) => part?.type === "image_url"
        )
    );

    const model = hasImage
      ? VISION_MODEL
      : TEXT_MODEL;

    console.log("Using model:", model);

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    console.log("Calling Groq...");

    const completion =
      await client.chat.completions.create({
        model,
        messages,
        temperature: 0.6,
      });

    console.log("Groq response received");

    const answer =
      completion.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    return new Response(answer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("=== CHAT API ERROR ===");
    console.error(error);

    const errorMessage =
      error?.error?.message ||
      error?.message ||
      String(error);

    console.error(
      "Actual error:",
      errorMessage
    );

    return new Response(
      `CHAT API ERROR: ${errorMessage}`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}
