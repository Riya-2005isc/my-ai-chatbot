import { NextResponse } from "next/server";

type Message = {
  role?: string;
  content?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages: Message[] = body?.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format." },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];

    const userMessage =
      typeof lastMessage?.content === "string"
        ? lastMessage.content.trim().toLowerCase()
        : "";

    if (!userMessage) {
      return NextResponse.json(
        { error: "Message is empty." },
        { status: 400 }
      );
    }

    let answer =
      "I'm your AI chatbot! 🤖 I can currently answer questions about Python, SQL, Data Science, Machine Learning, Power BI, and Tableau.";

    // Greetings
    if (
      userMessage === "hi" ||
      userMessage === "hello" ||
      userMessage === "hey" ||
      userMessage.startsWith("hi ") ||
      userMessage.startsWith("hello ")
    ) {
      answer =
        "Hello! 👋 I'm your AI chatbot. How can I help you today?";
    }

    // Python
    else if (
      userMessage.includes("python") ||
      userMessage.includes("python programming")
    ) {
      answer =
        "Python is a popular programming language used in Data Science, Machine Learning, automation, web development, and many other fields. For Data Science, you can start with variables, data types, lists, dictionaries, functions, NumPy, Pandas, Matplotlib, and Scikit-learn.";
    }

    // SQL
    else if (
      userMessage.includes("sql") ||
      userMessage.includes("database")
    ) {
      answer =
        "SQL is a language used to communicate with relational databases. Important SQL topics include SELECT, WHERE, ORDER BY, GROUP BY, HAVING, JOINs, subqueries, aggregate functions, and window functions.";
    }

    // Data Science
    else if (
      userMessage.includes("data science") ||
      userMessage.includes("data scientist")
    ) {
      answer =
        "Data Science combines statistics, programming, data analysis, machine learning, and visualization to extract useful insights from data. A typical workflow is: collect data → clean data → explore data → engineer features → build models → evaluate results → communicate insights.";
    }

    // Machine Learning
    else if (
      userMessage.includes("machine learning") ||
      userMessage.includes("machine-learning")
    ) {
      answer =
        "Machine Learning allows computers to learn patterns from data. The main categories are supervised learning, unsupervised learning, and reinforcement learning. Common algorithms include Linear Regression, Decision Trees, Random Forest, K-Means, and Neural Networks.";
    }

    // Power BI
    else if (
      userMessage.includes("power bi") ||
      userMessage.includes("powerbi")
    ) {
      answer =
        "Power BI is a business intelligence and data visualization platform. You can use it to connect data, clean it with Power Query, create data models, write DAX calculations, and build interactive dashboards and reports.";
    }

    // Tableau
    else if (userMessage.includes("tableau")) {
      answer =
        "Tableau is a data visualization and business intelligence platform. It allows you to connect to datasets and create interactive charts, dashboards, filters, maps, and reports.";
    }

    // Excel
    else if (
      userMessage.includes("excel") ||
      userMessage.includes("ms excel")
    ) {
      answer =
        "Microsoft Excel is widely used for data analysis. Useful features include formulas, functions, PivotTables, charts, conditional formatting, XLOOKUP, VLOOKUP, Power Query, and data validation.";
    }

    // Resume
    else if (
      userMessage.includes("resume") ||
      userMessage.includes("cv")
    ) {
      answer =
        "For a Data Science or Data Analyst resume, highlight your technical skills, academic projects, internships, measurable project results, and tools such as Python, SQL, Power BI, Tableau, and Excel. Keep the format clean and ATS-friendly.";
    }

    // Internship
    else if (userMessage.includes("internship")) {
      answer =
        "A Data Science or Data Analyst internship can provide practical experience with data cleaning, SQL, Python, visualization, dashboards, statistics, and machine learning. Try to document the projects and tools you use during the internship.";
    }

    // Help
    else if (
      userMessage === "help" ||
      userMessage.includes("what can you do")
    ) {
      answer =
        "I can currently help with Python, SQL, Data Science, Machine Learning, Power BI, Tableau, Excel, resumes, and internships. Ask me a question about any of these topics!";
    }

    // Thanks
    else if (
      userMessage.includes("thank you") ||
      userMessage.includes("thanks")
    ) {
      answer = "You're welcome! 😊";
    }

    // Goodbye
    else if (
      userMessage === "bye" ||
      userMessage.includes("goodbye")
    ) {
      answer = "Goodbye! 👋 Have a great day!";
    }

    return NextResponse.json(
      { answer },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Unable to process your request." },
      { status: 500 }
    );
  }
}
