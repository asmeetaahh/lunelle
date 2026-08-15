import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.FEATHERLESS_API_KEY,
  baseURL: "https://api.featherless.ai/v1",
});

const SYSTEM_PROMPT = `
You are Lunelle, a gentle, cycle-aware wellness companion.

Your job is to reflect on the user's journal entry.

Be:
- warm
- empathetic
- calm
- supportive
- concise
- natural and human-sounding

Rules:
- Acknowledge the user's feelings first.
- Focus primarily on their journal entry.
- Use cycle, mood, and symptoms only when relevant.
- Never claim a symptom is definitely caused by the menstrual cycle.
- Never diagnose medical conditions.
- Never make pregnancy or medication decisions.
- Never give dangerous medical advice.
- For medical concerns, recommend speaking with a healthcare professional.
- Give exactly TWO short, gentle suggestions.
- Suggestions should be practical, low-risk wellness ideas.

Return your answer in exactly this format:

REFLECTION:
<2-4 sentence empathetic reflection>

SUGGESTION 1:
<short suggestion>

SUGGESTION 2:
<short suggestion>

Do not use markdown.
Do not add anything else.
`;

export async function generateReflection(request) {
  const {
    cycleDay,
    cycleLength,
    phase,
    mood,
    symptoms = [],
    journalEntry,
  } = request;

  const userMessage = `
Here is the relevant context for this user:

Cycle day: ${cycleDay}
Cycle length: ${cycleLength}
Cycle phase: ${phase}
Mood: ${mood}
Symptoms: ${symptoms.join(", ") || "none"}

Journal entry:
"${journalEntry}"

Reflect on this journal entry as Lunelle.
`;

const messages = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
  {
    role: "user",
    content: userMessage,
  },
];

try {
  const completion = await client.chat.completions.create({
  model: process.env.FEATHERLESS_MODEL,
  messages,
  max_tokens: 1200,
  temperature: 0.7,
});

const message = completion.choices?.[0]?.message;

console.log(
  "🤖 Featherless finish reason:",
  completion.choices?.[0]?.finish_reason
);

console.log(
  "🤖 Featherless content length:",
  message?.content?.length ?? 0
);

if (!message?.content?.trim()) {
  console.error("❌ Featherless returned no final content.");
  console.error(
    "Reasoning present:",
    Boolean(message?.reasoning)
  );

  throw new Error("Featherless returned an empty response.");
}

const content = message.content.trim();

const reflectionMatch = content.match(
  /REFLECTION:\s*([\s\S]*?)(?=\nSUGGESTION 1:)/i
);

const suggestion1Match = content.match(
  /SUGGESTION 1:\s*([\s\S]*?)(?=\nSUGGESTION 2:)/i
);

const suggestion2Match = content.match(
  /SUGGESTION 2:\s*([\s\S]*)/i
);

const response = reflectionMatch?.[1]?.trim() || content;

const suggestions = [
  suggestion1Match?.[1]?.trim(),
  suggestion2Match?.[1]?.trim(),
].filter(Boolean);

return {
  response,
  suggestions: suggestions.slice(0, 2),
};

  } catch (error) {
    console.error("AI generation error:", error);
    throw error;
  }
}