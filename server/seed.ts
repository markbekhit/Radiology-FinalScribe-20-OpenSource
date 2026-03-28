import { storage } from "./storage";
import type { TemplateSection } from "@shared/schema";

async function createTemplateIfMissing(
  existingNames: Set<string>,
  name: string,
  region: string,
  modality: string,
  sections: TemplateSection[]
) {
  if (!existingNames.has(name)) {
    await storage.createTemplate({ name, region, modality, sections, isActive: true });
    console.log(`  + Created template: ${name}`);
  }
}

export async function seedDatabase() {
  const existingTemplates = await storage.getTemplates();
  const existingNames = new Set(existingTemplates.map((t) => t.name));

  // ── MSK: Original 4 ──────────────────────────────────────────────────────

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

  const lumbarSpineSections: TemplateSection[] = [
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

  await createTemplateIfMissing(existingNames, "Knee MRI", "Knee", "MRI", kneeSections);
  await createTemplateIfMissing(existingNames, "Shoulder MRI", "Shoulder", "MRI", shoulderSections);
  await createTemplateIfMissing(existingNames, "Lumbar Spine MRI", "Lumbar Spine", "MRI", lumbarSpineSections);
  await createTemplateIfMissing(existingNames, "Hip MRI", "Hip", "MRI", hipSections);

  // ── MSK: Ankle ───────────────────────────────────────────────────────────

  const ankleSections: TemplateSection[] = [
    { name: "Joint Effusion", key: "joint_effusion", normalText: "No significant ankle joint or subtalar joint effusion.", order: 0 },
    { name: "Achilles Tendon", key: "achilles_tendon", normalText: "Achilles tendon is intact with normal calibre and signal. No tendinopathy or tear.", order: 1 },
    { name: "Peroneal Tendons", key: "peroneal_tendons", normalText: "Peroneus longus and brevis tendons are intact within the retromalleolar groove without split tear or dislocation.", order: 2 },
    { name: "Tibialis Tendons", key: "tibialis_tendons", normalText: "Tibialis anterior and tibialis posterior tendons are intact without tendinopathy or tear.", order: 3 },
    { name: "Flexor Tendons", key: "flexor_tendons", normalText: "Flexor hallucis longus and flexor digitorum longus tendons are unremarkable.", order: 4 },
    { name: "Lateral Ligaments", key: "lateral_ligaments", normalText: "ATFL, CFL, and PTFL are intact without sprain or tear.", order: 5 },
    { name: "Deltoid Ligament", key: "deltoid_ligament", normalText: "Deltoid ligament complex is intact.", order: 6 },
    { name: "Sinus Tarsi", key: "sinus_tarsi", normalText: "Sinus tarsi is unremarkable without sinus tarsi syndrome.", order: 7 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved at the tibiotalar and subtalar joints.", order: 8 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, bone marrow edema, or osteochondral lesion.", order: 9 },
    { name: "Soft Tissues", key: "soft_tissues", normalText: "No significant soft tissue abnormality.", order: 10 },
  ];

  await createTemplateIfMissing(existingNames, "Ankle MRI", "Ankle", "MRI", ankleSections);

  // ── MSK: Wrist ───────────────────────────────────────────────────────────

  const wristSections: TemplateSection[] = [
    { name: "TFCC", key: "tfcc", normalText: "Triangular fibrocartilage complex (TFCC) is intact without tear or perforation.", order: 0 },
    { name: "Intrinsic Ligaments", key: "intrinsic_ligaments", normalText: "Scapholunate and lunotriquetral ligaments are intact without tear.", order: 1 },
    { name: "Extrinsic Ligaments", key: "extrinsic_ligaments", normalText: "Extrinsic wrist ligaments are unremarkable.", order: 2 },
    { name: "Tendons", key: "tendons", normalText: "Extensor and flexor tendons are intact without tenosynovitis or tear.", order: 3 },
    { name: "Carpal Tunnel", key: "carpal_tunnel", normalText: "Carpal tunnel contents are unremarkable. Median nerve is normal in calibre and signal.", order: 4 },
    { name: "Carpal Alignment", key: "carpal_alignment", normalText: "Normal carpal alignment. No instability pattern.", order: 5 },
    { name: "Joint Effusion", key: "joint_effusion", normalText: "No radiocarpal or intercarpal joint effusion.", order: 6 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved at the radiocarpal and midcarpal joints.", order: 7 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, avascular necrosis, or bone marrow edema. No scaphoid pathology.", order: 8 },
    { name: "Soft Tissues", key: "soft_tissues", normalText: "No ganglion cyst or significant soft tissue abnormality.", order: 9 },
  ];

  await createTemplateIfMissing(existingNames, "Wrist MRI", "Wrist", "MRI", wristSections);

  // ── MSK: Elbow ───────────────────────────────────────────────────────────

  const elbowSections: TemplateSection[] = [
    { name: "Joint Effusion", key: "joint_effusion", normalText: "No significant elbow joint effusion.", order: 0 },
    { name: "Medial Collateral Ligament", key: "mcl", normalText: "Ulnar collateral ligament (UCL) is intact, including the anterior bundle.", order: 1 },
    { name: "Lateral Collateral Ligament Complex", key: "lcl", normalText: "Lateral collateral ligament complex, including the lateral ulnar collateral ligament (LUCL), is intact.", order: 2 },
    { name: "Common Extensor Tendon", key: "common_extensor", normalText: "Common extensor tendon origin is intact at the lateral epicondyle without lateral epicondylosis or tear.", order: 3 },
    { name: "Common Flexor Tendon", key: "common_flexor", normalText: "Common flexor-pronator tendon origin is intact at the medial epicondyle without medial epicondylosis or tear.", order: 4 },
    { name: "Distal Biceps Tendon", key: "distal_biceps", normalText: "Distal biceps tendon is intact at its insertion on the radial tuberosity.", order: 5 },
    { name: "Triceps Tendon", key: "triceps", normalText: "Distal triceps tendon is intact at the olecranon.", order: 6 },
    { name: "Ulnar Nerve", key: "ulnar_nerve", normalText: "Ulnar nerve is normal in calibre and signal within the cubital tunnel.", order: 7 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved at the radiocapitellar and ulnohumeral joints.", order: 8 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, bone marrow edema, or osteochondral lesion.", order: 9 },
  ];

  await createTemplateIfMissing(existingNames, "Elbow MRI", "Elbow", "MRI", elbowSections);

  // ── MSK: Foot ────────────────────────────────────────────────────────────

  const footSections: TemplateSection[] = [
    { name: "Plantar Fascia", key: "plantar_fascia", normalText: "Plantar fascia is normal in thickness and signal at its calcaneal origin and throughout its course.", order: 0 },
    { name: "Achilles Tendon Insertion", key: "achilles_insertion", normalText: "Achilles tendon insertion is intact at the calcaneus. No insertional tendinopathy or Haglund's deformity.", order: 1 },
    { name: "Tendons", key: "tendons", normalText: "Peroneal, tibialis, and toe flexor/extensor tendons are intact.", order: 2 },
    { name: "Intermetatarsal Spaces", key: "intermetatarsal", normalText: "No Morton's neuroma or intermetatarsal bursitis.", order: 3 },
    { name: "Lisfranc Complex", key: "lisfranc", normalText: "Lisfranc ligament complex is intact. No Lisfranc injury.", order: 4 },
    { name: "Articular Cartilage", key: "articular_cartilage", normalText: "Articular cartilage is preserved at the metatarsophalangeal and interphalangeal joints.", order: 5 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "No fracture, stress fracture, bone marrow edema, or avascular necrosis.", order: 6 },
    { name: "Soft Tissues", key: "soft_tissues", normalText: "No plantar fibromatosis. No significant soft tissue abnormality.", order: 7 },
  ];

  await createTemplateIfMissing(existingNames, "Foot MRI", "Foot", "MRI", footSections);

  // ── Spine: Cervical ──────────────────────────────────────────────────────

  const cervicalSpineSections: TemplateSection[] = [
    { name: "Alignment", key: "alignment", normalText: "Normal cervical lordosis. No listhesis or subluxation.", order: 0 },
    { name: "Vertebral Bodies", key: "vertebral_bodies", normalText: "Vertebral body heights and signal are preserved from C1 to C7. No fracture or marrow signal abnormality.", order: 1 },
    { name: "Intervertebral Discs", key: "discs", normalText: "Disc heights are maintained. No significant disc bulge, protrusion, or extrusion at any cervical level.", order: 2 },
    { name: "Spinal Canal & Cord", key: "spinal_canal_cord", normalText: "Spinal canal is patent at all levels. Cervical cord is normal in calibre and signal without myelopathy.", order: 3 },
    { name: "Neural Foramina", key: "neural_foramina", normalText: "Neural foramina are patent bilaterally at all levels without significant foraminal stenosis.", order: 4 },
    { name: "Facet Joints", key: "facet_joints", normalText: "Facet joints are unremarkable without significant uncovertebral or facet arthrosis.", order: 5 },
    { name: "Craniocervical Junction", key: "craniocervical", normalText: "Craniocervical junction is unremarkable. Dens is intact.", order: 6 },
    { name: "Paraspinal Soft Tissues", key: "paraspinal", normalText: "Paraspinal and prevertebral soft tissues are unremarkable.", order: 7 },
  ];

  await createTemplateIfMissing(existingNames, "Cervical Spine MRI", "Cervical Spine", "MRI", cervicalSpineSections);

  // ── Spine: Thoracic ──────────────────────────────────────────────────────

  const thoracicSpineSections: TemplateSection[] = [
    { name: "Alignment", key: "alignment", normalText: "Normal thoracic kyphosis. No scoliosis, listhesis, or vertebral subluxation.", order: 0 },
    { name: "Vertebral Bodies", key: "vertebral_bodies", normalText: "Vertebral body heights and signal are preserved from T1 to T12. No compression fracture or marrow signal abnormality.", order: 1 },
    { name: "Intervertebral Discs", key: "discs", normalText: "Disc heights are maintained. No significant disc pathology at any thoracic level.", order: 2 },
    { name: "Spinal Canal & Cord", key: "spinal_canal_cord", normalText: "Spinal canal is patent. Thoracic cord is normal in calibre and signal without myelopathy or signal change.", order: 3 },
    { name: "Neural Foramina", key: "neural_foramina", normalText: "Neural foramina are patent bilaterally at all levels.", order: 4 },
    { name: "Facet & Costovertebral Joints", key: "facet_joints", normalText: "Facet and costovertebral joints are unremarkable.", order: 5 },
    { name: "Paraspinal Soft Tissues", key: "paraspinal", normalText: "Paraspinal soft tissues are unremarkable. No paravertebral mass.", order: 6 },
  ];

  await createTemplateIfMissing(existingNames, "Thoracic Spine MRI", "Thoracic Spine", "MRI", thoracicSpineSections);

  // ── MSK: Sacroiliac Joints ───────────────────────────────────────────────

  const siJointSections: TemplateSection[] = [
    { name: "Joint Morphology", key: "joint_morphology", normalText: "Bilateral sacroiliac joints are normal in configuration without significant joint space narrowing.", order: 0 },
    { name: "Bone Marrow Oedema (STIR)", key: "bone_marrow_oedema", normalText: "No subchondral bone marrow oedema on STIR sequences bilaterally.", order: 1 },
    { name: "Erosions", key: "erosions", normalText: "No subchondral erosions on either side.", order: 2 },
    { name: "Sclerosis", key: "sclerosis", normalText: "No subchondral sclerosis.", order: 3 },
    { name: "Ankylosis / Fat Deposition", key: "ankylosis_fat", normalText: "No ankylosis. No backfill fat deposition to suggest prior active inflammation.", order: 4 },
    { name: "Surrounding Soft Tissues", key: "soft_tissues", normalText: "No adjacent soft tissue oedema or enthesitis.", order: 5 },
    { name: "Lumbar Spine & Pelvis", key: "lumbar_pelvis", normalText: "Visualised lumbar spine and pelvis are unremarkable.", order: 6 },
  ];

  await createTemplateIfMissing(existingNames, "Sacroiliac Joints MRI", "Sacroiliac Joints", "MRI", siJointSections);

  // ── Neuro: Brain ─────────────────────────────────────────────────────────

  const brainSections: TemplateSection[] = [
    { name: "Brain Parenchyma", key: "brain_parenchyma", normalText: "Normal grey and white matter differentiation. No focal parenchymal lesion, mass, or signal abnormality.", order: 0 },
    { name: "White Matter", key: "white_matter", normalText: "No white matter T2/FLAIR signal abnormality. No demyelinating lesion.", order: 1 },
    { name: "Ventricles & CSF Spaces", key: "ventricles", normalText: "Ventricles and sulci are normal in size and configuration for age. No hydrocephalus.", order: 2 },
    { name: "Basal Ganglia & Thalami", key: "basal_ganglia", normalText: "Basal ganglia and thalami are symmetrical and unremarkable.", order: 3 },
    { name: "Posterior Fossa", key: "posterior_fossa", normalText: "Cerebellum and brainstem are unremarkable. No posterior fossa mass or tonsillar herniation.", order: 4 },
    { name: "Corpus Callosum", key: "corpus_callosum", normalText: "Corpus callosum is intact.", order: 5 },
    { name: "Vascular Structures", key: "vascular", normalText: "No flow void abnormality. No evidence of territorial infarct or haemorrhage.", order: 6 },
    { name: "Extra-axial Spaces", key: "extra_axial", normalText: "No extra-axial collection, subdural, or epidural haematoma.", order: 7 },
    { name: "Paranasal Sinuses & Mastoids", key: "sinuses_mastoids", normalText: "Visualised paranasal sinuses and mastoid air cells are clear.", order: 8 },
  ];

  await createTemplateIfMissing(existingNames, "Brain MRI", "Brain", "MRI", brainSections);

  // ── Abdominal: Abdomen ───────────────────────────────────────────────────

  const abdomenSections: TemplateSection[] = [
    { name: "Liver", key: "liver", normalText: "Liver is normal in size and signal. No focal hepatic lesion.", order: 0 },
    { name: "Biliary System", key: "biliary", normalText: "Gallbladder is unremarkable. No cholelithiasis or cholecystitis. Common bile duct is normal in calibre.", order: 1 },
    { name: "Pancreas", key: "pancreas", normalText: "Pancreas is normal in signal and morphology. No ductal dilatation or peripancreatic fluid.", order: 2 },
    { name: "Spleen", key: "spleen", normalText: "Spleen is normal in size and signal. No focal splenic lesion.", order: 3 },
    { name: "Kidneys & Adrenal Glands", key: "kidneys_adrenals", normalText: "Bilateral kidneys are normal in size and cortical signal. No renal lesion or hydronephrosis. Adrenal glands are unremarkable.", order: 4 },
    { name: "Bowel", key: "bowel", normalText: "Visualised small and large bowel loops are unremarkable. No wall thickening or inflammatory change.", order: 5 },
    { name: "Lymph Nodes", key: "lymph_nodes", normalText: "No pathologically enlarged abdominal or retroperitoneal lymph nodes.", order: 6 },
    { name: "Vessels", key: "vessels", normalText: "Aorta and major vessels are unremarkable. No aneurysm.", order: 7 },
    { name: "Peritoneum & Free Fluid", key: "peritoneum", normalText: "No ascites or free intraperitoneal fluid.", order: 8 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "Visualised osseous structures are unremarkable.", order: 9 },
  ];

  await createTemplateIfMissing(existingNames, "Abdomen MRI", "Abdomen", "MRI", abdomenSections);

  // ── Abdominal: Pelvis ────────────────────────────────────────────────────

  const pelvisSections: TemplateSection[] = [
    { name: "Uterus", key: "uterus", normalText: "Uterus is normal in size, position, and signal. Endometrium and junctional zone are unremarkable. No fibroids or adenomyosis.", order: 0 },
    { name: "Ovaries", key: "ovaries", normalText: "Bilateral ovaries are normal in size without cyst or mass.", order: 1 },
    { name: "Bladder", key: "bladder", normalText: "Bladder is adequately distended with smooth wall and normal signal. No intraluminal lesion.", order: 2 },
    { name: "Rectum & Sigmoid", key: "rectum_sigmoid", normalText: "Rectum and sigmoid are unremarkable. No mural thickening or perirectal fat stranding.", order: 3 },
    { name: "Lymph Nodes", key: "lymph_nodes", normalText: "No pathologically enlarged pelvic or inguinal lymph nodes.", order: 4 },
    { name: "Pelvic Floor & Muscles", key: "pelvic_floor", normalText: "Pelvic floor musculature is intact. No levator ani defect.", order: 5 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "Visualised osseous pelvis is unremarkable. No fracture or marrow signal abnormality.", order: 6 },
    { name: "Free Fluid", key: "free_fluid", normalText: "No free pelvic fluid.", order: 7 },
  ];

  await createTemplateIfMissing(existingNames, "Pelvis MRI", "Pelvis", "MRI", pelvisSections);

  // ── Abdominal: Prostate ──────────────────────────────────────────────────

  const prostateSections: TemplateSection[] = [
    { name: "Prostate Gland", key: "prostate_gland", normalText: "Prostate gland is normal in size and signal. No T2 signal abnormality in the peripheral or transition zone.", order: 0 },
    { name: "Peripheral Zone", key: "peripheral_zone", normalText: "Peripheral zone demonstrates normal high T2 signal bilaterally. No focal lesion.", order: 1 },
    { name: "Transition Zone", key: "transition_zone", normalText: "Transition zone shows benign prostatic hyperplasia pattern without dominant nodule or suspicious area.", order: 2 },
    { name: "Seminal Vesicles", key: "seminal_vesicles", normalText: "Seminal vesicles are symmetric and unremarkable. No signal abnormality.", order: 3 },
    { name: "Neurovascular Bundles", key: "neurovascular_bundles", normalText: "Bilateral neurovascular bundles are preserved.", order: 4 },
    { name: "Extracapsular Extension", key: "extracapsular", normalText: "No extracapsular extension or seminal vesicle invasion.", order: 5 },
    { name: "Lymph Nodes", key: "lymph_nodes", normalText: "No pathologically enlarged pelvic lymph nodes.", order: 6 },
    { name: "Osseous Structures", key: "osseous_structures", normalText: "Visualised osseous structures are unremarkable. No sclerotic or lytic lesion.", order: 7 },
  ];

  await createTemplateIfMissing(existingNames, "Prostate MRI", "Prostate", "MRI", prostateSections);

  // ── Prompts (only seed if none exist) ────────────────────────────────────

  const existingPrompts = await storage.getPrompts();
  if (existingPrompts.length > 0) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding AI prompts...");

  await storage.createPrompt({
    name: "Whisper Transcription Prompt",
    promptType: "whisper_prompt",
    content: `Radiology MSK MRI dictation. Anatomy: ACL, PCL, MCL, LCL, meniscus, menisci, labrum, rotator cuff, supraspinatus, infraspinatus, subscapularis, biceps tendon, patellar tendon, Achilles tendon, plantar fascia, Baker's cyst. Spine: L1-L5, C1-C7, T1-T12, neural foramina, facet joint, thecal sac, cauda equina. Imaging: MRI, T1, T2, STIR, FLAIR, sagittal, axial, coronal. Pathology: bone marrow edema, osteochondral lesion, tendinopathy, tendinosis, bursitis, effusion, synovitis, SLAP tear, FAI, spondylosis, spondylolisthesis, spinal stenosis, myelopathy, disc herniation, disc protrusion, AVN, stress fracture. Grades: partial tear, full thickness tear, complete tear. mm, cm. Commands: period, comma, new line, new paragraph.`,
    description: "Passed to Groq Whisper API as a transcription prompt to improve medical terminology recognition",
    isActive: true,
  });

  await storage.createPrompt({
    name: "Transcript Correction",
    promptType: "transcript_correction",
    content: `You are a medical transcription normalization engine for radiology.

Your task is to convert raw speech-to-text output (from Whisper) into clean,
clinically correct radiology dictation while preserving the speaker's meaning.

You must:
• Fix obvious speech recognition errors using medical and radiology knowledge
• Correct misspelled or phonetically mistaken medical terms
• Restore proper punctuation and formatting
• Apply spoken formatting commands (e.g., "new line", "comma", "colon", "full stop", "period", "next line", "new paragraph")
• Convert spoken numbers into digits when appropriate
• Keep abbreviations standard in radiology (ACL, PCL, MRI, CT, mm, cm, etc.)
• Correct phonetically mistaken medical terms (e.g. "supraspinous" → "supraspinatus", "tendinitis" vs "tendinosis" based on context, "effacement" vs "effusion")
• Remove farewell phrases at the end of the dictation (e.g. "thank you", "thank you very much", "thanks", "goodbye", "that's all") — these are not part of the clinical report

You must NOT:
• Invent findings that were not stated
• Add diagnoses, interpretations, or conclusions
• Change the clinical meaning
• Add structure or rephrase beyond minimal grammatical cleanup

Your goal is to produce the most accurate and clean version of what the radiologist intended to say.

The speaker may speak in English or German.
Use the same language as the input.
Do not translate unless explicitly instructed.

If something is ambiguous, choose the interpretation that best fits radiology context.
If something cannot be confidently corrected, leave it as-is.`,
    description: "GPT-4o cleans up raw Whisper transcripts: fixes medical terms, applies formatting commands, corrects punctuation",
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
