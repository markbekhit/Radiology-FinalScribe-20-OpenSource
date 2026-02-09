import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { transcribeAudio, identifyRegionAndTemplate, mapToStructuredReport, generateImpressions } from "./ai-pipeline";
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

  // Main processing endpoint - SSE streaming pipeline
  app.post("/api/dictations/process", upload.single("audio"), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const audioFile = req.file;
      if (!audioFile) {
        send({ type: "error", message: "No audio file provided" });
        return res.end();
      }

      const preSelectedTemplateId = req.body?.templateId && req.body.templateId !== "auto"
        ? parseInt(req.body.templateId)
        : null;

      // Create dictation record
      const dictation = await storage.createDictation({
        status: "processing",
        templateId: preSelectedTemplateId,
      });

      // PHASE 1: Transcription via Groq Whisper
      send({ type: "phase", phase: "transcribing" });
      const wavBuffer = await convertToWav(audioFile.buffer);
      const transcription = await transcribeAudio(wavBuffer);
      send({ type: "transcription", data: transcription });

      await storage.updateDictation(dictation.id, {
        rawTranscription: transcription,
        status: "transcribed",
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
          transcription,
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

      if (!matchedTemplate && activeTemplates.length > 0) {
        matchedTemplate = activeTemplates[0];
      }

      if (!matchedTemplate) {
        send({ type: "error", message: "No template available. Please create a template in the Admin Center." });
        return res.end();
      }

      send({ type: "template_matched", template: matchedTemplate });
      await storage.updateDictation(dictation.id, { templateId: matchedTemplate.id });

      // PHASE 3: Structured mapping
      send({ type: "phase", phase: "mapping" });
      const mappingPrompt = await storage.getPromptByType("structured_mapping");
      const structuredReport = await mapToStructuredReport(
        transcription,
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

  return httpServer;
}
