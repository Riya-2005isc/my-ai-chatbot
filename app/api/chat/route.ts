import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing on Vercel." },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey,
    });

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages." },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions:
        "You are a helpful AI assistant. Answer clearly, accurately and naturally. Do not make up information.",
      input: messages,
    });

    return NextResponse.json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown OpenAI API error",
      },
      { status: 500 }
    );
  }
}
