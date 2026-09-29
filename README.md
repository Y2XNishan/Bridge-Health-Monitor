# 🌉 Bridge Health Monitor
### AI-Powered Structural Health Monitoring Platform — NHAI

> Real-time monitoring of 58 bridges across India using ML pipelines, LLaMA 3.2 3B, and autonomous AI agents.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://brideg-health-monitor-145g.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-purple?style=for-the-badge&logo=render)](https://brideg-health-monitor.onrender.com/docs)
[![GitHub](https://img.shields.io/badge/GitHub-Y2XNishan-181717?style=for-the-badge&logo=github)](https://github.com/Y2XNishan/Brideg-Health-Monitor)

---

## 🚀 Live Demo

| | URL |
|---|---|
| 🌐 Frontend | https://brideg-health-monitor-145g.vercel.app |
| ⚙️ Backend API | https://brideg-health-monitor.onrender.com/docs |

**Demo Credentials:**
- Email: `admin@nhai.gov.in`
- Password: `admin123`

---

## 📌 Project Overview

Bridge Health Monitor is a full-stack AI platform that monitors the structural health of 58 Indian bridges in real-time. Built for NHAI (National Highways Authority of India), it combines IoT sensor simulation, multiple ML models, a fine-tuned LLaMA 3.2 3B model, and autonomous AI agents to detect anomalies, predict failures, and automate inspection workflows.

---

## ✨ Features

### 🔴 Core Monitoring
- **Live Dashboard** — Real-time health scores, anomaly detection, and alerts for all 58 bridges
- **India Network Map** — Interactive SVG map showing bridge status across India
- **58 Bridge Simulation** — Unique sensor data per bridge using deterministic seeds (`bridge_id × 42`)

### 🤖 AI & ML
- **RAG 2.0 Agentic Inspector** — AI agent that autonomously fetches sensor data, checks IRC standards, and generates complete inspection reports
- **XAI Anomaly Explanation** — Explainable AI that tells engineers *why* a bridge was flagged (root cause, sensor correlation, IRC reference, action required)
- **Predictive Maintenance** — Survival analysis predicting days to WARNING/CRITICAL/FAILURE for each bridge
- **What-If Repair Simulator** — Interactive slider showing how repair timing affects bridge survival (unique feature)
- **Proactive Alert Assistant** — Chat that auto-alerts when bridges go critical and executes inspection + crew assignment + Telegram with one "yes"
- **Bridge Intelligence (RAG)** — Natural language Q&A about all 58 bridges powered by Groq (GPT OSS 120B)

### 🔬 ML Models
| Model | AUC Score |
|---|---|
| LSTM Autoencoder | 0.992 |
| Isolation Forest | 0.985 |
| Federated Learning Model | 0.991 |
| Random Forest | 0.726 |
| XGBoost | 0.726 |
| Fine-tuned LLaMA 3.2 3B + QLoRA | Loss: 0.076 |

### 🛠️ Operations
- **AI Crack Detection** — Upload bridge photo → Vision AI detects crack type, severity, IRC recommendation
- **Maintenance Crew Assignment** — Assign crews to critical bridges, connected to Predictive Maintenance
- **Telegram Alerts** — Real-time alerts to `@bridge_health_Bot`
- **PDF Report Generator** — One-click professional NHAI-branded inspection reports
- **AIOps Intelligence Center** — Anomaly correlation, RCA chain, cost intelligence, auto-decision log
- **Multi-Modal AI Chat** — Upload crack photos directly in chat for instant AI analysis

### 🔐 Auth & Access
- 3 roles: Admin / Engineer / Viewer
- Session-based auth with role-based endpoint protection

---

## 🏗️ Architecture
Frontend (React + Vite)     Backend (FastAPI + Python)

↓                           ↓

Vercel CDN              Render Web Service

↓                           ↓

VITE_API_URL ──────────► /api/* endpoints

↓

┌───────────────────────────┐

│  ML Pipeline              │

│  ├── Isolation Forest     │

│  ├── LSTM Autoencoder     │

│  ├── Federated Model      │

│  └── XGBoost / RF         │

│                           │

│  AI Services              │

│  ├── Groq (GPT OSS 120B)  │

│  ├── Fine-tuned LLaMA 3B  │

│  ├── agent.py (RAG 2.0)   │

│  ├── xai.py               │

│  └── survival.py          │

│                           │

│  Integrations             │

│  ├── Telegram Bot         │

│  └── PDF Generator        │

└───────────────────────────┘
---

## 🧰 Tech Stack

**Frontend**
- React 18 + Vite
- Recharts (data visualization)
- Lucide React (icons)
- Tailwind CSS

**Backend**
- FastAPI + Uvicorn
- Python 3.11
- Scikit-learn, XGBoost, NumPy, Pandas
- Groq SDK (GPT OSS 120B)
- ReportLab (PDF generation)
- python-telegram-bot

**ML / AI**
- Fine-tuned LLaMA 3.2 3B + QLoRA (PEFT)
- Isolation Forest (AUC 0.985)
- LSTM Autoencoder (AUC 0.992)
- Federated Learning with FedAvg (AUC 0.991)

**Deployment**
- Frontend → Vercel
- Backend → Render

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free at console.groq.com)

### Backend

```powershell
cd backend
pip install -r requirements.txt

$env:GROQ_API_KEY="your_groq_key"
$env:HF_TOKEN="your_hf_token"
$env:TELEGRAM_BOT_TOKEN="your_telegram_token"
$env:TELEGRAM_CHAT_ID="your_chat_id"

uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### Environment Variables

Create `backend/.env`:
GROQ_API_KEY=your_groq_key

HF_TOKEN=your_hf_token

TELEGRAM_BOT_TOKEN=your_telegram_token

TELEGRAM_CHAT_ID=your_chat_id
Create `frontend/.env`:
VITE_API_URL=http://localhost:8000

---

## 📁 Project Structure
bridge-monitor/

├── frontend/

│   ├── src/

│   │   ├── pages/

│   │   │   ├── Dashboard.jsx          # Live dashboard

│   │   │   ├── IndiaNetwork.jsx       # SVG bridge map

│   │   │   ├── AgentInspector.jsx     # RAG 2.0 inspector

│   │   │   ├── SurvivalAnalysis.jsx   # Predictive maintenance

│   │   │   ├── AIIntelligenceCenter.jsx # AIOps + Bridge Intelligence

│   │   │   ├── CrackDetection.jsx     # Vision AI

│   │   │   └── Maintenance.jsx        # Crew assignment

│   │   └── components/

│   │       └── ChatPanel.jsx          # AI chat + proactive alerts

│   └── package.json

│

└── backend/

├── main.py              # FastAPI (20+ endpoints)

├── chat.py              # LLaMA + Groq chat

├── agent.py             # RAG 2.0 agentic inspector

├── xai.py               # XAI anomaly explanation

├── survival.py          # Predictive maintenance

├── crack_detection.py   # Vision AI

├── telegram_alerts.py   # Telegram integration

├── requirements.txt

└── models/

└── bridgeiq_lora/   # Fine-tuned LoRA adapter

---

## 👨‍💻 Author

**Nishan Kashyap**
B.Tech Computer Science & Engineering
KIIT University, Bhubaneswar

[![GitHub](https://img.shields.io/badge/GitHub-Y2XNishan-181717?style=flat&logo=github)](https://github.com/Y2XNishan)

---
## 📄 License

MIT License — feel free to use this project as a reference.

Built with ❤️ to solve a real infrastructure problem — 
India has 1.7 lakh bridges, and most have no digital monitoring system. 
Bridge Health Monitor is a step toward changing that.
---

*Bridge Health Monitor SHM v1.0 — Real-time structural health monitoring powered by ML pipelines*