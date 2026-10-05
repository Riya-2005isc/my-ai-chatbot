import OpenAI from "openai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

const MODEL = "openai/gpt-oss-20b";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50000;

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitText(text: string) {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  return (
    text.slice(0, MAX_TEXT_LENGTH) +
    "\n\n[Document truncated because it is very large.]"
  );
}

async function extractPDF(buffer: Buffer) {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const pages: string[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(pageNumber);

    const content =
      await page.getTextContent();

    const pageText =
      content.items
        .map((item: any) =>
          typeof item?.str === "string"
            ? item.str
            : ""
        )
        .join(" ");

    pages.push(
      `PAGE ${pageNumber}\n${pageText}`
    );
  }

  return {
    text: pages.join("\n\n"),
    pages: pdf.numPages,
  };
}

async function extractDOCX(
  buffer: Buffer
) {
  const result =
    await mammoth.extractRawText({
      buffer,
    });

  return result.value;
}

function extractExcel(
  buffer: Buffer
) {
  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
    });

  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet =
      workbook.Sheets[sheetName];

    const csv =
      XLSX.utils.sheet_to_csv(
        worksheet
      );

    sheets.push(
      `SHEET: ${sheetName}\n${csv}`
    );
  }

  return sheets.join("\n\n");
}

function extractCSV(
  buffer: Buffer
) {
  return buffer.toString("utf-8");
}

function extractTXT(
  buffer: Buffer
) {
  return buffer.toString("utf-8");
}

export async function POST(
  request: Request
) {
  try {
    console.log(
      "=== FILE ANALYSIS START ==="
    );

    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error(
        "GROQ_API_KEY is missing"
      );

      return jsonResponse(
        {
          success: false,
          error:
            "GROQ_API_KEY is missing from the server environment.",
        },
        500
      );
    }

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const question =
      formData
        .get("question")
        ?.toString()
        .trim() ||
      "Analyze this file and explain the most important information.";

    if (!(file instanceof File)) {
      return jsonResponse(
        {
          success: false,
          error:
            "No file was uploaded.",
        },
        400
      );
    }

    console.log(
      "File:",
      file.name
    );

    console.log(
      "Size:",
      file.size
    );

    if (file.size === 0) {
      return jsonResponse(
        {
          success: false,
          error:
            "The uploaded file is empty.",
        },
        400
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "File is too large. Please upload a file smaller than 4 MB.",
        },
        400
      );
    }

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    const fileName =
      file.name.toLowerCase();

    let extractedText = "";
    let fileInformation = "";

    /*
     * PDF
     */

    if (
      fileName.endsWith(".pdf")
    ) {
      console.log(
        "Extracting PDF..."
      );

      const result =
        await extractPDF(
          buffer
        );

      extractedText =
        result.text;

      fileInformation =
        `PDF document with ${result.pages} page(s).`;
    }

    /*
     * DOCX
     */

    else if (
      fileName.endsWith(".docx")
    ) {
      console.log(
        "Extracting DOCX..."
      );

      extractedText =
        await extractDOCX(
          buffer
        );

      fileInformation =
        "Microsoft Word DOCX document.";
    }

    /*
     * Excel
     */

    else if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls")
    ) {
      console.log(
        "Extracting Excel..."
      );

      extractedText =
        extractExcel(buffer);

      fileInformation =
        "Microsoft Excel spreadsheet.";
    }

    /*
     * CSV
     */

    else if (
      fileName.endsWith(".csv")
    ) {
      console.log(
        "Extracting CSV..."
      );

      extractedText =
        extractCSV(buffer);

      fileInformation =
        "CSV dataset.";
    }

    /*
     * TXT
     */

    else if (
      fileName.endsWith(".txt") ||
      file.type === "text/plain"
    ) {
      console.log(
        "Extracting TXT..."
      );

      extractedText =
        extractTXT(buffer);

      fileInformation =
        "Plain text document.";
    }

    /*
     * Unsupported
     */

    else {
      return jsonResponse(
        {
          success: false,
          error:
            "Unsupported file type. Please upload PDF, DOCX, XLSX, XLS, CSV or TXT.",
        },
        400
      );
    }

    extractedText =
      cleanText(
        extractedText
      );

    console.log(
      "Extracted text length:",
      extractedText.length
    );

    if (!extractedText) {
      return jsonResponse(
        {
          success: false,
          error:
            "I could not extract readable text from this file.",
        },
        400
      );
    }

    extractedText =
      limitText(
        extractedText
      );

    /*
     * Groq
     */

    console.log(
      "Sending document to Groq..."
    );

    const client =
      new OpenAI({
        apiKey,
        baseURL:
          "https://api.groq.com/openai/v1",
      });

    const prompt = `
You are My AI, a professional document and data analysis assistant.

The user uploaded this file:

File name:
${file.name}

File type:
${fileInformation}

User request:
${question}

Extracted file content:
-------------------------
${extractedText}
-------------------------

Answer the user's request using the uploaded file.

Important rules:

- Use only information available in the supplied file.
- Do not invent facts.
- If the requested information is not available, clearly say so.
- Answer the user's specific question first.
- Explain information naturally and professionally.
- Do not use unnecessary Markdown headings.
- Prefer normal paragraphs and simple bullet points.
- Use tables only when genuinely useful.
- For datasets, identify useful patterns, trends and important values when relevant.
- For academic documents, explain concepts clearly.
- For business documents, highlight useful insights.
- If the user asks for a summary, provide a concise but useful summary.
`;

    const completion =
      await client.chat.completions.create(
        {
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a careful document analysis assistant. Use only the supplied file content.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
        }
      );

    const answer =
      completion.choices?.[0]
        ?.message?.content;

    if (!answer) {
      return jsonResponse(
        {
          success: false,
          error:
            "Groq returned an empty response.",
        },
        500
      );
    }

    console.log(
      "=== FILE ANALYSIS SUCCESS ==="
    );

    return jsonResponse({
      success: true,
      fileName: file.name,
      fileType: fileInformation,
      answer,
    });
  } catch (error: any) {
    console.error(
      "=== FILE ANALYSIS ERROR ==="
    );

    console.error(error);

    const errorMessage =
      error?.error?.message ||
      error?.message ||
      "File analysis failed.";

    return jsonResponse(
      {
        success: false,
        error:
          `Server error: ${errorMessage}`,
      },
      500
    );
  }
}
