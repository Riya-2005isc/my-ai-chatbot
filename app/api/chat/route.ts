import OpenAI from "openai";
import { NextResponse } from "next/server";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured");
}

const client = new OpenAI({
  apiKey,
});

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages" },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions:
        "You are a helpful AI assistant. Answer clearly, accurately and naturally. Explain difficult topics in simple language when appropriate. Do not make up information.",
      input: messages,
    });

    return NextResponse.json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

    return NextResponse.json(
      { error: "Failed to generate response." },
      { status: 500 }
    );
  }
}
