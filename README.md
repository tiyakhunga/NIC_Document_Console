# NIC Document Console

NIC Document Console is a lightweight, full-stack document intelligence application designed to manage, process, and analyze digital documents in a structured and repeatable manner. The system enables users to create projects, upload documents, generate structured marker outputs, and produce vector embeddings—laying the foundation for Retrieval-Augmented Generation (RAG) and other document intelligence workflows.

---

## 🚀 Features

- **User & Project Management**
  - Username-based access
  - Dashboard view with project tiles
  - Create and manage multiple projects per user

- **Document Processing Pipeline**
  - Upload documents (PDF, CSV, Excel)
  - Generate structured marker JSON outputs
  - Create vector embeddings for each document
  - Enable downstream RAG and semantic search workflows

- **Interactive UI**
  - Clean, multi-screen flow:
    - User login
    - Project dashboard
    - Project operations
  - View uploaded content, marker JSONs, and embedding JSONs directly in the UI
  - Delete documents with automatic cascade cleanup

- **Reliable Local Storage**
  - Folder-based storage for uploads, markers, embeddings, and outputs
  - JSON-based lightweight database for users and projects
  - No external database required

- **Dockerized Deployment**
  - Fully containerized frontend and backend
  - One-command startup using Docker Compose

---

## 🧠 Architecture Overview

### Frontend
- React (Create React App)
- Multi-page UI using internal screen routing
- Communicates with backend via REST APIs

### Backend
- Node.js + Express
- Handles file uploads, processing, and storage
- Generates embeddings using local transformer models (with deterministic fallback)
- Organizes outputs for traceability and reuse

### Storage Structure
```text
uploads/     → original uploaded documents
outputs/     → extracted text / markdown
markers/     → structured marker JSONs
embeds/      → vector embedding JSONs
state/       → db.json & uploads.json
