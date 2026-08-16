import OpenAI from "openai";

const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY;
const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL;

export const isAiConfigured = Boolean(FEATHERLESS_API_KEY && FEATHERLESS_MODEL);

if (!isAiConfigured) {
  console.warn(
    "\n⚠️  AI Companion is NOT configured: missing " +
      [
        !FEATHERLESS_API_KEY && "FEATHERLESS_API_KEY",
        !FEATHERLESS_MODEL && "FEATHERLESS_MODEL",
      ]
        .filter(Boolean)
        .join(" and ") +
      " in the server environment.\n" +
      "   The rest of Lunelle (Journal, etc.) will still run normally, but POST /api/ai/chat\n" +
      "   will respond with a friendly 'not available' message until this is fixed.\n" +
      "   See .env.example for the required variables.\n",
  );
}

// Only construct the client when configured — the OpenAI SDK throws at
// construction time if apiKey is missing, which would otherwise crash the
// whole server (Journal, health, etc. included) on startup whenever AI
// hasn't been configured yet. generateReflection() is only ever called by
// the /api/ai/chat route after it has already checked isAiConfigured.
const client = isAiConfigured
  ? new OpenAI({
      apiKey: FEATHERLESS_API_KEY,
      baseURL: "https://api.featherless.ai/v1",
    })
  : null;

const SYSTEM_PROMPT = `
You are Lunelle, a gentle, cycle-aware wellness companion.

Your job is to respond to the user's current message, drawing on their
journal entry as personal context when one is available. If no journal
entry is available, respond directly to their message using the cycle
context instead — never invent or assume a journal entry that wasn't given.

Be:
- warm
- empathetic
- calm
- supportive
- concise
- natural and human-sounding

Language:
- Respond ONLY in clear, natural English.
- This applies no matter what language the journal entry, cycle data, or
  anything else in the context is in.
- Only respond in a different language if the user's current message is
  written in that language AND explicitly asks you to reply in it.

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
Never show the labels REFLECTION, SUGGESTION 1, or SUGGESTION 2 to the user
as visible words inside the reflection or suggestion text itself — they are
section headers only, used to separate your answer into parts.
`;

export async function generateReflection(request) {
  const {
    cycleDay,
    cycleLength,
    phase,
    mood,
    symptoms = [],
    journalEntry,
    userMessage = '',
  } = request;

  const journalSection = journalEntry
    ? `Journal entry:\n"${journalEntry}"\n`
    : `The user hasn't written a journal entry for this conversation yet.\n`;

  const promptMessage = `
Here is the relevant context for this user:

Cycle day: ${cycleDay}
Cycle length: ${cycleLength}
Cycle phase: ${phase}
Mood: ${mood}
Symptoms: ${symptoms.join(", ") || "none"}

${journalSection}
User's current message:
"${userMessage}"

Use the journal entry as personal context when one is present, then respond to the user's current message as Lunelle.
`;

const messages = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
  {
    role: "user",
    content: promptMessage,
  },
];

try {
  const completion = await client.chat.completions.create({
  model: FEATHERLESS_MODEL,
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

// Defensive cleanup: if the model didn't follow the REFLECTION/SUGGESTION
// format exactly (e.g. dropped the "SUGGESTION 1:" marker), the fallback
// below is the full raw content — strip any format labels and trailing
// suggestion sections out of it so they can never leak into the visible,
// user-facing response text.
const response = (reflectionMatch?.[1]?.trim() || content)
  .replace(/\n?SUGGESTION 1:[\s\S]*$/i, "")
  .replace(/\n?SUGGESTION 2:[\s\S]*$/i, "")
  .replace(/^REFLECTION:\s*/i, "")
  .trim();

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