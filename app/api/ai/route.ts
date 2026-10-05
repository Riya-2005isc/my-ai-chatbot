import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `
You are My AI, a helpful and intelligent general-purpose AI assistant.

Answer naturally and accurately.

Rules:
- Understand the user's actual question before answering.
- Keep simple answers concise.
- Give detailed explanations when requested.
- Use headings, bullets, tables, and code blocks when useful.
- Maintain conversation context for follow-up questions.
- Do not unnecessarily repeat the user's question.
- Do not invent facts.
- If you are uncertain, say so.
- Explain difficult concepts simply when appropriate.
- For programming questions, provide clean runnable code.
- For Data Science and Machine Learning questions, explain concepts,
  practical examples, and important details when useful.
- When an image is supplied, analyze only what is actually visible.
`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "GROQ_API_KEY is missing in Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        {
          error: "No valid messages were provided.",
        },
        { status: 400 }
      );
    }

    const hasImage = messages.some(
      (message: any) =>
        Array.isArray(message.content) &&
        message.content.some(
          (part: any) =>
            part.type === "image_url"
        )
    );

    const model = hasImage
      ? VISION_MODEL
      : TEXT_MODEL;

    const client = new OpenAI({
      apiKey,
      baseURL:
        "https://api.groq.com/openai/v1",
    });

    const completion =
      await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...messages,
        ],
        temperature: 0.6,
      });

    const answer =
      completion.choices[0]?.message?.content;

    if (!answer) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    return Response.json({
      success: true,
      answer,
    });
  } catch (error: any) {
    console.error("CHAT API ERROR:", error);

    const message =
      error?.error?.message ||
      error?.message ||
      "Unknown Groq API error.";

    const status =
      typeof error?.status === "number"
        ? error.status
        : 500;

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
