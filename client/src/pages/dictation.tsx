import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Copy, Check, FileText, Activity, ClipboardCheck } from "lucide-react";
import type { Template, Dictation } from "@shared/schema";

type PipelinePhase = "idle" | "recording" | "transcribing" | "identifying" | "mapping" | "impressions" | "complete" | "error";

const phaseLabels: Record<PipelinePhase, string> = {
  idle: "Ready",
  recording: "Recording...",
  transcribing: "Phase 1: Transcribing audio...",
  identifying: "Phase 2: Identifying region & template...",
  mapping: "Phase 3: Mapping to structured report...",
  impressions: "Generating impressions...",
  complete: "Report complete",
  error: "Error occurred",
};

export default function DictationPage() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rawTranscription, setRawTranscription] = useState("");
  const [structuredReport, setStructuredReport] = useState<Record<string, string>>({});
  const [impressions, setImpressions] = useState("");
  const [editableReport, setEditableReport] = useState<Record<string, string>>({});
  const [editableImpressions, setEditableImpressions] = useState("");
  const [currentDictation, setCurrentDictation] = useState<Dictation | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [matchedTemplate, setMatchedTemplate] = useState<Template | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const activeTemplates = templates.filter((t) => t.isActive);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setIsRecording(true);
      setPhase("recording");
      setRawTranscription("");
      setStructuredReport({});
      setImpressions("");
      setEditableReport({});
      setEditableImpressions("");
      setCurrentDictation(null);
      setMatchedTemplate(null);
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record dictations.", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(new Blob());
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const processDictation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      if (selectedTemplateId) {
        formData.append("templateId", selectedTemplateId);
      }

      setPhase("transcribing");

      const res = await fetch("/api/dictations/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "phase":
                setPhase(event.phase as PipelinePhase);
                break;
              case "transcription":
                setRawTranscription(event.data);
                break;
              case "template_matched":
                setMatchedTemplate(event.template);
                break;
              case "structured_report":
                setStructuredReport(event.data);
                setEditableReport(event.data);
                break;
              case "impressions":
                setImpressions(event.data);
                setEditableImpressions(event.data);
                break;
              case "dictation":
                setCurrentDictation(event.data);
                break;
              case "complete":
                setPhase("complete");
                break;
              case "error":
                throw new Error(event.message);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    },
    onError: (err) => {
      setPhase("error");
      toast({ title: "Processing failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRecordClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob.size > 0) {
        processDictation.mutate(blob);
      }
    } else {
      startRecording();
    }
  };

  const handleSectionEdit = (key: string, value: string) => {
    setEditableReport((prev) => ({ ...prev, [key]: value }));
  };

  const copyReport = () => {
    const template = matchedTemplate || activeTemplates.find((t) => t.id.toString() === selectedTemplateId);
    let reportText = "";

    if (template) {
      reportText += `${template.name.toUpperCase()} ${template.modality}\n\n`;
    }

    const sections = template?.sections as Array<{ name: string; key: string }> || [];
    for (const section of sections) {
      const val = editableReport[section.key];
      if (val) {
        reportText += `${section.name.toUpperCase()}:\n${val}\n\n`;
      }
    }

    if (editableImpressions) {
      reportText += `IMPRESSION:\n${editableImpressions}\n`;
    }

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Report copied to clipboard" });
  };

  const resetDictation = () => {
    setPhase("idle");
    setRawTranscription("");
    setStructuredReport({});
    setImpressions("");
    setEditableReport({});
    setEditableImpressions("");
    setCurrentDictation(null);
    setMatchedTemplate(null);
  };

  const isProcessing = phase !== "idle" && phase !== "complete" && phase !== "error" && phase !== "recording";
  const showReport = phase === "complete" || Object.keys(structuredReport).length > 0;
  const displayTemplate = matchedTemplate || activeTemplates.find((t) => t.id.toString() === selectedTemplateId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Dictation</h1>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "idle" && (
            <Badge
              variant={phase === "complete" ? "default" : phase === "error" ? "destructive" : "secondary"}
              className={phase === "recording" ? "bg-red-600 text-white" : ""}
              data-testid="badge-pipeline-phase"
            >
              {phaseLabels[phase]}
            </Badge>
          )}
          {phase === "complete" && (
            <Button variant="outline" size="sm" onClick={resetDictation} data-testid="button-new-dictation">
              New Dictation
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {!showReport && (
            <>
              <div className="flex items-center gap-3">
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  disabled={isRecording || isProcessing}
                >
                  <SelectTrigger className="w-64" data-testid="select-template">
                    <SelectValue placeholder="Auto-detect template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect template</SelectItem>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name} ({t.modality})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templatesLoading && <Skeleton className="w-64 h-9" />}
              </div>

              <div className="flex flex-col items-center justify-center py-12 space-y-8">
                <div className="relative">
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" style={{ margin: "-16px" }} />
                      <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse-ring" style={{ margin: "-32px", animationDelay: "0.5s" }} />
                    </>
                  )}
                  <button
                    onClick={handleRecordClick}
                    disabled={isProcessing}
                    className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isRecording
                        ? "bg-red-600 scale-110"
                        : isProcessing
                          ? "bg-muted cursor-not-allowed"
                          : "bg-primary hover:bg-primary/90 hover:scale-105"
                    }`}
                    data-testid="button-record"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                    ) : isRecording ? (
                      <Square className="w-10 h-10 text-white" fill="white" />
                    ) : (
                      <Mic className="w-10 h-10 text-white" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {isRecording
                    ? "Recording... Tap to stop and process"
                    : isProcessing
                      ? phaseLabels[phase]
                      : "Tap to start recording your radiology dictation"}
                </p>

                {isProcessing && (
                  <div className="w-full max-w-sm">
                    <PipelineProgress phase={phase} />
                  </div>
                )}
              </div>
            </>
          )}

          {rawTranscription && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Raw Transcription</h3>
              </div>
              <p className="text-sm font-mono leading-relaxed" data-testid="text-raw-transcription">{rawTranscription}</p>
            </Card>
          )}

          {showReport && displayTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">
                    {displayTemplate.name} {displayTemplate.modality} Report
                  </h2>
                </div>
                <Button onClick={copyReport} variant="outline" size="sm" data-testid="button-copy-report">
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy Report"}
                </Button>
              </div>

              <div className="space-y-3">
                {(displayTemplate.sections as Array<{ name: string; key: string }>).map((section) => (
                  <Card key={section.key} className="p-4 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section.name}
                    </label>
                    <Textarea
                      value={editableReport[section.key] || ""}
                      onChange={(e) => handleSectionEdit(section.key, e.target.value)}
                      className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 font-mono"
                      rows={Math.max(2, (editableReport[section.key] || "").split("\n").length)}
                      data-testid={`textarea-section-${section.key}`}
                    />
                  </Card>
                ))}
              </div>

              <Card className="p-4 space-y-2 border-primary/30">
                <label className="text-xs font-medium text-primary uppercase tracking-wider">
                  Impression
                </label>
                <Textarea
                  value={editableImpressions}
                  onChange={(e) => setEditableImpressions(e.target.value)}
                  className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 font-mono"
                  rows={Math.max(3, editableImpressions.split("\n").length)}
                  data-testid="textarea-impressions"
                />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineProgress({ phase }: { phase: PipelinePhase }) {
  const steps = [
    { key: "transcribing", label: "Transcribe" },
    { key: "identifying", label: "Identify" },
    { key: "mapping", label: "Map" },
    { key: "impressions", label: "Impressions" },
  ];

  const phaseOrder = ["transcribing", "identifying", "mapping", "impressions", "complete"];
  const currentIdx = phaseOrder.indexOf(phase);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const isActive = step.key === phase;
        const isDone = currentIdx > idx;
        return (
          <div key={step.key} className="flex-1">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${
              isDone ? "bg-success" : isActive ? "bg-primary animate-recording-pulse" : "bg-muted"
            }`} />
            <p className={`text-[10px] mt-1 text-center ${
              isActive ? "text-primary font-medium" : isDone ? "text-success" : "text-muted-foreground"
            }`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
