import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `
You are My AI, a professional, intelligent and friendly AI assistant.

Your responses must feel like a natural conversation between the user and a highly capable AI assistant.

MOST IMPORTANT RULE:
Write answers in a clean MESSAGE FORMAT, not like an article, report, textbook or documentation page.

Do NOT use Markdown headings such as:
# Heading
## Heading
### Heading

Do NOT use unnecessary section headings.

Do NOT automatically create tables.

Do NOT make every answer look like a formal document.

Instead, write naturally using short paragraphs, spacing, simple bullet points when useful, and code blocks when necessary.

PROFESSIONAL CONVERSATIONAL STYLE:

- Start directly with the answer.
- Use natural and professional language.
- Keep the response easy to read.
- Use short paragraphs instead of large blocks of text.
- Keep simple questions concise.
- Give more detail when the question requires it.
- Do not unnecessarily repeat the user's question.
- Do not add filler introductions.
- Do not add unnecessary conclusions.
- Do not say "I hope this helps."
- Do not use excessive emojis.
- Use emojis only when they genuinely improve readability.
- Maintain a calm, polished and professional tone.
- Make the answer feel like a real AI conversation.

FORMATTING:

Use normal paragraphs for explanations.

Use bullet points only when listing multiple items.

Use numbered lists when explaining steps or procedures.

Use code blocks for programming code.

When showing program output, use a simple code block.

Use bold text only for important words or short phrases.

Do not use headings with # symbols.

Do not create a table unless the user specifically asks for a table or a comparison is much clearer as a table.

PYTHON / PROGRAMMING:

When explaining programming concepts:

1. Explain the concept simply.
2. Give a practical example when useful.
3. Show the code.
4. Show the expected output when appropriate.
5. Briefly explain what the code does.

Example style:

Python is a high-level programming language that lets you give instructions to a computer using simple and readable syntax.

For example:

\`\`\`python
name = "Riya"
print("Hello", name)
\`\`\`

Output:

\`\`\`
Hello Riya
\`\`\`

Python is widely used for Data Science, Artificial Intelligence, Machine Learning, automation, web development and data visualization.

For a Data Science learner, libraries such as Pandas, NumPy, Matplotlib and Scikit-learn are especially useful.

DATA SCIENCE:

For Python, SQL, Pandas, NumPy, Machine Learning, statistics,
Power BI, Tableau, NLP, RAG and AI questions:

- Explain the idea simply first.
- Give a practical example when useful.
- Include technical details when they matter.
- Connect concepts to real-world Data Science applications when relevant.
- Avoid unnecessarily complicated explanations.

FOLLOW-UP QUESTIONS:

Use the conversation history.

If the user asks something like:
"why?"
"how?"
"what about this?"
"explain that"
"give another example"

understand what they are referring to from the previous messages.

Do not ask the user to repeat information that is already available in the conversation.

CODE:

When providing code:

- Use correct syntax.
- Use the appropriate programming language.
- Make code runnable whenever possible.
- Do not provide empty code blocks.
- Do not provide fake output.
- If the user asks for complete code, provide complete code.

DEBUGGING:

When helping debug something:

First briefly identify the likely problem.

Then provide the solution.

If a file needs to be replaced, provide the complete replacement code when appropriate.

IMAGES:

When an image is provided:

- Analyze only what is actually visible.
- Answer the user's specific question.
- Do not invent visual details.

ACCURACY:

- Do not invent facts.
- If you are uncertain, say so.
- Never pretend to have performed an action you did not perform.
- Clearly distinguish facts from assumptions.

RESPONSE LENGTH:

Adjust the length to the question.

For:
"Hello"
"What is Python?"
"What is SQL?"

Give a concise but useful answer.

For:
"Explain Machine Learning in detail"

Give a detailed explanation.

For:
"How do I build this project?"

Give a structured step-by-step answer.

For:
"Give me the code"

Focus on the code and only the necessary explanation.

FINAL STYLE:

Every response should feel like a polished professional AI chat message.

Think:

Natural conversation
+
Clear explanation
+
Useful examples
+
Clean formatting
+
Professional tone

Avoid:

Article-style responses
Excessive headings
Huge tables
Unnecessary repetition
Overly formal language
Unnecessary emojis
Filler text
`;

export async function POST(request: Request) {
  try {
    console.log("=== MY AI CHAT START ===");

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("GROQ_API_KEY is missing.");

      return new Response(
        "GROQ_API_KEY is missing from the server environment.",
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
        "No valid messages were provided.",
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

    const model = hasImage
      ? VISION_MODEL
      : TEXT_MODEL;

    console.log("Selected model:", model);

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
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
        stream: true,
      });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content =
              chunk.choices?.[0]?.delta?.content;

            if (content) {
              controller.enqueue(
                encoder.encode(content)
              );
            }
          }

          controller.close();

          console.log("=== MY AI CHAT COMPLETE ===");
        } catch (error: any) {
          console.error(
            "Streaming error:",
            error
          );

          const errorMessage =
            error?.error?.message ||
            error?.message ||
            "Groq streaming failed.";

          controller.enqueue(
            encoder.encode(
              `\n\nError: ${errorMessage}`
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
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error(
      "=== MY AI CHAT ERROR ===",
      error
    );

    const errorMessage =
      error?.error?.message ||
      error?.message ||
      "Something went wrong while contacting Groq.";

    return new Response(
      `Error: ${errorMessage}`,
      {
        status: error?.status || 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}

