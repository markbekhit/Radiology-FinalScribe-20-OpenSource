import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import { seedDatabase } from "./seed";
import multer from "multer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { transcribeAudio, transcribeAudioRaw, correctTranscript, applyVoiceEdit, identifyRegionAndTemplate, mapToStructuredReport, generateImpressions, generateFreeformReport } from "./ai-pipeline";
import { insertTemplateSchema, insertAiPromptSchema } from "@shared/schema";
import type { TemplateSection } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function convertToWav(inputBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, inputBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath, "-vn", "-f", "wav", "-ar", "16000", "-ac", "1",
        "-acodec", "pcm_s16le", "-y", outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Templates CRUD
  app.get("/api/templates", async (_req, res) => {
    try {
      const list = await storage.getTemplates();
      res.json(list);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(parseInt(req.params.id));
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const parsed = insertTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid template data", details: parsed.error.flatten() });
      }
      const template = await storage.createTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", async (req, res) => {
    try {
      const partial = insertTemplateSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ error: "Invalid template data", details: partial.error.flatten() });
      }
      const updated = await storage.updateTemplate(parseInt(req.params.id), partial.data);
      if (!updated) return res.status(404).json({ error: "Template not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      await storage.deleteTemplate(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Admin: recreate all tables with correct schema, then reseed
  app.post("/api/admin/reset-templates", async (_req, res) => {
    try {
      await pool.query(`
        DROP TABLE IF EXISTS dictations CASCADE;
        DROP TABLE IF EXISTS templates CASCADE;
        CREATE TABLE templates (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          region TEXT NOT NULL,
          modality TEXT NOT NULL DEFAULT 'MRI',
          sections JSONB NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ai_prompts (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          prompt_type TEXT NOT NULL,
          content TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dictations (
          id SERIAL PRIMARY KEY,
          template_id INTEGER REFERENCES templates(id),
          raw_transcription TEXT,
          corrected_transcription TEXT,
          identified_region TEXT,
          structured_report JSONB,
          impressions TEXT,
          status TEXT NOT NULL DEFAULT 'recording',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      await seedDatabase();
      res.json({ ok: true });
    } catch (err: any) {
      console.error("reset-templates error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // AI Prompts CRUD
  app.get("/api/prompts", async (_req, res) => {
    try {
      const list = await storage.getPrompts();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompts" });
    }
  });

  app.post("/api/prompts", async (req, res) => {
    try {
      const parsed = insertAiPromptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prompt data", details: parsed.error.flatten() });
      }
      const prompt = await storage.createPrompt(parsed.data);
      res.status(201).json(prompt);
    } catch (error) {
      console.error("Error creating prompt:", error);
      res.status(500).json({ error: "Failed to create prompt" });
    }
  });

  app.patch("/api/prompts/:id", async (req, res) => {
    try {
      const partial = insertAiPromptSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ error: "Invalid prompt data", details: partial.error.flatten() });
      }
      const updated = await storage.updatePrompt(parseInt(req.params.id), partial.data);
      if (!updated) return res.status(404).json({ error: "Prompt not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update prompt" });
    }
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    try {
      await storage.deletePrompt(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete prompt" });
    }
  });

  // Dictations
  app.get("/api/dictations", async (_req, res) => {
    try {
      const list = await storage.getDictations();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dictations" });
    }
  });

  // Chunked transcription endpoint - transcribe a single audio segment
  app.post("/api/dictations/transcribe-chunk", upload.single("audio"), async (req, res) => {
    try {
      const audioFile = req.file;
      if (!audioFile) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (audioFile.size < 1000) {
        return res.json({ text: "" });
      }

      const whisperPromptRecord = await storage.getPromptByType("whisper_prompt");
      const whisperPrompt = whisperPromptRecord?.isActive ? whisperPromptRecord.content : undefined;

      let text: string;
      try {
        const wavBuffer = await convertToWav(audioFile.buffer);
        text = await transcribeAudio(wavBuffer, whisperPrompt);
      } catch {
        text = await transcribeAudioRaw(audioFile.buffer, audioFile.mimetype || "audio/webm", whisperPrompt);
      }
      res.json({ text: text.trim() });
    } catch (error: any) {
      console.error("Chunk transcription error:", error);
      res.status(500).json({ error: error.message || "Transcription failed" });
    }
  });

  // Voice edit endpoint - transcribes voice instruction and applies edit to transcript
  app.post("/api/dictations/voice-edit", upload.single("audio"), async (req, res) => {
    try {
      const audioFile = req.file;
      const currentTranscript = req.body?.currentTranscript;

      if (!audioFile) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      if (!currentTranscript) {
        return res.status(400).json({ error: "No current transcript provided" });
      }

      const whisperPromptRecord = await storage.getPromptByType("whisper_prompt");
      const whisperPrompt = whisperPromptRecord?.isActive ? whisperPromptRecord.content : undefined;

      const wavBuffer = await convertToWav(audioFile.buffer);
      const instruction = await transcribeAudio(wavBuffer, whisperPrompt);

      if (!instruction.trim()) {
        return res.json({ transcript: currentTranscript, instruction: "" });
      }

      const editedTranscript = await applyVoiceEdit(currentTranscript, instruction.trim());

      res.json({
        transcript: editedTranscript,
        instruction: instruction.trim(),
      });
    } catch (error: any) {
      console.error("Voice edit error:", error);
      res.status(500).json({ error: error.message || "Voice edit failed" });
    }
  });

  // Main processing endpoint - SSE streaming pipeline
  // Accepts either audio file (legacy) or pre-transcribed text from chunked recording
  app.post("/api/dictations/process", upload.single("audio"), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const preTranscribedText = req.body?.transcription;
      const audioFile = req.file;

      if (!preTranscribedText && !audioFile) {
        send({ type: "error", message: "No audio file or transcription provided" });
        return res.end();
      }

      const preSelectedTemplateId = req.body?.templateId && req.body.templateId !== "auto"
        ? parseInt(req.body.templateId)
        : null;

      const dictation = await storage.createDictation({
        status: "processing",
        templateId: preSelectedTemplateId,
      });

      let transcription: string;

      if (preTranscribedText) {
        transcription = preTranscribedText;
        send({ type: "transcription", data: transcription });
      } else {
        send({ type: "phase", phase: "transcribing" });
        const whisperPromptRecord = await storage.getPromptByType("whisper_prompt");
        const whisperPrompt = whisperPromptRecord?.isActive ? whisperPromptRecord.content : undefined;
        const wavBuffer = await convertToWav(audioFile!.buffer);
        transcription = await transcribeAudio(wavBuffer, whisperPrompt);
        send({ type: "transcription", data: transcription });
      }

      await storage.updateDictation(dictation.id, {
        rawTranscription: transcription,
        status: "transcribed",
      });

      // PHASE 1.5: GPT transcript correction
      send({ type: "phase", phase: "correcting" });
      const correctionPrompt = await storage.getPromptByType("transcript_correction");
      const correctedTranscription = correctionPrompt?.isActive
        ? await correctTranscript(transcription, correctionPrompt.content)
        : transcription;
      send({ type: "corrected_transcription", data: correctedTranscription });

      await storage.updateDictation(dictation.id, {
        correctedTranscription: correctedTranscription,
      });

      // PHASE 2: Region identification and template matching
      send({ type: "phase", phase: "identifying" });
      const allTemplates = await storage.getTemplates();
      const activeTemplates = allTemplates.filter((t) => t.isActive);

      let matchedTemplate;
      if (preSelectedTemplateId) {
        matchedTemplate = await storage.getTemplate(preSelectedTemplateId);
      } else {
        const regionPrompt = await storage.getPromptByType("region_identification");
        const identification = await identifyRegionAndTemplate(
          correctedTranscription,
          activeTemplates,
          regionPrompt?.content
        );

        send({ type: "region_identified", data: identification });

        await storage.updateDictation(dictation.id, {
          identifiedRegion: identification.region,
        });

        if (identification.templateId) {
          matchedTemplate = await storage.getTemplate(identification.templateId);
        }
      }

      if (matchedTemplate) {
        send({ type: "template_matched", template: matchedTemplate });
        await storage.updateDictation(dictation.id, { templateId: matchedTemplate.id });

        // PHASE 3: Structured mapping
        send({ type: "phase", phase: "mapping" });
        const mappingPrompt = await storage.getPromptByType("structured_mapping");
        const structuredReport = await mapToStructuredReport(
          correctedTranscription,
          matchedTemplate,
          mappingPrompt?.content
        );
        send({ type: "structured_report", data: structuredReport });

        await storage.updateDictation(dictation.id, {
          structuredReport,
          status: "mapped",
        });

        // PHASE 4: Auto impressions
        send({ type: "phase", phase: "impressions" });
        const impressionsPrompt = await storage.getPromptByType("impressions");
        const impressionsText = await generateImpressions(
          structuredReport,
          matchedTemplate,
          impressionsPrompt?.content
        );
        send({ type: "impressions", data: impressionsText });

        await storage.updateDictation(dictation.id, {
          impressions: impressionsText,
          status: "complete",
        });
      } else {
        // No matching template — generate freeform report from scratch
        const identifiedRegion = (await storage.getDictation(dictation.id))?.identifiedRegion || "Unknown";
        send({ type: "template_matched", template: null, region: identifiedRegion });

        send({ type: "phase", phase: "mapping" });
        const freeform = await generateFreeformReport(correctedTranscription, identifiedRegion);

        send({ type: "freeform_report", data: freeform.reportText, impressions: freeform.impressions });

        await storage.updateDictation(dictation.id, {
          impressions: freeform.impressions,
          status: "complete",
        });
      }

      const finalDictation = await storage.getDictation(dictation.id);
      send({ type: "dictation", data: finalDictation });
      send({ type: "complete" });
      res.end();
    } catch (error: any) {
      console.error("Pipeline error:", error);
      send({ type: "error", message: error.message || "Processing failed" });
      res.end();
    }
  });

  app.post("/api/dictations/remap", async (req, res) => {
    try {
      const { transcription, preSelectedTemplateId } = req.body;
      if (!transcription) {
        return res.status(400).json({ error: "transcription is required" });
      }

      const allTemplates = await storage.getTemplates();
      const activeTemplates = allTemplates.filter((t) => t.isActive);

      let matchedTemplate;
      let identifiedRegion = "Unknown";

      if (preSelectedTemplateId) {
        matchedTemplate = await storage.getTemplate(preSelectedTemplateId);
      } else {
        const regionPrompt = await storage.getPromptByType("region_identification");
        const identification = await identifyRegionAndTemplate(
          transcription,
          activeTemplates,
          regionPrompt?.content
        );
        identifiedRegion = identification.region || "Unknown";
        if (identification.templateId) {
          matchedTemplate = await storage.getTemplate(identification.templateId);
        }
      }

      if (matchedTemplate) {
        const mappingPrompt = await storage.getPromptByType("structured_mapping");
        const structuredReport = await mapToStructuredReport(
          transcription,
          matchedTemplate,
          mappingPrompt?.content
        );

        const impressionsPrompt = await storage.getPromptByType("impressions");
        const impressionsText = await generateImpressions(
          structuredReport,
          matchedTemplate,
          impressionsPrompt?.content
        );

        res.json({ template: matchedTemplate, structuredReport, impressions: impressionsText });
      } else {
        const freeform = await generateFreeformReport(transcription, identifiedRegion);
        res.json({ template: null, region: identifiedRegion, freeformReport: freeform.reportText, impressions: freeform.impressions });
      }
    } catch (error: any) {
      console.error("Remap error:", error);
      res.status(500).json({ error: error.message || "Remap failed" });
    }
  });

  return httpServer;
}
