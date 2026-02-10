AI-MSK-Scribe is an open-source framework designed for radiologists who want to break free from expensive, rigid dictation software. By combining the raw speed of Groq (Whisper) with the specialized reasoning of GPT-4o, this tool transforms unstructured medical "shorthand" into perfectly formatted MSK reports based on your own expert search patterns.

🚀 Key Features
Zero-Click Intelligence: Automatically detects the modality (MRI/CT) and body region from the context of your speech.

Dynamic VAD Chunking: Uses Voice Activity Detection to recognize natural pauses, sending audio chunks for transcription in near real-time.

Surgical Precision Mapping: Updates your "Standard Normal" templates without rewriting the entire paragraph. It replaces only the pathological findings while preserving your preferred telegram-style wording.

Medical Whisper Priming: Uses custom medical vocabulary prompts (e.g., Annulus fibrosus, Osteochondrose, Meniskus) to ensure technical terms are transcribed correctly by Groq.


Flexible "Other Findings": Automatically captures findings that don't fit into standard anatomical slots (like loose bodies or joint effusion) and places them in a dedicated "Other Findings" section within the description.
+1

No-Code Admin Center: A dedicated dashboard to manage your JSON templates and medical keywords without touching the underlying code.

🛠️ Tech Stack
Backend: Python (FastAPI / Flask)

Frontend: React / Tailwind CSS

Transcription: Groq Cloud API (whisper-large-v3)

Intelligence: OpenAI API (gpt-4o in JSON Mode)

Voice Detection: vad.js for client-side silence detection

📋 MSK Templates & Search Patterns
The system is built to ingest and populate structured MSK templates based on professional search patterns:


Shoulder: Shoulder roof, Rotator cuff, Musculature, Rotator interval/LHBT, and Glenohumeral joint .


Knee: Medial, Lateral, Intercondylar, Patellofemoral, and Popliteal sections .


Elbow: Ulnar, Radial, Anterior, and Posterior compartments .


Wrist: Distal radioulnar joint, TFCC, Radiocarpal/Midcarpal joints, and Carpal tunnel .

📖 Setup & Installation
Clone the Repository:

Bash
git clone https://github.com/your-username/ai-msk-scribe.git
Configure API Keys:
Add your keys to Replit Secrets or a .env file:

GROQ_API_KEY: Get it at Groq Console

OPENAI_API_KEY: Get it at OpenAI Platform

Customize Templates:
Head to the Admin Center in the app to paste your specific JSON templates (samples provided in /templates).

Run the App:

Bash
python main.py
