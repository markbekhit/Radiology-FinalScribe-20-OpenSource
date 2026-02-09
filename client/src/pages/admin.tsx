import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus, Pencil, Trash2, FileText, Sparkles, GripVertical, X } from "lucide-react";
import type { Template, AiPrompt, TemplateSection } from "@shared/schema";

const sectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  key: z.string().min(1, "Key is required"),
  normalText: z.string(),
  order: z.number(),
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  region: z.string().min(1, "Region is required"),
  modality: z.string().min(1, "Modality is required"),
  isActive: z.boolean().default(true),
  sections: z.array(sectionSchema).min(1, "At least one section is required"),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

const promptFormSchema = z.object({
  name: z.string().min(1, "Prompt name is required"),
  promptType: z.string().min(1, "Prompt type is required"),
  content: z.string().min(1, "Prompt content is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type PromptFormValues = z.infer<typeof promptFormSchema>;

export default function AdminPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">Admin Center</h1>
      </div>

      <Tabs defaultValue="templates" className="flex-1 flex flex-col">
        <div className="px-4 pt-3">
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="prompts" data-testid="tab-prompts">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Prompts
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="templates" className="flex-1 overflow-auto p-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="prompts" className="flex-1 overflow-auto p-4">
          <PromptsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Manage radiology report templates with customizable sections
        </p>
        <Button onClick={openCreate} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No templates yet. Create your first template to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 hover-elevate" data-testid={`card-template-${t.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{t.name}</h3>
                    <Badge variant="secondary">{t.modality}</Badge>
                    <Badge variant="outline">{t.region}</Badge>
                    {!t.isActive && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(t.sections as TemplateSection[]).length} sections: {(t.sections as TemplateSection[]).map((s) => s.name).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-template-${t.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this template?")) deleteMutation.mutate(t.id);
                    }}
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>Configure the template name, region, modality, and report sections.</DialogDescription>
          </DialogHeader>
          <TemplateForm
            template={editingTemplate}
            onClose={closeForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!template;

  const defaultSections: TemplateSection[] = template
    ? (template.sections as TemplateSection[])
    : [{ name: "Findings", key: "findings", normalText: "", order: 0 }];

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      region: template?.region || "",
      modality: template?.modality || "MRI",
      isActive: template?.isActive ?? true,
      sections: defaultSections,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      if (isEdit) {
        return apiRequest("PATCH", `/api/templates/${template.id}`, data);
      }
      return apiRequest("POST", "/api/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: isEdit ? "Template updated" : "Template created" });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sections = form.watch("sections");

  const addSection = () => {
    const current = form.getValues("sections");
    form.setValue("sections", [...current, { name: "", key: "", normalText: "", order: current.length }]);
  };

  const removeSection = (idx: number) => {
    const current = form.getValues("sections");
    form.setValue(
      "sections",
      current.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }))
    );
  };

  const handleSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Name</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Knee MRI" data-testid="input-template-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body Region</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Knee" data-testid="input-template-region" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="modality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modality</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-modality">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="CT">CT</SelectItem>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0 pt-6">
                <FormLabel>Active</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-active" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Sections</h3>
            <Button type="button" variant="outline" size="sm" onClick={addSection} data-testid="button-add-section">
              <Plus className="w-3 h-3 mr-1" />
              Add Section
            </Button>
          </div>

          <div className="space-y-3">
            {sections.map((section, idx) => (
              <Card key={idx} className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Section {idx + 1}</span>
                  </div>
                  {sections.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeSection(idx)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`sections.${idx}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Section name"
                            onChange={(e) => {
                              field.onChange(e);
                              const key = e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                              form.setValue(`sections.${idx}.key`, key);
                            }}
                            data-testid={`input-section-name-${idx}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sections.${idx}.key`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><Input {...field} placeholder="key" className="font-mono text-xs" data-testid={`input-section-key-${idx}`} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`sections.${idx}.normalText`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Standard Normal Text</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Default normal findings text for this section..."
                          className="resize-none text-xs font-mono"
                          rows={2}
                          data-testid={`textarea-normal-text-${idx}`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Card>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-template">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Loader2Icon(props: any) {
  return <Loader2 {...props} />;
}

function PromptsTab() {
  const { toast } = useToast();
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: prompts = [], isLoading } = useQuery<AiPrompt[]>({
    queryKey: ["/api/prompts"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: "Prompt deleted" });
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingPrompt(null);
  };

  const promptTypeLabels: Record<string, string> = {
    region_identification: "Region Identification",
    structured_mapping: "Structured Mapping",
    impressions: "Auto Impressions",
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Manage AI prompts used in the dictation pipeline
        </p>
        <Button onClick={() => { setEditingPrompt(null); setShowForm(true); }} data-testid="button-create-prompt">
          <Plus className="w-4 h-4 mr-2" />
          New Prompt
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : prompts.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No prompts configured. Create prompts for the AI pipeline.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <Card key={p.id} className="p-4 hover-elevate" data-testid={`card-prompt-${p.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{p.name}</h3>
                    <Badge variant="secondary">{promptTypeLabels[p.promptType] || p.promptType}</Badge>
                    {!p.isActive && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{p.content.slice(0, 120)}...</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingPrompt(p); setShowForm(true); }} data-testid={`button-edit-prompt-${p.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this prompt?")) deleteMutation.mutate(p.id);
                    }}
                    data-testid={`button-delete-prompt-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? "Edit Prompt" : "Create Prompt"}</DialogTitle>
            <DialogDescription>Configure the AI prompt used in the dictation pipeline.</DialogDescription>
          </DialogHeader>
          <PromptForm prompt={editingPrompt} onClose={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromptForm({ prompt, onClose }: { prompt: AiPrompt | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!prompt;

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      name: prompt?.name || "",
      promptType: prompt?.promptType || "region_identification",
      content: prompt?.content || "",
      description: prompt?.description || "",
      isActive: prompt?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PromptFormValues) => {
      if (isEdit) {
        return apiRequest("PATCH", `/api/prompts/${prompt.id}`, data);
      }
      return apiRequest("POST", "/api/prompts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({ title: isEdit ? "Prompt updated" : "Prompt created" });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt Name</FormLabel>
              <FormControl><Input {...field} placeholder="e.g. Region Identification Prompt" data-testid="input-prompt-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="promptType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prompt Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-prompt-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="region_identification">Region Identification</SelectItem>
                    <SelectItem value="structured_mapping">Structured Mapping</SelectItem>
                    <SelectItem value="impressions">Auto Impressions</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0 pt-6">
                <FormLabel>Active</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-prompt-active" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl><Input {...field} placeholder="Brief description of what this prompt does" data-testid="input-prompt-description" /></FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt Content</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter the AI prompt content..."
                  className="resize-none font-mono text-xs min-h-[200px]"
                  rows={10}
                  data-testid="textarea-prompt-content"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-prompt">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
