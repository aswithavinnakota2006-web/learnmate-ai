const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are LearnMate AI Syllabus & Paper Analyzer, an expert academic assistant. When a user uploads a syllabus or past exam paper, you must:

1. Extract and list all core topics and units found in the document.
2. Identify recurring question patterns and frequently tested areas.
3. Summarize the structure of the exam (marks distribution, question types, units covered).
4. Generate concise model answers for key questions found in the paper.

Format your response in Markdown with these sections:

## Extracted Topics & Units
List all topics and units found, organized by unit/module if possible.

## Exam Pattern Analysis
Describe the question types, marks distribution, and structure observed.

## Recurring Question Patterns
List frequently asked question themes and patterns.

## Key Questions & Model Answers
For important questions found, provide step-by-step model answers. Use:
- Markdown formatting
- Code blocks with language tags for any code
- LaTeX math ($...$ and $$...$$) for formulas
- Mermaid diagrams for complex topics — system architectures, data flows, database schemas, network models, algorithm flows. Use fenced code blocks with the "mermaid" language tag. Choose the most fitting diagram type:
  - Flowcharts for processes and decisions: \`\`\`mermaid\\ngraph TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action 1]\\n  B -->|No| D[Action 2]\\n\`\`\`
  - Sequence diagrams for interactions between components: \`\`\`mermaid\\nsequenceDiagram\\n  Client->>Server: Request\\n  Server->>DB: Query\\n  DB-->>Server: Data\\n  Server-->>Client: Response\\n\`\`\`
  - ER diagrams for database schemas: \`\`\`mermaid\\nerDiagram\\n  CUSTOMER ||--o{ ORDER : places\\n  ORDER ||--|{ LINE_ITEM : contains\\n\`\`\`
- Keep Mermaid syntax valid: use semicolons or newlines between statements, quote labels containing special characters, and avoid unsupported node shapes.

Rules:
- If the uploaded text is unclear or partial, do your best to extract useful information.
- Be thorough and accurate.
- If no meaningful content can be extracted, say so clearly.`;

const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-lite-001",
  "deepseek/deepseek-r1:free",
  "openrouter/auto",
];

async function tryModel(model: string, apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://learnmate.ai",
      "X-Title": "LearnMate AI",
    },
    body: JSON.stringify({ ...body, model }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, fileType, apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required. Add your OpenRouter API key in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: "No file content provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analyze the following uploaded document (${fileName || "unknown file"}, type: ${fileType || "unknown"}):

--- DOCUMENT CONTENT START ---
${fileContent.slice(0, 30000)}
--- DOCUMENT CONTENT END ---

Please extract core topics, summarize recurring question patterns, and generate model answers as specified in your instructions.`;

    const requestBody = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      temperature: 0.5,
      max_tokens: 8192,
    };

    let response: Response | null = null;
    let lastError = "";

    for (const model of FALLBACK_MODELS) {
      response = await tryModel(model, apiKey, requestBody);
      if (response.ok) break;
      const errText = await response.text();
      try {
        const errJson = JSON.parse(errText);
        lastError = errJson.error?.message || `Model ${model} failed (${response.status})`;
      } catch {
        lastError = errText.slice(0, 200) || `Model ${model} failed (${response.status})`;
      }
      response = null;
    }

    if (!response || !response.ok) {
      return new Response(
        JSON.stringify({ error: lastError || "All models failed. Please check your API key." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content returned from AI." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
