const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are LearnMate AI Roadmap Generator, an expert academic planner. Generate a detailed, personalized study roadmap for ANY subject.

You must return ONLY valid JSON — no markdown, no explanation, no code fences. The JSON must have this exact shape:

{
  "title": "string — the roadmap title",
  "weeks": [
    {
      "week": 1,
      "theme": "string — what this week focuses on",
      "days": [
        {
          "day": "Monday",
          "tasks": [
            {
              "id": "unique-id-string",
              "title": "string — the task title",
              "description": "string — what to study/do",
              "estimated_minutes": 60,
              "resources": ["string — resource suggestion"]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate enough weeks to fill the time until the exam date (or 4-8 weeks if no date).
- Each week has a theme and 5-7 days of tasks.
- Each day has 1-3 tasks.
- Every task needs a unique id (use "w1d1t1" style).
- Tasks should progress from fundamentals to advanced topics.
- Include practice/review days.
- Adapt difficulty based on the user's skill level.
- Return ONLY the JSON, nothing else.`;

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
    const { subject, examDate, skillLevel, hoursPerWeek, apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subject) {
      return new Response(
        JSON.stringify({ error: "Subject is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Generate a study roadmap for:
- Subject: ${subject}
- Exam Target Date: ${examDate || "Not specified — default to 6 weeks"}
- Current Skill Level: ${skillLevel || "beginner"}
- Hours Available Per Week: ${hoursPerWeek || 7}

Return ONLY the JSON as specified in your instructions.`;

    const requestBody = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
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
        JSON.stringify({ error: lastError || "All models failed." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content returned from AI." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip markdown code fences if present
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const roadmap = JSON.parse(content);
      return new Response(
        JSON.stringify({ roadmap }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON. Please try again.", raw: content.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
