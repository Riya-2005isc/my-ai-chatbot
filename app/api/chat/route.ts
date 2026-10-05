import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `
You are My AI, a highly capable, friendly and natural AI assistant.

Your goal is to give useful, accurate, easy-to-understand answers.

RESPONSE STYLE:
- Understand what the user actually wants before answering.
- Be conversational and natural, not robotic or textbook-like.
- Keep simple questions concise.
- Give detailed explanations when the user needs them.
- Use headings, bullets, numbered steps, tables and code blocks when useful.
- Do not unnecessarily repeat the user's question.
- Do not add unnecessary introductions or conclusions.
- For follow-up questions, use the previous conversation context.
- If the user asks for an example, give a practical example.
- If the user asks to compare things, use a clear comparison.
- If the user asks "how", give step-by-step instructions.

ACCURACY:
- Do not invent facts.
- If you are uncertain, clearly say so.
- Do not pretend to have access to information you do not have.

PROGRAMMING:
- Provide clean, runnable code.
- Explain important parts of the code.
- When debugging, identify the likely cause first and then provide the fix.
- Prefer complete replacement code when a file needs to be replaced.

DATA SCIENCE:
- Explain concepts clearly.
- Use practical examples where helpful.
- For Python, SQL, Machine Learning, Power BI and statistics questions,
  provide useful technical details without making the answer unnecessarily complicated.

IMAGES:
- When an image is provided, analyze only what is actually visible.
- Do not invent details that cannot be determined from the image.

DOCUMENTS:
- When file information is provided, answer using the available document content.
`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        "Error: GROQ_API_KEY is missing. Add it to your Vercel Environment Variables.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    const body = await request.json();

    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        "Error: No valid messages were provided.",
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
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

    const model = hasImage ? VISION_MODEL : TEXT_MODEL;

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...messages,
      ],
      temperature: 0.6,
      stream: true,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices?.[0]?.delta?.content;

            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }

          controller.close();
        } catch (error: any) {
          console.error("Groq streaming error:", error);

          const errorMessage =
            error?.error?.message ||
            error?.message ||
            "Groq streaming failed.";

          controller.enqueue(
            encoder.encode(
              `\n\n[Error: ${errorMessage}]`
            )
          );

          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("CHAT API ERROR:", error);

    const message =
      error?.error?.message ||
      error?.message ||
      "Something went wrong while contacting Groq.";

    return new Response(
      `Error: ${message}`,
      {
        status: error?.status || 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}
