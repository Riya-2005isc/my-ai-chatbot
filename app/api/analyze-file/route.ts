import OpenAI from "openai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

const MODEL = "openai/gpt-oss-20b";
const MAX_TEXT_LENGTH = 50000;

function limitText(text: string) {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  return (
    text.slice(0, MAX_TEXT_LENGTH) +
    "\n\n[Document truncated because it is very large.]"
  );
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPDF(buffer: Buffer) {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const content = await page.getTextContent();

    const pageText = content.items
      .map((item: any) => {
        return typeof item.str === "string" ? item.str : "";
      })
      .join(" ");

    pages.push(
      `===== PAGE ${pageNumber} =====\n${pageText}`
    );
  }

  return {
    text: pages.join("\n\n"),
    pages: pdf.numPages,
  };
}

async function extractDOCX(buffer: Buffer) {
  const result = await mammoth.extractRawText({
    buffer,
  });

  return {
    text: result.value,
  };
}

function extractExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
  });

  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];

    const csv = XLSX.utils.sheet_to_csv(worksheet);

    sheets.push(
      `\n===== SHEET: ${sheetName} =====\n${csv}`
    );
  }

  return sheets.join("\n");
}

function extractCSV(buffer: Buffer) {
  return buffer.toString("utf-8");
}

function extractTXT(buffer: Buffer) {
  return buffer.toString("utf-8");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY is missing.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");

    const userQuestion =
      formData.get("question")?.toString() ||
      "Analyze this file and provide the most important information.";

    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({
          error: "No file was uploaded.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const maxFileSize = 15 * 1024 * 1024;

    if (file.size > maxFileSize) {
      return new Response(
        JSON.stringify({
          error:
            "File is too large. Please upload a file smaller than 15 MB.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const fileName = file.name.toLowerCase();

    let extractedText = "";
    let fileInformation = "";

    if (fileName.endsWith(".pdf")) {
      const result = await extractPDF(buffer);

      extractedText = result.text;

      fileInformation = `PDF document with ${result.pages} page(s).`;
    } else if (fileName.endsWith(".docx")) {
      const result = await extractDOCX(buffer);

      extractedText = result.text;

      fileInformation = "Microsoft Word DOCX document.";
    } else if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls")
    ) {
      extractedText = extractExcel(buffer);

      fileInformation = "Microsoft Excel spreadsheet.";
    } else if (fileName.endsWith(".csv")) {
      extractedText = extractCSV(buffer);

      fileInformation = "CSV dataset.";
    } else if (
      fileName.endsWith(".txt") ||
      file.type === "text/plain"
    ) {
      extractedText = extractTXT(buffer);

      fileInformation = "Plain text document.";
    } else {
      return new Response(
        JSON.stringify({
          error:
            "Unsupported file type. Please upload PDF, DOCX, XLSX, XLS, CSV or TXT.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    extractedText = cleanText(extractedText);

    if (!extractedText) {
      return new Response(
        JSON.stringify({
          error:
            "I could not extract readable text from this file.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    extractedText = limitText(extractedText);

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const prompt = `
You are My AI, an intelligent document and data analysis assistant.

The user uploaded:

File name: ${file.name}
File type: ${fileInformation}

User's request:
${userQuestion}

Extracted file content:
-------------------------
${extractedText}
-------------------------

Instructions:

1. Answer the user's question using the uploaded file.
2. Do not invent information that is not present in the file.
3. If the requested information cannot be found, clearly say that.
4. For datasets, identify useful patterns, columns, values, trends and anomalies when relevant.
5. For academic or business documents, explain important points clearly.
6. If the user asks for a summary, organize it with useful headings and bullet points.
7. If the user asks a specific question, answer that question first.
`;

    const completion =
      await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a careful file-analysis assistant. Use only the supplied file content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

    const answer =
      completion.choices[0]?.message?.content ||
      "I could not generate an answer from this file.";

    return new Response(
      JSON.stringify({
        success: true,
        fileName: file.name,
        fileType: fileInformation,
        answer,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("File analysis error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "File analysis failed.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
