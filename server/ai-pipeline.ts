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

  const prompt = customPrompt || defaultPrompt;

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

Respond in JSON format where each key is the section key and the value is the report text for that section.`;

  const prompt = customPrompt || defaultPrompt;

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
  return JSON.parse(content);
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

  const prompt = customPrompt || defaultPrompt;

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
