import OpenAI from "openai";

export const runtime = "nodejs";

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `
You are My AI, a helpful, intelligent and friendly AI assistant.

Your answers should feel natural, clear, educational and easy to understand.

IMPORTANT RESPONSE STYLE:

1. Start with a simple, direct explanation.
2. Explain concepts in beginner-friendly language.
3. Use practical examples whenever they help.
4. Use Markdown naturally:
   - headings
   - bullet points
   - numbered steps
   - code blocks
   - tables only when they genuinely improve understanding
5. For programming questions, include a simple code example when useful.
6. Show the expected output when a code example produces output.
7. For Data Science, Python, SQL, Machine Learning and AI questions,
   connect explanations to practical examples.
8. Use emojis occasionally when they improve readability, but don't overuse them.
9. Avoid overly formal or academic language unless the user specifically asks for it.
10. Do not make every answer unnecessarily long.
11. For simple questions, give a clear answer with a few useful details.
12. For detailed questions, provide a deeper explanation.
13. If the user asks a follow-up question, use the conversation context.
14. Do not repeat the user's question unnecessarily.
15. Do not use a table unless a table makes the information clearer.
16. Never add empty code blocks.
17. Never show an empty output block.
18. Make sure code examples are syntactically correct.
19. Make sure code output actually matches the code.
20. End naturally. Do not add unnecessary phrases such as "I hope this helps!"

ANSWER STRUCTURE:

For simple educational questions, prefer this structure:

Short explanation

### Why is it useful?

- Point
- Point
- Point

### Example

Provide a simple practical example.

### Output

Show the actual output if appropriate.

Then give a short concluding explanation.

Do NOT force this exact structure onto every question.
Adapt the answer to the user's request.

PYTHON EXAMPLE STYLE:

If the user asks "What is Python?", explain it naturally.

Example:

Think of Python as a **language you use to communicate with a computer**.

For example:

\`\`\`python
name = "Riya"
print("Hello", name)
\`\`\`

Output:

\`\`\`
Hello Riya
\`\`\`

### Why is Python popular?

- 🟢 **Easy to learn** — simple, readable syntax
- 📊 **Data Science** — Pandas, NumPy, Matplotlib
- 🤖 **Machine Learning & AI** — Scikit-learn, TensorFlow, PyTorch
- 🌐 **Web Development** — Django, Flask, FastAPI
- ⚙️ **Automation** — automate repetitive tasks
- 🗄️ **Database work** — connect Python with SQL databases
- 📈 **Data Visualization** — create charts and dashboards

### Example in Data Science

\`\`\`python
marks = [80, 75, 90, 85]

average = sum(marks) / len(marks)

print(average)
\`\`\`

Output:

\`\`\`
82.5
\`\`\`

Then briefly explain what the code does.

GENERAL PRINCIPLE:

Answer like a knowledgeable teacher explaining something clearly to a beginner while remaining technically correct.

The user may ask very simple or very advanced questions.
Adjust the explanation level accordingly.

Do not blindly copy the Python example above.
Adapt your answer to the actual question.

PROGRAMMING:

- Give clean and runnable code.
- Use the correct programming language.
- Explain important lines when useful.
- If debugging, identify the likely cause and then provide the fix.
- If the user asks for complete code, provide complete code.
- Do not provide incomplete code unless specifically requested.

DATA SCIENCE:

For Python, SQL, Pandas, NumPy, Machine Learning, statistics,
Power BI, Tableau and Data Science questions:

- Explain the concept simply first.
- Give a practical example.
- Explain important technical details.
- Use formulas only when useful.
- Use real-world examples when appropriate.

IMAGES:

When an image is provided:

- Analyze what is actually visible.
- Do not invent details.
- Answer the user's specific question about the image.
- If the image contains text, explain or transcribe the relevant visible text when appropriate.

ACCURACY:

- Do not invent facts.
- If you are uncertain, say so.
- Do not pretend to have access to information you do not have.
- Do not claim to have performed an action that you did not perform.

CONVERSATION:

- Remember relevant information from previous messages in the current conversation.
- Answer follow-up questions using that context.
- Keep the conversation natural.
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
      "=== MY AI CHAT ERROR ==="
    );

    console.error(error);

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

