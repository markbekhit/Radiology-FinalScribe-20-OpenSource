import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Copy, Check, ClipboardCheck, Sparkles, RefreshCw, Pause, Play } from "lucide-react";
import type { Template, Dictation } from "@shared/schema";

type PipelinePhase = "idle" | "recording" | "transcribing" | "correcting" | "identifying" | "mapping" | "impressions" | "complete" | "error";

const phaseLabels: Record<PipelinePhase, string> = {
  idle: "Ready",
  recording: "Recording...",
  transcribing: "Finalizing transcription...",
  correcting: "Correcting transcript with GPT...",
  identifying: "Identifying region & template...",
  mapping: "Mapping to structured report...",
  impressions: "Generating impressions...",
  complete: "Report complete",
  error: "Error occurred",
};

const SILENCE_THRESHOLD = 0.015;
const SILENCE_DURATION_MS = 600;
const MIN_CHUNK_DURATION_MS = 800;

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return String(obj.normalText || obj.text || obj.content || obj.value || obj.report || "");
  }
  return String(val ?? "");
}

function buildMergedReport(report: Record<string, string>, impressionsText: string, template: Template | null | undefined) {
  const sections = (template?.sections as Array<{ name: string; key: string }>) || [];
  let text = "";
  for (const section of sections) {
    const raw = report[section.key];
    const val = extractText(raw);
    if (val) {
      text += `${section.name.toUpperCase()}:\n${val}\n\n`;
    }
  }
  if (impressionsText) {
    text += `IMPRESSION:\n${impressionsText}`;
  }
  return text.trimEnd();
}

export default function DictationPage() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rawTranscription, setRawTranscription] = useState("");
  const [correctedTranscription, setCorrectedTranscription] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [structuredReport, setStructuredReport] = useState<Record<string, string>>({});
  const [impressions, setImpressions] = useState("");
  const [fullReportText, setFullReportText] = useState("");
  const [currentDictation, setCurrentDictation] = useState<Dictation | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [matchedTemplate, setMatchedTemplate] = useState<Template | null>(null);
  const [chunksPending, setChunksPending] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceEditTarget, setVoiceEditTarget] = useState<string | null>(null);
  const [voiceEditProcessingTarget, setVoiceEditProcessingTarget] = useState<string | null>(null);
  const [lastEditInstruction, setLastEditInstruction] = useState("");
  const [isRemapping, setIsRemapping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcriptEdited, setTranscriptEdited] = useState(false);
  const [freeformRegion, setFreeformRegion] = useState<string | null>(null);
  const voiceEditRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceEditStreamRef = useRef<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const chunkStartTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);
  const transcriptSegmentsRef = useRef<string[]>([]);
  const isRecordingRef = useRef(false);
  const pendingCountRef = useRef(0);
  const finalStopResolveRef = useRef<(() => void) | null>(null);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const activeTemplates = templates.filter((t) => t.isActive);

  useEffect(() => {
    if (matchedTemplate && (Object.keys(structuredReport).length > 0 || impressions)) {
      const merged = buildMergedReport(structuredReport, impressions, matchedTemplate);
      setFullReportText(merged);
    }
  }, [structuredReport, impressions, matchedTemplate]);

  const sendChunkForTranscription = useCallback(async (audioBlob: Blob, segmentIndex: number) => {
    if (audioBlob.size < 1000) return;

    pendingCountRef.current += 1;
    setChunksPending(pendingCountRef.current);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, `chunk-${segmentIndex}.webm`);

      const res = await fetch("/api/dictations/transcribe-chunk", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Chunk transcription failed:", await res.text());
        return;
      }

      const { text } = await res.json();
      if (text) {
        transcriptSegmentsRef.current[segmentIndex] = text;
        const fullTranscript = transcriptSegmentsRef.current.filter(Boolean).join(" ");
        setLiveTranscript(fullTranscript);
      }
    } catch (err) {
      console.error("Chunk transcription error:", err);
    } finally {
      pendingCountRef.current -= 1;
      setChunksPending(pendingCountRef.current);
    }
  }, []);

  const startNewRecorder = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    const localChunks: Blob[] = [];
    const segmentIndex = transcriptSegmentsRef.current.length;
    transcriptSegmentsRef.current.push("");

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        localChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const segmentBlob = new Blob(localChunks, { type: "audio/webm" });
      sendChunkForTranscription(segmentBlob, segmentIndex);

      if (isRecordingRef.current && streamRef.current) {
        startNewRecorder(streamRef.current);
      } else if (finalStopResolveRef.current) {
        finalStopResolveRef.current();
        finalStopResolveRef.current = null;
      }
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    chunkStartTimeRef.current = Date.now();
  }, [sendChunkForTranscription]);

  const finalizeCurrentChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    const chunkDuration = Date.now() - chunkStartTimeRef.current;
    if (chunkDuration < MIN_CHUNK_DURATION_MS) return;

    recorder.stop();
  }, []);

  const runVAD = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !isRecordingRef.current) return;

    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    setAudioLevel(Math.min(rms * 5, 1));

    const now = Date.now();

    if (rms < SILENCE_THRESHOLD) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = now;
      } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
        if (isSpeakingRef.current) {
          isSpeakingRef.current = false;
          finalizeCurrentChunk();
          silenceStartRef.current = now;
        }
      }
    } else {
      silenceStartRef.current = null;
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
      }
    }

    vadFrameRef.current = requestAnimationFrame(runVAD);
  }, [finalizeCurrentChunk]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      transcriptSegmentsRef.current = [];
      isRecordingRef.current = true;
      isSpeakingRef.current = false;
      silenceStartRef.current = null;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      startNewRecorder(stream);

      setIsRecording(true);
      setIsPaused(false);
      setPhase("recording");
      setLiveTranscript("");
      setRawTranscription("");
      setCorrectedTranscription("");
      setStructuredReport({});
      setImpressions("");
      setFullReportText("");
      setCurrentDictation(null);
      setMatchedTemplate(null);
      setAudioLevel(0);
      setTranscriptEdited(false);

      vadFrameRef.current = requestAnimationFrame(runVAD);
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record dictations.", variant: "destructive" });
    }
  }, [toast, startNewRecorder, runVAD]);

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      isRecordingRef.current = false;

      if (vadFrameRef.current) {
        cancelAnimationFrame(vadFrameRef.current);
        vadFrameRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
        analyserRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && (recorder.state === "recording" || recorder.state === "paused")) {
        if (recorder.state === "paused") {
          recorder.resume();
        }
        finalStopResolveRef.current = () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          setIsRecording(false);
          setIsPaused(false);
          setAudioLevel(0);
          resolve();
        };
        recorder.stop();
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
        setAudioLevel(0);
        resolve();
      }
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
    }
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    setIsPaused(true);
    setAudioLevel(0);
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
    }
    setIsPaused(false);
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    vadFrameRef.current = requestAnimationFrame(runVAD);
  }, [runVAD]);

  useEffect(() => {
    return () => {
      if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (voiceEditStreamRef.current) voiceEditStreamRef.current.getTracks().forEach((t) => t.stop());
      if (voiceEditRecorderRef.current && voiceEditRecorderRef.current.state === "recording") {
        voiceEditRecorderRef.current.stop();
      }
    };
  }, []);

  const processDictation = useMutation({
    mutationFn: async (transcription: string) => {
      setPhase("correcting");

      const formData = new FormData();
      formData.append("transcription", transcription);
      if (selectedTemplateId) {
        formData.append("templateId", selectedTemplateId);
      }

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
              case "corrected_transcription":
                setCorrectedTranscription(event.data);
                break;
              case "template_matched":
                setMatchedTemplate(event.template || null);
                if (!event.template && event.region) {
                  setFreeformRegion(event.region);
                } else {
                  setFreeformRegion(null);
                }
                break;
              case "structured_report":
                setStructuredReport(event.data);
                break;
              case "freeform_report":
                setFullReportText(event.data);
                setImpressions(event.impressions || "");
                setStructuredReport({});
                break;
              case "impressions":
                setImpressions(event.data);
                break;
              case "dictation":
                setCurrentDictation(event.data);
                break;
              case "complete": {
                setPhase("complete");
                break;
              }
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
      setPhase("transcribing");
      await stopRecording();

      const waitForPending = () =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (pendingCountRef.current <= 0) {
              resolve();
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });

      await waitForPending();

      const fullTranscript = transcriptSegmentsRef.current.filter(Boolean).join(" ").trim();
      if (fullTranscript) {
        setRawTranscription(fullTranscript);
        processDictation.mutate(fullTranscript);
      } else {
        setPhase("idle");
        toast({ title: "No speech detected", description: "No transcribable audio was captured.", variant: "destructive" });
      }
    } else {
      startRecording();
    }
  };


  const copyReport = () => {
    navigator.clipboard.writeText(fullReportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Report copied to clipboard" });
  };

  const getTextForTarget = useCallback((target: string): string => {
    if (target === "corrected") return correctedTranscription;
    if (target === "report") return fullReportText;
    return "";
  }, [correctedTranscription, fullReportText]);

  const applyEditResult = useCallback((target: string, text: string) => {
    if (target === "corrected") { setCorrectedTranscription(text); setTranscriptEdited(true); }
    else if (target === "report") setFullReportText(text);
  }, []);

  const startVoiceEdit = useCallback(async (target: string) => {
    const currentText = getTextForTarget(target);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceEditStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (voiceEditStreamRef.current) {
          voiceEditStreamRef.current.getTracks().forEach((t) => t.stop());
          voiceEditStreamRef.current = null;
        }
        setVoiceEditTarget(null);

        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size < 1000) return;

        setVoiceEditProcessingTarget(target);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "voice-edit.webm");
          formData.append("currentTranscript", currentText);

          const res = await fetch("/api/dictations/voice-edit", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Voice edit failed");
          }

          const { transcript, instruction } = await res.json();
          if (instruction) setLastEditInstruction(instruction);
          if (transcript) applyEditResult(target, transcript);
        } catch (err: any) {
          toast({ title: "Voice edit failed", description: err.message, variant: "destructive" });
        } finally {
          setVoiceEditProcessingTarget(null);
        }
      };

      recorder.onerror = () => {
        setVoiceEditTarget(null);
        setVoiceEditProcessingTarget(null);
        if (voiceEditStreamRef.current) {
          voiceEditStreamRef.current.getTracks().forEach((t) => t.stop());
          voiceEditStreamRef.current = null;
        }
        toast({ title: "Recording error", description: "Voice edit recording failed.", variant: "destructive" });
      };

      recorder.start();
      voiceEditRecorderRef.current = recorder;
      setVoiceEditTarget(target);
      setLastEditInstruction("");
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }, [getTextForTarget, applyEditResult, toast]);

  const stopVoiceEdit = useCallback(() => {
    const recorder = voiceEditRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const remapReport = async () => {
    if (!correctedTranscription) return;
    setIsRemapping(true);
    try {
      const body: Record<string, unknown> = { transcription: correctedTranscription };
      if (selectedTemplateId && selectedTemplateId !== "auto") {
        body.preSelectedTemplateId = Number(selectedTemplateId);
      }
      const res = await apiRequest("POST", "/api/dictations/remap", body);
      const result = await res.json();

      if (result.template) {
        setMatchedTemplate(result.template);
        setFreeformRegion(null);
        setStructuredReport(result.structuredReport);
        setImpressions(result.impressions);
        const merged = buildMergedReport(result.structuredReport, result.impressions, result.template);
        setFullReportText(merged);
      } else {
        setMatchedTemplate(null);
        setFreeformRegion(result.region || "Unknown");
        setStructuredReport({});
        setImpressions(result.impressions);
        setFullReportText(result.freeformReport);
      }
      setTranscriptEdited(false);
      toast({ title: "Report regenerated from edited transcript" });
    } catch (err: any) {
      toast({ title: "Re-map failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRemapping(false);
    }
  };

  const resetDictation = () => {
    setPhase("idle");
    setRawTranscription("");
    setCorrectedTranscription("");
    setLiveTranscript("");
    setStructuredReport({});
    setImpressions("");
    setFullReportText("");
    setCurrentDictation(null);
    setMatchedTemplate(null);
    setFreeformRegion(null);
    setLastEditInstruction("");
    setIsPaused(false);
    setTranscriptEdited(false);
  };

  const isProcessing = phase !== "idle" && phase !== "complete" && phase !== "error" && phase !== "recording";
  const showReport = phase === "complete" || fullReportText.length > 0;
  const displayTemplate = matchedTemplate || activeTemplates.find((t) => t.id.toString() === selectedTemplateId);
  const reportTitle = displayTemplate
    ? `${displayTemplate.name} ${displayTemplate.modality} Report`
    : freeformRegion
      ? `${freeformRegion} Report`
      : "Report";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
            disabled={isRecording || isProcessing}
          >
            <SelectTrigger className="w-52" data-testid="select-template">
              <SelectValue placeholder="Auto-detect template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect template</SelectItem>
              {activeTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>{t.name} ({t.modality})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            {isRecording && !isPaused && (
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" style={{ margin: "-4px" }} />
            )}
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              onClick={handleRecordClick}
              disabled={isProcessing}
              className={isPaused ? "bg-yellow-600 text-white border-yellow-700" : ""}
              data-testid="button-record"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4" fill="currentColor" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>

          {isRecording && (
            <Button
              size="icon"
              variant="outline"
              onClick={isPaused ? resumeRecording : pauseRecording}
              data-testid="button-pause"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          )}

          {isRecording && !isPaused && (
            <div className="flex items-center gap-1.5 w-24" data-testid="audio-level-meter">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-75"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono w-6 text-right">
                {isSpeakingRef.current ? "VOX" : "---"}
              </span>
            </div>
          )}
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
          {showReport && (
            <Button variant="destructive" size="sm" onClick={copyReport} data-testid="button-copy-report">
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "Copied" : "Copy Report"}
            </Button>
          )}
          {phase === "complete" && (
            <Button size="sm" className="bg-green-600 text-white border-green-700" onClick={resetDictation} data-testid="button-new-dictation">
              New Dictation
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-3">
          {isProcessing && phase !== "transcribing" && (
            <div className="w-full max-w-sm mx-auto">
              <PipelineProgress phase={phase} />
            </div>
          )}

          {liveTranscript && !correctedTranscription && (
            <Card className="p-3 space-y-2 border-primary/30">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-primary"}`} />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Transcript</h3>
                {chunksPending > 0 && (
                  <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
                )}
              </div>
              <p className="text-sm font-mono leading-relaxed text-foreground/80" data-testid="text-live-transcript">
                {liveTranscript}
              </p>
            </Card>
          )}

          {correctedTranscription && (
            <Card className="p-3 space-y-2 border-primary/30">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium text-primary uppercase tracking-wider">Corrected Transcription</h3>
                </div>
                <div className="flex items-center gap-2">
                  {voiceEditProcessingTarget === "corrected" && (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Applying edit...
                    </Badge>
                  )}
                  {voiceEditTarget === "corrected" && (
                    <Badge variant="secondary" className="bg-red-600 text-white">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" />
                      Listening...
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant={voiceEditTarget === "corrected" ? "destructive" : "outline"}
                    onClick={voiceEditTarget === "corrected" ? stopVoiceEdit : () => startVoiceEdit("corrected")}
                    disabled={voiceEditProcessingTarget !== null || isProcessing || isRemapping}
                    data-testid="button-voice-edit"
                  >
                    {voiceEditTarget === "corrected" ? <Square className="w-4 h-4" fill="currentColor" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  {showReport && transcriptEdited && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={remapReport}
                      disabled={isRemapping || isProcessing}
                      data-testid="button-remap-report"
                    >
                      {isRemapping ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      {isRemapping ? "Re-mapping..." : "Re-map Report"}
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={correctedTranscription}
                onChange={(e) => { setCorrectedTranscription(e.target.value); setTranscriptEdited(true); }}
                className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 font-mono leading-relaxed"
                rows={Math.max(2, correctedTranscription.split("\n").length)}
                data-testid="textarea-corrected-transcription"
              />
              {lastEditInstruction && (
                <p className="text-xs text-muted-foreground italic" data-testid="text-last-edit-instruction">
                  Last edit: "{lastEditInstruction}"
                </p>
              )}
            </Card>
          )}

          {phase === "correcting" && !correctedTranscription && (
            <Card className="p-4 space-y-2 border-primary/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <h3 className="text-sm font-medium text-primary uppercase tracking-wider">Correcting Transcript...</h3>
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          )}

          {showReport && (displayTemplate || freeformRegion) && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">
                    {reportTitle}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {voiceEditProcessingTarget === "report" && (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Applying edit...
                    </Badge>
                  )}
                  {voiceEditTarget === "report" && (
                    <Badge variant="secondary" className="bg-red-600 text-white">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" />
                      Listening...
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant={voiceEditTarget === "report" ? "destructive" : "outline"}
                    onClick={voiceEditTarget === "report" ? stopVoiceEdit : () => startVoiceEdit("report")}
                    disabled={voiceEditProcessingTarget !== null}
                    data-testid="button-voice-edit-report"
                  >
                    {voiceEditTarget === "report" ? <Square className="w-4 h-4" fill="currentColor" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Textarea
                value={fullReportText}
                onChange={(e) => setFullReportText(e.target.value)}
                className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 font-mono leading-relaxed"
                rows={Math.max(5, fullReportText.split("\n").length)}
                data-testid="textarea-full-report"
              />
              {lastEditInstruction && voiceEditProcessingTarget === null && (
                <p className="text-xs text-muted-foreground italic" data-testid="text-last-report-edit">
                  Last edit: "{lastEditInstruction}"
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineProgress({ phase }: { phase: PipelinePhase }) {
  const steps = [
    { key: "correcting", label: "Correct" },
    { key: "identifying", label: "Identify" },
    { key: "mapping", label: "Map" },
    { key: "impressions", label: "Impressions" },
  ];

  const phaseOrder = ["correcting", "identifying", "mapping", "impressions", "complete"];
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
