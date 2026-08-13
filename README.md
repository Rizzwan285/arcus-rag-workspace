# Arcus 🎓 - Your AI-Powered Academic Workspace

Welcome to **Arcus**! Arcus is an intelligent study platform designed to help students learn better and faster. Instead of just reading a textbook, you can upload it to Arcus and have a conversation with it. It uses AI to read your documents, answer your questions, and automatically create study materials for you.

🔗 **[Live Demo: Play with Arcus Here!](https://arcus-rag-workspace.vercel.app)** *(Note: If you used a different URL in Vercel, update this link!)*

---

## 🌟 Features

- **Upload & Read PDFs**: Securely upload your textbooks, lecture slides, or notes.
- **Chat with your Books (RAG)**: Ask questions about your documents and get instant, accurate answers powered by Google's Gemini AI. 
- **Auto-Generate Flashcards**: Arcus automatically reads your document and generates interactive 3D flashcards to help you memorize key terms.
- **Take Interactive Quizzes**: Test your knowledge with AI-generated multiple-choice quizzes complete with scoring and explanations.
- **Smart Study Calendar**: Ask the AI to build a study schedule based on your exams and assignments, and it will automatically plot them on your calendar.

## 🛠️ Technology Stack

Arcus is built using modern, fast, and secure tools:
- **Frontend & Backend**: Next.js (App Router), React, TypeScript
- **Database**: Supabase (PostgreSQL with `pgvector` for AI embeddings)
- **ORM**: Prisma v7
- **AI Engine**: Vercel AI SDK + Google Gemini 1.5 Pro
- **File Uploads**: UploadThing
- **Background Jobs**: Inngest
- **Styling**: Tailwind CSS + Framer Motion (for smooth animations)

---

## 🚀 How to Use Arcus

1. **Sign In**: Go to the live website and sign in using your Google or GitHub account.
2. **Upload a Document**: Head to the **Documents** tab and click the upload button to add a PDF.
3. **Wait for Processing**: In the background, Arcus will read the document, break it into chunks, and save it to the AI brain.
4. **Start Learning**: 
   - Click **Chat** to ask questions about the document.
   - Click **Generate Flashcards** or **Generate Quiz** to instantly create study materials from the dropdown menu on your document.

---

## 💻 How to Install & Run Locally (For Developers)

If you want to download the code and run it on your own computer, follow these simple steps:

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/arcus-rag-workspace.git
cd arcus-rag-workspace
```

### 2. Install Dependencies
Because we use specific versions of AI tools, make sure to install using the legacy peer dependencies flag:
```bash
npm install --legacy-peer-deps
```

### 3. Set Up Environment Variables
Create a file named `.env` in the root folder. You will need to add your own keys for the following services:
- **Supabase**: `DATABASE_URL` and `DIRECT_URL`
- **NextAuth**: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`
- **Gemini AI**: `GOOGLE_API_KEY`
- **UploadThing**: `UPLOADTHING_SECRET`, `UPLOADTHING_TOKEN`
- **Inngest**: `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`

*(See `.env.example` if available, or reference the deployment guide for how to get these).*

### 4. Setup the Database
Push the database schema to your Supabase instance:
```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Start the Application
```bash
# Start the Next.js frontend
npm run dev

# Open a second terminal window and start the Inngest background server
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app running!

---

*Built with ❤️ to make studying a little less stressful.*
