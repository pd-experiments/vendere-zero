import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export async function parsePDF(): Promise<string> {
  try {
    const loader = new PDFLoader("pdfs/nike.pdf");
    const docs = await loader.load();
    const brandInfo = docs.map((doc) => doc.pageContent).join("\n");
    return brandInfo;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF");
  }
}