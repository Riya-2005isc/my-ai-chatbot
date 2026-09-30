```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages." },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];

    const userMessage =
      typeof lastMessage?.content === "string"
        ? lastMessage.content.toLowerCase().trim()
        : "";

    let answer =
      "I'm a simple AI chatbot running without an external API. Try asking me about Python, SQL, Data Science, Power BI, Tableau, or Machine Learning!";

    if (userMessage.includes("hello") || userMessage.includes("hi")) {
      answer =
        "Hello! 👋 I'm your AI chatbot. How can I help you today?";
    } else if (
      userMessage.includes("python") ||
      userMessage.includes("learn python")
    ) {
      answer =
        "Python is a popular programming language used for data analysis, machine learning, automation, web development, and more. For Data Science, start with variables, lists, dictionaries, functions, NumPy, Pandas, and Matplotlib.";
    } else if (userMessage.includes("sql")) {
      answer =
        "SQL is used to work with databases. Important topics include SELECT, WHERE, GROUP BY, ORDER BY, JOINs, subqueries, aggregate functions, and window functions.";
    } else if (
      userMessage.includes("data science") ||
      userMessage.includes("data scientist")
    ) {
      answer =
        "Data Science combines statistics, programming, data analysis, machine learning, and visualization to extract useful insights from data.";
    } else if (userMessage.includes("power bi")) {
      answer =
        "Power BI is a business intelligence tool used to clean data, create data models, write DAX calculations, and build interactive dashboards.";
    } else if (userMessage.includes("tableau")) {
      answer =
        "Tableau is a data visualization and business intelligence platform. You can use it to connect to datasets, create charts, dashboards, filters, and interactive visualizations.";
    } else if (
      userMessage.includes("machine learning") ||
      userMessage.includes("machine-learning")
    ) {
      answer =
        "Machine Learning allows computers to learn patterns from data. Common types include supervised learning, unsupervised learning, and reinforcement learning.";
    } else if (
      userMessage.includes("thank") ||
      userMessage.includes("thanks")
    ) {
      answer = "You're welcome! 😊";
    } else if (userMessage.includes("bye")) {
      answer = "Bye! 👋 Have a great day!";
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Chat error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
```
