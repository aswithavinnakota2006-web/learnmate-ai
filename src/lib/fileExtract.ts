export type ExtractedFile = {
  name: string;
  type: string;
  content: string;
};

export async function extractFileContent(file: File): Promise<ExtractedFile> {
  const name = file.name;
  const type = file.type;

  if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    const content = await file.text();
    return { name, type: 'text', content };
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return { name, type: 'pdf', content: await extractPdfText(file) };
  }

  if (type.startsWith('image/')) {
    return { name, type: 'image', content: `[Image file: ${name}] — Image OCR is not available in the browser. Please upload a PDF or text file for best results.` };
  }

  // Try reading as text for unknown types
  try {
    const content = await file.text();
    return { name, type: 'text', content };
  } catch {
    return { name, type: 'unknown', content: `[Unable to extract content from ${name}]` };
  }
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => {
          const str = (item as { str?: string }).str;
          return str || '';
        })
        .join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText || `[PDF: ${file.name}] — No extractable text found. The PDF may contain scanned images.`;
  } catch {
    return `[PDF: ${file.name}] — Could not extract text. The PDF may be image-based or corrupted.`;
  }
}
