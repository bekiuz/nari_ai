# Nari AI — Futuristic AI Assistant with Cloud Backend & Long-Term Memory

Nari AI is a full-stack, futuristic AI assistant web application featuring a sleek dark glassmorphic interface, powered by Google Gemini API (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, & `gemini-3.1-pro-preview`) with a real cloud database and authentication backend.

## ✨ Upgraded Features

### 1. Cloud Authentication & User Isolation
- **Email & Password Authentication**: Complete registration and login flows with client and server validation.
- **Google Sign-In**: One-click Google authentication alternative.
- **Zero Cross-Contamination**: Each user has their own isolated workspace. Database rules strictly restrict data access so users can only ever read and write their own records.
- **Account Management**: Seamless session persistence, user avatar and details in sidebar, and secure logout.

### 2. Cloud Firestore Database
All data is stored in Google Cloud Firestore (not just local storage):
- `users`: User profile records and account metadata.
- `chats`: Conversation threads, model selections, timestamps, and pin statuses.
- `messages`: Real-time chat messages, multi-modal attachments, and status tracking.
- `memories`: Enduring user facts, coding preferences, and project context.
- `files`: Uploaded source code and document attachments with metadata and previews.
- `images`: Uploaded visual diagrams and images for Gemini vision analysis.
- `user_settings`: Personalized model choice, temperature, custom system prompts, and memory toggles.

### 3. Continuous Long-Term Memory
- **Automatic Fact Detection**: Nari AI analyzes incoming conversations and extracts enduring user facts, tech stack preferences, and personal context.
- **Direct Command Controls**:
  - Say `"remember this: [fact]"` (e.g. `"remember this: I prefer TypeScript with Tailwind v4"`) to manually store an instruction.
  - Say `"forget this: [topic]"` to remove matching memories.
- **Context Injection**: Relevant memories are automatically compiled and injected into Gemini's reasoning prompt before each query.
- **Memory Hub**: A dedicated Memory Management screen in the sidebar to view, search, filter, edit, and delete memories.

### 4. Full Multimodal Vision & Document Intelligence
- Upload screenshots, diagrams, and photos for 8K vision processing.
- Upload code files (`.ts`, `.py`, `.js`, `.json`, `.csv`, `.md`) for review, bug inspection, and refactoring.
- Markdown rendering with syntax-highlighted code blocks and copy buttons.
- Voice dictation and browser text-to-speech vocalization.

### 5. Protected Backend & Security
- **Server-Side API Key Isolation**: `GEMINI_API_KEY` is kept strictly on the Express backend (`server.ts`).
- **Protected Endpoints**: All API requests (`/api/chat`, `/api/memory/extract`) validate authenticated Firebase JWT Bearer tokens before executing inference.
- **ABAC Security Rules**: `firestore.rules` enforces user ownership on all collections.

---

## 🛠️ Environment Variables & Setup

### Environment Variables
Configure these in your environment or the AI Studio Secrets panel:

```bash
# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY="your-gemini-api-key"

# APP_URL: The hosting URL (injected automatically in AI Studio).
APP_URL="http://localhost:3000"
```

### Firebase Configuration
Firebase is provisioned via `firebase-applet-config.json` at the project root:
- `projectId`: Google Cloud Project ID
- `apiKey`: Firebase Web API Key
- `firestoreDatabaseId`: Firestore Database ID
- `authDomain`: Firebase Auth Domain
- `storageBucket`: Cloud Storage Bucket

---

## 🚀 Running the Project

### 1. Development Mode
```bash
npm install
npm run dev
```
Starts the full-stack server (`tsx server.ts`) on `http://localhost:3000` with Express API routes and Vite middleware.

### 2. Production Build
```bash
npm run build
npm start
```
Compiles client assets to `dist/` and runs the production server.
