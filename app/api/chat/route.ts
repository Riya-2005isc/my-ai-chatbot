```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body?.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];

    const userMessage =
      typeof lastMessage?.content === "string"
        ? lastMessage.content.toLowerCase().trim()
        : "";

    let answer = "Hello! 👋 How can I help you?";

    if (userMessage.includes("hello") || userMessage.includes("hi")) {
      answer = "Hello! 👋 I'm your chatbot. How can I help you today?";
    } else if (userMessage.includes("python")) {
      answer =
        "Python is a programming language widely used for Data Science, Machine Learning, automation, and web development.";
    } else if (userMessage.includes("sql")) {
      answer =
        "SQL is used to store, retrieve, filter, and analyze data in relational databases. Important topics include SELECT, WHERE, JOIN, GROUP BY, and ORDER BY.";
    } else if (
      userMessage.includes("data science") ||
      userMessage.includes("data scientist")
    ) {
      answer =
        "Data Science combines programming, statistics, data analysis, visualization, and Machine Learning to extract useful information from data.";
    } else if (userMessage.includes("power bi")) {
      answer =
        "Power BI is a Microsoft business-intelligence tool used to connect, clean, model, visualize, and analyze data.";
    } else if (userMessage.includes("tableau")) {
      answer =
        "Tableau is a data-visualization tool used to create interactive charts, dashboards, and reports.";
    } else if (
      userMessage.includes("machine learning") ||
      userMessage.includes("machine-learning")
    ) {
      answer =
        "Machine Learning allows computers to learn patterns from data. Common types include supervised learning and unsupervised learning.";
    } else if (
      userMessage.includes("thank you") ||
      userMessage.includes("thanks")
    ) {
      answer = "You're welcome! 😊";
    } else if (userMessage.includes("bye")) {
      answer = "Goodbye! 👋";
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Chat route error:", error);

    return NextResponse.json(
      { error: "Unable to process your message." },
      { status: 500 }
    );
  }
}
```
