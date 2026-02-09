import Groq from "groq-sdk";
import OpenAI, { toFile } from "openai";
import { storage } from "./storage";
import type { Template, TemplateSection } from "@shared/schema";

if (!process.env.GROQ_API_KEY) {
  console.warn("GROQ_API_KEY is not set. Transcription will not work.");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. AI processing will not work.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(audioBuffer: Buffer, whisperPrompt?: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured. Please set it in Secrets.");
  }

  const file = await toFile(audioBuffer, "recording.wav", { type: "audio/wav" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    language: "en",
    response_format: "text",
    ...(whisperPrompt ? { prompt: whisperPrompt } : {}),
  });
  return transcription as unknown as string;
}

export async function correctTranscript(
  rawTranscription: string,
  customPrompt?: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured. Please set it in Secrets.");
  }

  const defaultPrompt = `You are a medical transcription normalization engine for radiology.
Your task is to convert raw speech-to-text output into clean, clinically correct radiology dictation while preserving the speaker's meaning.`;

  const prompt = customPrompt || defaultPrompt;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: rawTranscription },
    ],
    max_completion_tokens: 4000,
  });

  return response.choices[0]?.message?.content || rawTranscription;
}

export async function applyVoiceEdit(
  currentTranscript: string,
  editInstruction: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured. Please set it in Secrets.");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a precise text editor for radiology transcripts.
You will receive the current transcript and a voice instruction describing what to change.
Apply ONLY the requested change. Do not modify anything else.
Return the full updated transcript with the edit applied.
Preserve all formatting, punctuation, and structure.
If the instruction is unclear, make your best interpretation in a radiology context.`,
      },
      {
        role: "user",
        content: `Current transcript:\n${currentTranscript}\n\nEdit instruction:\n${editInstruction}`,
      },
    ],
    max_completion_tokens: 4000,
  });

  return response.choices[0]?.message?.content || currentTranscript;
}

export async function identifyRegionAndTemplate(
  transcription: string,
  templates: Template[],
  customPrompt?: string
): Promise<{ region: string; templateId: number | null; confidence: number }> {
  const templateList = templates.map((t) => ({
    id: t.id,
    name: t.name,
    region: t.region,
    modality: t.modality,
  }));

  const defaultPrompt = `You are a radiology AI assistant specializing in MSK (Musculoskeletal) radiology. 
Analyze the following radiology dictation transcription and identify:
1. The anatomical region being described
2. The best matching template from the available templates

Available templates:
${JSON.stringify(templateList, null, 2)}

Respond in JSON format:
{
  "region": "identified anatomical region",
  "templateId": <matching template id or null if no match>,
  "confidence": <0-100 confidence score>
}`;

  const prompt = customPrompt
    ? `${customPrompt}\n\nAvailable templates:\n${JSON.stringify(templateList, null, 2)}`
    : defaultPrompt;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Transcription: "${transcription}"` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const result = JSON.parse(content);

  return {
    region: result.region || "Unknown",
    templateId: result.templateId || null,
    confidence: result.confidence || 0,
  };
}

export async function mapToStructuredReport(
  transcription: string,
  template: Template,
  customPrompt?: string
): Promise<Record<string, string>> {
  const sections = template.sections as TemplateSection[];

  const sectionDescriptions = sections.map((s) => ({
    key: s.key,
    name: s.name,
    normalText: s.normalText || "(no default normal text)",
  }));

  const defaultPrompt = `You are a radiology AI assistant specializing in MSK radiology reporting.
Map the following radiology dictation into a structured telegram-style report.

Template: ${template.name} (${template.modality})
Sections to fill:
${JSON.stringify(sectionDescriptions, null, 2)}

Rules:
- Use telegram-style reporting: concise, structured, professional medical language
- If a finding is described as normal, use the provided standard normal text for that section
- If no relevant information is found for a section, use the standard normal text
- Ensure anatomical accuracy and proper medical terminology
- Be concise but thorough
- Do not add sections not in the template

Respond in JSON format where each key is the section key and the value is a plain text string for that section.
IMPORTANT: Each value MUST be a plain string, NOT a nested object. Example: {"findings": "Normal alignment."} NOT {"findings": {"name": "Findings", "normalText": "Normal alignment."}}`;

  const templateContext = `\n\nTemplate: ${template.name} (${template.modality})\nSections to fill:\n${JSON.stringify(sectionDescriptions, null, 2)}`;
  const prompt = customPrompt
    ? `${customPrompt}${templateContext}`
    : defaultPrompt;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Transcription: "${transcription}"` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      result[key] = value;
    } else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      result[key] = String(obj.normalText || obj.text || obj.content || obj.value || obj.report || "");
    } else {
      result[key] = String(value ?? "");
    }
  }
  return result;
}

export async function generateFreeformReport(
  transcription: string,
  region: string,
  customPrompt?: string
): Promise<{ reportText: string; impressions: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured. Please set it in Secrets.");
  }

  const defaultPrompt = `You are a radiology AI assistant specializing in MSK (Musculoskeletal) radiology reporting.
No structured template is available for the identified region: "${region}".
Generate a complete, professional radiology report from scratch based on the dictation transcript.

Rules:
- Use telegram-style reporting: concise, structured, professional medical language
- Create appropriate section headings for this body part/region
- Use proper medical terminology and anatomical accuracy
- Be concise but thorough
- Format the report with section headings in UPPERCASE followed by a colon and the content
- At the end, include an IMPRESSION section summarizing key findings

Respond in JSON format:
{
  "sections": { "SECTION_NAME": "section content", ... },
  "impressions": "concise clinical impression"
}`;

  const prompt = customPrompt || defaultPrompt;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Transcription: "${transcription}"\nIdentified Region: "${region}"` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  const sections = parsed.sections || {};
  let reportText = "";
  for (const [heading, text] of Object.entries(sections)) {
    const val = typeof text === "string" ? text : String(text ?? "");
    reportText += `${heading.toUpperCase()}:\n${val}\n\n`;
  }

  const impressions = parsed.impressions || "Unable to generate impressions.";
  reportText += `IMPRESSION:\n${impressions}`;

  return { reportText: reportText.trimEnd(), impressions };
}

export async function generateImpressions(
  structuredReport: Record<string, string>,
  template: Template,
  customPrompt?: string
): Promise<string> {
  const defaultPrompt = `You are a radiology AI assistant specializing in MSK radiology.
Generate a concise clinical impression based on the following structured radiology report.

Template: ${template.name} (${template.modality})

Rules:
- Summarize the key findings in order of clinical significance
- Use numbered list format if multiple impressions
- Be concise and clinically relevant
- Use proper medical terminology
- Focus on actionable findings
- If all findings are normal, state that clearly`;

  const prompt = customPrompt
    ? `${customPrompt}\n\nTemplate: ${template.name} (${template.modality})`
    : defaultPrompt;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Structured Report:\n${JSON.stringify(structuredReport, null, 2)}` },
    ],
    max_completion_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "Unable to generate impressions.";
}
