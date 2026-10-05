import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    console.log("FILE API START");

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error:
            "GROQ_API_KEY is missing from Vercel.",
        },
        { status: 500 }
      );
    }

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const question =
      formData.get("question")?.toString() ||
      "Analyze this file.";

    if (!(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "No file received.",
        },
        { status: 400 }
      );
    }

    console.log(
      "FILE RECEIVED:",
      file.name,
      file.size
    );

    if (file.size === 0) {
      return Response.json(
        {
          success: false,
          error: "The file is empty.",
        },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return Response.json(
        {
          success: false,
          error:
            "File is larger than 4 MB.",
        },
        { status: 400 }
      );
    }

    const text =
      await file.text();

    console.log(
      "TEXT LENGTH:",
      text.length
    );

    const client =
      new OpenAI({
        apiKey,
        baseURL:
          "https://api.groq.com/openai/v1",
      });

    const completion =
      await client.chat.completions.create(
        {
          model:
            "openai/gpt-oss-20b",

          messages: [
            {
              role: "system",
              content:
                "You are My AI, a professional file analysis assistant.",
            },
            {
              role: "user",
              content: `
The user uploaded a file.

File name:
${file.name}

User question:
${question}

File content:
${text.slice(0, 30000)}

Analyze the file and answer the user's question clearly and professionally.
              `,
            },
          ],

          temperature: 0.2,
        }
      );

    const answer =
      completion.choices?.[0]
        ?.message?.content;

    if (!answer) {
      return Response.json(
        {
          success: false,
          error:
            "Groq returned no answer.",
        },
        { status: 500 }
      );
    }

    console.log(
      "FILE API SUCCESS"
    );

    return Response.json({
      success: true,
      answer,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error(
      "FILE API ERROR:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
