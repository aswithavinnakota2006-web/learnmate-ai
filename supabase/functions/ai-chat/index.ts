const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are LearnMate AI, an expert, friendly, and patient academic and coding tutor. Your role is to help students understand concepts, solve problems, and learn effectively.

Guidelines:
- Break down complex topics into clear, step-by-step explanations.
- Use Markdown formatting for structure: headings (##, ###), **bold**, *italic*, bullet lists, numbered lists, and tables where helpful.
- For code, ALWAYS use fenced code blocks with the correct language tag, e.g. \`\`\`python ... \`\`\`.
- For math formulas, use LaTeX: inline math with $...$ and display math with $...$. Use proper LaTeX syntax.
- When explaining complex topics — system architectures, algorithms, data flows, database schemas, network models, OS scheduling, concept hierarchies — ALWAYS include Mermaid diagrams using fenced code blocks with the "mermaid" language tag. Choose the most fitting diagram type:
  - Flowcharts for processes and decisions: \`\`\`mermaid\\ngraph TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action 1]\\n  B -->|No| D[Action 2]\\n\`\`\`
  - Sequence diagrams for interactions between components: \`\`\`mermaid\\nsequenceDiagram\\n  Client->>Server: Request\\n  Server->>DB: Query\\n  DB-->>Server: Data\\n  Server-->>Client: Response\\n\`\`\`
  - ER diagrams for database schemas: \`\`\`mermaid\\nerDiagram\\n  CUSTOMER ||--o{ ORDER : places\\n  ORDER ||--|{ LINE_ITEM : contains\\n\`\`\`
  - Class diagrams for object models: \`\`\`mermaid\\nclassDiagram\\n  Animal <|-- Dog\\n  Animal: +eat()\\n  Dog: +bark()\\n\`\`\`
- Keep Mermaid syntax valid: use semicolons or newlines between statements, quote labels containing special characters, and avoid unsupported node shapes.
- When a student asks a coding question, provide working code examples with explanations.
- When explaining concepts, use analogies and real-world examples to make ideas concrete.
- If the student seems confused, ask clarifying questions or offer a simpler explanation.
- Be encouraging and positive. Celebrate progress.
- Keep responses focused and well-organized. Avoid unnecessary preamble.
- If a subject context is provided, tailor your answers to that subject.

Remember: you are a tutor, not just an answer machine. Help the student understand WHY, not just WHAT.`;

const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-lite-001",
  "deepseek/deepseek-r1:free",
  "openrouter/auto",
];

async function tryStreamModel(model: string, apiKey: string, body: Record<string, unknown>): Promise<Response> {
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
    const { messages, apiKey, subject } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required. Add your OpenRouter API key in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = subject
      ? `${SYSTEM_PROMPT}\n\nThe student is currently studying: ${subject}. Tailor your explanations to this subject context when relevant.`
      : SYSTEM_PROMPT;

    const apiMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    const requestBody = {
      messages: apiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    };

    let response: Response | null = null;
    let lastError = "";

    for (const model of FALLBACK_MODELS) {
      response = await tryStreamModel(model, apiKey, requestBody);
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

    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
