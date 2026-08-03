const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are LearnMate AI PYQ & Exam Prep Engine, an expert academic assistant that generates previous year questions (PYQs) and model papers for ANY subject and exam type.

For any subject and exam type the user provides, generate exactly 10 frequently asked questions that are representative of real previous year questions for that exam. Categorize them by unit and marks.

Format your response in Markdown with these sections:

## Exam Overview
Brief description of the exam type and subject.

## Previous Year Questions (Top 10)

For each question, use this format:

### Q[N]: [Question Title]
**Unit:** [Unit/Module name] | **Marks:** [marks] | **Type:** [MCQ/Short/Long/Problem]

[Question text]

**Solution:**
[Step-by-step solution with explanations. Use code blocks for programming questions, LaTeX ($...$ and $...$) for math, and Mermaid diagrams for complex topics — system architectures, data flows, algorithm flows, database schemas. Use fenced code blocks with the "mermaid" language tag. Choose the most fitting diagram type:
  - Flowcharts: \`\`\`mermaid\\ngraph TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action 1]\\n\`\`\`
  - Sequence diagrams: \`\`\`mermaid\\nsequenceDiagram\\n  Client->>Server: Request\\n  Server-->>Client: Response\\n\`\`\`
  - ER diagrams: \`\`\`mermaid\\nerDiagram\\n  CUSTOMER ||--o{ ORDER : places\\n\`\`\`
Keep Mermaid syntax valid: use semicolons or newlines between statements, quote labels containing special characters, and avoid unsupported node shapes.]

---

## Quick Revision Tips
3-5 bullet points with key tips for this exam.

Rules:
- Generate exactly 10 questions unless told otherwise.
- Distribute questions across different units/topics.
- Include a mix of question types (MCQ, short answer, long answer, problem-solving).
- Provide detailed, step-by-step solutions.
- Use proper Markdown, code blocks, LaTeX, and Mermaid as appropriate.
- If a language preference is specified, write in that language.`;

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
    const { subject, examType, units, language, apiKey } = await req.json();

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

    const userPrompt = `Generate top 10 previous year questions with solutions for:
- Subject: ${subject}
- Exam Type: ${examType || "University Semester Exam"}
${units ? `- Units/Topics to cover: ${units}` : ""}
${language ? `- Language: ${language}` : ""}

Please generate comprehensive PYQs with step-by-step solutions as specified in your instructions.`;

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
