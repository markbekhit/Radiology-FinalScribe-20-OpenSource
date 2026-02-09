import { storage } from "./storage";
import type { TemplateSection } from "@shared/schema";

export async function seedDatabase() {
  const existingTemplates = await storage.getTemplates();
  if (existingTemplates.length > 0) return;

  console.log("Seeding database with default templates and prompts...");

  const kneeSections: TemplateSection[] = [
    { name: "Joint Effusion", key: "joint_effusion", normalText: "No joint effusion.", order: 0 },
    { name: "Menisci", key: "menisci", normalText: "Medial and lateral menisci are intact without tear or degeneration.", order: 1 },
    { name: "Cruciate Ligaments", key: "cruciate_ligaments", normalText: "ACL and PCL are intact with normal signal and course.", order: 2 },
    { name: "Collateral Ligaments", key: "collateral_ligaments", normalText: "MCL and LCL are intact.", order: 3 },
    { name: "Extensor Mechanism", key: "extensor_mechanism", normalText: "Quadriceps and patellar tendons are intact. Patella tracks normally.", order: 4 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved throughout all compartments.", order: 5 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, bone marrow edema, or osseous lesion.", order: 6 },
    { name: "Additional Findings", key: "additional_findings", normalText: "No Baker's cyst. No significant soft tissue abnormality.", order: 7 },
  ];

  const shoulderSections: TemplateSection[] = [
    { name: "Rotator Cuff", key: "rotator_cuff", normalText: "Supraspinatus, infraspinatus, subscapularis, and teres minor tendons are intact without tear or tendinopathy.", order: 0 },
    { name: "Biceps Tendon", key: "biceps_tendon", normalText: "Long head of biceps tendon is intact within the bicipital groove.", order: 1 },
    { name: "Labrum", key: "labrum", normalText: "Superior and inferior labrum are intact without tear.", order: 2 },
    { name: "Glenohumeral Joint", key: "glenohumeral_joint", normalText: "No glenohumeral joint effusion. Normal joint space.", order: 3 },
    { name: "Acromioclavicular Joint", key: "ac_joint", normalText: "AC joint is unremarkable without significant arthrosis.", order: 4 },
    { name: "Subacromial Space", key: "subacromial_space", normalText: "No subacromial-subdeltoid bursitis. Adequate subacromial space.", order: 5 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture or bone marrow edema. Type I or II acromion morphology.", order: 6 },
  ];

  const spineSections: TemplateSection[] = [
    { name: "Alignment", key: "alignment", normalText: "Normal lordosis maintained. No listhesis or subluxation.", order: 0 },
    { name: "Vertebral Bodies", key: "vertebral_bodies", normalText: "Vertebral body heights and signal are preserved. No compression fracture.", order: 1 },
    { name: "Intervertebral Discs", key: "discs", normalText: "No significant disc bulge, protrusion, or extrusion at any level.", order: 2 },
    { name: "Spinal Canal", key: "spinal_canal", normalText: "Spinal canal is patent. No central stenosis.", order: 3 },
    { name: "Neural Foramina", key: "neural_foramina", normalText: "Neural foramina are patent bilaterally at all levels.", order: 4 },
    { name: "Facet Joints", key: "facet_joints", normalText: "Facet joints are unremarkable without significant arthrosis.", order: 5 },
    { name: "Paraspinal Soft Tissues", key: "paraspinal", normalText: "Paraspinal soft tissues are unremarkable.", order: 6 },
  ];

  const hipSections: TemplateSection[] = [
    { name: "Joint Effusion", key: "joint_effusion", normalText: "No significant hip joint effusion.", order: 0 },
    { name: "Labrum", key: "labrum", normalText: "Acetabular labrum is intact without tear.", order: 1 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved on femoral head and acetabulum.", order: 2 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, AVN, or bone marrow edema. Normal femoral head sphericity.", order: 3 },
    { name: "Tendons & Muscles", key: "tendons_muscles", normalText: "Gluteal tendons, iliopsoas, and hamstring origins are intact.", order: 4 },
    { name: "Bursae", key: "bursae", normalText: "No trochanteric or iliopsoas bursitis.", order: 5 },
  ];

  await storage.createTemplate({ name: "Knee MRI", region: "Knee", modality: "MRI", sections: kneeSections, isActive: true });
  await storage.createTemplate({ name: "Shoulder MRI", region: "Shoulder", modality: "MRI", sections: shoulderSections, isActive: true });
  await storage.createTemplate({ name: "Lumbar Spine MRI", region: "Lumbar Spine", modality: "MRI", sections: spineSections, isActive: true });
  await storage.createTemplate({ name: "Hip MRI", region: "Hip", modality: "MRI", sections: hipSections, isActive: true });

  await storage.createPrompt({
    name: "Whisper Transcription Prompt",
    promptType: "whisper_prompt",
    content: `This is a structured MSK radiology report. Use medical terminology and standard punctuation. Recognize verbal commands like 'point', 'comma', 'new line', or 'period' as symbols. Terms include: MRI, CT, sagittal, axial, coronal, T1, T2, PD, bone marrow edema, osteochondral, enthesopathy, and anatomical structures like ACL, MCL, LCL, meniscus, or labrum. Maintain a concise, professional tone.`,
    description: "Passed to Groq Whisper API as a transcription prompt to improve medical terminology recognition",
    isActive: true,
  });

  await storage.createPrompt({
    name: "Region Identification",
    promptType: "region_identification",
    content: `You are a radiology AI assistant specializing in MSK (Musculoskeletal) radiology.
Analyze the following radiology dictation transcription and identify:
1. The anatomical region being described
2. The best matching template from the available templates

Consider anatomical landmarks, pathology descriptions, and clinical context to determine the region.

Available templates will be provided as a JSON array with id, name, region, and modality fields.

Respond in JSON format:
{
  "region": "identified anatomical region",
  "templateId": <matching template id or null if no match>,
  "confidence": <0-100 confidence score>
}`,
    description: "Used in Phase 2 to identify the anatomical region and match to the correct template",
    isActive: true,
  });

  await storage.createPrompt({
    name: "Structured Mapping",
    promptType: "structured_mapping",
    content: `You are a radiology AI assistant specializing in MSK radiology reporting.
Map the following radiology dictation into a structured telegram-style report.

Rules:
- Use telegram-style reporting: concise, structured, professional medical language
- If a finding is described as normal for a section, use the provided standard normal text for that section
- If no relevant information is found for a section, use the standard normal text
- Ensure anatomical accuracy and proper medical terminology
- Be concise but thorough — avoid unnecessary filler words
- Maintain clinical relevance in all descriptions
- Do not add sections not in the template
- Preserve the exact section keys in your JSON response

Respond in JSON format where each key is the section key and the value is the report text for that section.`,
    description: "Used in Phase 3 to map transcribed dictation into structured template sections",
    isActive: true,
  });

  await storage.createPrompt({
    name: "Auto Impressions",
    promptType: "impressions",
    content: `You are a radiology AI assistant specializing in MSK radiology.
Generate a concise clinical impression based on the following structured radiology report.

Rules:
- Summarize the key findings in order of clinical significance
- Use numbered list format if multiple impressions exist
- Be concise and clinically relevant
- Use proper medical terminology and standard radiology language
- Focus on actionable findings that affect patient management
- If all findings are normal, state a brief normal summary (e.g., "Unremarkable MRI of the knee")
- Include relevant differentials when appropriate
- Mention any recommended follow-up if indicated`,
    description: "Used to auto-generate clinical impressions from the structured report",
    isActive: true,
  });

  console.log("Database seeded successfully.");
}
