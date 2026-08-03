const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are LearnMate AI Notes Generator, an expert academic content creator. Generate comprehensive, well-structured study notes for ANY subject the user requests.

You must dynamically adapt your notes to the subject — whether it's Computer Science, Engineering, Medicine, Commerce, Arts, Mathematics, Law, or any custom topic. Never refuse or limit based on the subject name.

Format your response in Markdown with these required sections:

## Subject Overview
A concise introduction to the subject and its scope.

## Key Modules / Units
Break the subject into logical units or modules. Use a numbered list with brief descriptions.

## Core Concepts & Detailed Explanations
For each major concept, provide a detailed explanation. Use:
- **Bold** for key terms
- Bullet lists for enumerations
- Tables where comparing items helps
- Code blocks (with language tag) for any programming or technical content
- LaTeX math ($...$ inline, $...$ display) for formulas and equations
- Mermaid diagrams are REQUIRED for complex topics — system architectures, algorithms, data flows, database schemas, network models, concept trees, hierarchies. Use fenced code blocks with the "mermaid" language tag. Choose the most fitting diagram type:
  - Flowcharts for processes and decisions: \`\`\`mermaid\\ngraph TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action 1]\\n  B -->|No| D[Action 2]\\n\`\`\`
  - Sequence diagrams for interactions between components: \`\`\`mermaid\\nsequenceDiagram\\n  Client->>Server: Request\\n  Server->>DB: Query\\n  DB-->>Server: Data\\n  Server-->>Client: Response\\n\`\`\`
  - ER diagrams for database schemas: \`\`\`mermaid\\nerDiagram\\n  CUSTOMER ||--o{ ORDER : places\\n  ORDER ||--|{ LINE_ITEM : contains\\n\`\`\`
  - Class diagrams for object models: \`\`\`mermaid\\nclassDiagram\\n  Animal <|-- Dog\\n  Animal: +eat()\\n  Dog: +bark()\\n\`\`\`
- Keep Mermaid syntax valid: use semicolons or newlines between statements, quote labels containing special characters, and avoid unsupported node shapes.
- Real-world examples and analogies

## Important Questions & Formulas
List key exam/interview questions and essential formulas or code snippets relevant to the subject.

## Exam / Interview Quick Revision Cheat Sheet
A dense, scannable summary of the most critical points for quick review.

Rules:
- Use proper Markdown throughout.
- For code, use fenced code blocks with language tags.
- For math, use LaTeX syntax.
- For diagrams, use Mermaid syntax in fenced code blocks.
- Be thorough but organized. Use headings and subheadings.
- Adapt depth based on the requested detail level.
- If a language preference is specified, write the notes in that language.`;

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
    const { subject, topic, detail, language, apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required. Add your OpenRouter API key in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subject) {
      return new Response(
        JSON.stringify({ error: "Subject is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Generate comprehensive study notes for: ${subject}${topic ? ` — Topic: ${topic}` : ""}

Detail level: ${detail || "intermediate"}
${language ? `Language: ${language}` : ""}

Please structure the notes with all the sections specified in your instructions. Make the content rich, accurate, and useful for exam preparation or interview readiness.`;

    const requestBody = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      temperature: 0.7,
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
