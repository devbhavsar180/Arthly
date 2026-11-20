# MyMoney – Personal Expense & Income Tracker

A modern, full-stack, privacy-first **Personal Expense and Income Management Application** engineered for both **Web** and **Android Mobile** platforms. Powered by a unified **FastAPI + PostgreSQL** backend, synchronized across devices in real time.

---

## 🌟 Key Features

- **📊 Comprehensive Financial Dashboard**:
  - Summary KPI cards: Total Income, Total Expenses, Remaining Balance, Total Savings, This Month vs. Previous Month.
  - Interactive Visualizations (Recharts): Expense Breakdown (Donut Chart), Monthly Expense Trend (Bar Chart), Income vs. Expense (Comparison), Category-wise Expense Analysis, Daily Expense Trend.
- **🎙️ Multilingual Voice Expense Entry**:
  - Understands spoken or typed colloquial **Gujarati**, **Hindi**, and **English** (with Auto Detect mode).
  - Translates colloquial speech (e.g. *"Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya."*) into structured English transactions.
  - Multi-item parsing: splits compound sentences with multiple expenses.
  - **Editable Preview Screen**: Transactions are **never** auto-saved immediately—users review and confirm before committing.
- **🏦 Bank Statement Reconciliation & Verification**:
  - Privacy-first: **Zero bank account credentials or screen scraping required**. Upload monthly statements manually in **PDF**, **CSV**, or **Excel (.xlsx)** format.
  - Automated matching engine with configurable date tolerance (±1 to ±7 days).
  - Status classification: `MATCHED`, `MISSING_IN_APP`, `NOT_FOUND_IN_BANK`, `MISMATCH`, `NEEDS_REVIEW`.
  - 1-Click **"Create in App"** for missing transactions.
  - Exportable reconciliation reports in **PDF**, **Excel (.xlsx)**, and **CSV**.
- **💳 Expense & Income Tracking**:
  - Add expenses in Indian Rupees (₹ INR) with predefined and custom categories.
  - Payment modes: `Cash`, `UPI`, `Debit Card`, `Credit Card`, `Other`.
  - Separate manual income entry (Monthly Salary, Freelancing, Business, Bonus, Other).
- **📑 Detailed Reporting & Downloads**:
  - Monthly Expense Report PDF, Monthly Income Report PDF, Financial Summary PDF.
  - Excel (.xlsx) and CSV exports with date, month, and category filters.
- **📱 Android Mobile Application**:
  - Built with React Native & Expo SDK 52.
  - Pre-compiled, signed, standalone Android APK included in `builds/My-Expense-Tracker.apk`.
  - In-app **Server Settings** to connect easily to localhost, LAN Wi-Fi, or cloud URLs.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Uvicorn |
| **Database** | Neon PostgreSQL (Cloud Production), SQLite (Local Quick-Start), PostgreSQL 16 (Local) |
| **Web Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide React, Recharts |
| **Mobile App** | React Native, Expo SDK 52, Expo Router, TypeScript, Expo Document Picker, Expo Sharing |
| **Security** | Bcrypt (12 rounds), Signed JWT Access & Refresh Tokens, Strict User Isolation |
| **Reports & Export** | ReportLab (PDF), OpenPyXL (Excel), Matplotlib, CSV |
| **NLP & Audio** | Custom Gujarati/Hindi/English NLP Parser, Web Speech API |

---

## 📁 Project Directory Structure

```text
Expence track 23/
├── .env.example                     # Centralized environment template for the entire stack
├── .gitignore                       # Production-grade Git ignore rules
├── docker-compose.yml               # Local Docker stack (PostgreSQL + FastAPI + Next.js)
├── README.md                        # Project documentation and deployment guide
│
├── backend/                         # FastAPI REST API Backend
│   ├── alembic/                     # Database migrations
│   │   ├── env.py                   # Alembic environment with psycopg3 auto-normalization
│   │   └── versions/                # Migration scripts (0001_initial, 0002_voice_and_reconciliation)
│   ├── app/
│   │   ├── api/v1/                  # REST endpoints: auth, transactions, categories, dashboard,
│   │   │                            # voice, reconciliation, reports, settings
│   │   ├── core/                    # config.py, database.py, security.py, deps.py
│   │   ├── models/                  # SQLAlchemy models (User, Transaction, Category, Voice, Statement)
│   │   ├── schemas/                 # Pydantic v2 schemas
│   │   └── services/                # Voice parser, statement parser, reconciliation, reports, analytics
│   ├── tests/                       # Automated pytest test suites (9 test suites, 100% pass)
│   ├── .env.example                 # Backend environment variable template
│   ├── Dockerfile                   # Production containerfile with dynamic $PORT support
│   └── requirements.txt             # Python dependencies (pinned versions)
│
├── web/                             # Next.js 15 Web Application
│   ├── src/
│   │   ├── app/                     # Pages: login, register, dashboard, transactions,
│   │   │                            # add-expense, add-income, voice-entry, reconciliation, reports, settings
│   │   ├── components/              # AppShell layout, navigation, charts, modals
│   │   ├── lib/                     # API client, auth context, currency formatters
│   │   └── types/                   # TypeScript interfaces
│   ├── .env.example                 # Web environment variable template
│   ├── Dockerfile                   # Multi-stage production containerfile
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                          # React Native + Expo Mobile Application
│   ├── app/                         # Expo Router screens: (auth), (tabs), voice-entry, reconciliation
│   ├── assets/                      # Icons, adaptive icons, splash screens
│   ├── plugins/                     # Expo config plugins (withCleartextTraffic for LAN)
│   ├── src/                         # API client, secure storage, custom components
│   ├── app.json                     # Expo configuration
│   ├── eas.json                     # EAS Build profiles
│   └── package.json
│
└── builds/                          # Ready-to-install Android APK builds
    └── My-Expense-Tracker.apk       # Pre-compiled, signed Android APK (v1.1.0)
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./expense_tracker.db` (Local)<br>`postgresql+psycopg://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` (Neon) |
| `JWT_SECRET_KEY` | Secret key for signing JWT tokens (min 32 chars) | Random 48-byte string (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `JWT_ALGORITHM` | Algorithm for JWT tokens | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan in minutes | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifespan in days | `30` |
| `APP_NAME` | Name displayed in docs | `My Expense Tracker API` |
| `APP_ENV` | Application environment | `development` (Local) / `production` (Render) |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:3000,https://your-frontend.vercel.app` |

### Web Frontend (`web/.env.local`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Backend API Base URL | `http://localhost:8000/api/v1` (Local)<br>`https://your-backend.onrender.com/api/v1` (Production) |

### Mobile App (`mobile/.env` or in-app setting)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Backend API Base URL | `http://10.0.2.2:8000/api/v1` (Emulator)<br>`http://10.127.50.197:8000/api/v1` (LAN Wi-Fi)<br>`https://your-backend.onrender.com/api/v1` (Production) |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Python 3.12+**
- **Node.js 20+** and **npm**
- (Optional) **PostgreSQL 16** or Docker (SQLite works immediately out of the box)

---

### 2. Backend Setup (FastAPI)

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your local environment file
cp .env.example .env

# 5. Run database migrations
alembic upgrade head

# 6. Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Run Pytest Suite**:
  ```bash
  pytest -v
  ```

---

### 3. Web Frontend Setup (Next.js)

```bash
# 1. Navigate to the web directory
cd web

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env.local

# 4. Start the Next.js development server
npm run dev
```

- **Web Application URL**: [http://localhost:3000](http://localhost:3000)
- **Default Demo Account**:
  - Email: `user@example.com`
  - Password: `password123`

---

### 4. Mobile App Setup (Expo & Android)

```bash
# 1. Navigate to the mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Start Expo development server
npx expo start
```

#### Installing the Standalone APK:
1. Locate `builds/My-Expense-Tracker.apk`.
2. Transfer the file to your Android device via USB, Google Drive, or WhatsApp.
3. Tap the file to install (enable **"Install unknown apps"** if prompted).
4. On the Login screen, tap **"Server Settings"** to set your backend URL:
   - If testing on the same Wi-Fi network: `http://<YOUR_PC_IP>:8000/api/v1`
   - If using cloud deployment: `https://your-backend.onrender.com/api/v1`

---

## ☁️ Production Deployment Guide

### Step 1: Set Up Cloud Database (Neon PostgreSQL)

1. Sign up at [Neon.tech](https://neon.tech) and create a new project (e.g. `expense-tracker-db`).
2. Neon provides a PostgreSQL connection string in the dashboard:
   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Copy this connection string. The application automatically normalizes `postgresql://` and `postgres://` to `postgresql+psycopg://` for SQLAlchemy 2.

---

### Step 2: Deploy Backend to Render

1. Sign up or log in to [Render](https://render.com).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service:
   - **Name**: `my-expense-tracker-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3` (or choose `Docker` to use the provided `backend/Dockerfile`)
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && alembic upgrade head
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
5. Add **Environment Variables** in the Render Dashboard:
   - `DATABASE_URL`: Your Neon connection string with `?sslmode=require`
   - `JWT_SECRET_KEY`: A secure random string (32+ characters)
   - `JWT_ALGORITHM`: `HS256`
   - `APP_ENV`: `production`
   - `CORS_ORIGINS`: Your frontend URL(s), e.g. `https://my-expense-tracker.vercel.app`
6. Click **Deploy Web Service**.
7. Once deployed, note your service URL: `https://my-expense-tracker-backend.onrender.com`.

---

### Step 3: Deploy Frontend to Vercel (or Render Static Site)

1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `web`.
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://my-expense-tracker-backend.onrender.com/api/v1`
4. Click **Deploy**.
5. Copy your live Vercel URL and add it to `CORS_ORIGINS` in your Render backend settings.

---

## 🔒 Security & Privacy Architecture

- **Zero Bank Credentials**: The app never asks for bank account numbers, passwords, UPI PINs, or credentials. Bank statements are processed strictly as offline documents.
- **Manual Income Only**: No automatic salary assumptions; calculations only include income explicitly confirmed by the user.
- **Confirmation Before Saving**: Voice recognition generates an editable preview. Transactions are **never** committed to the database without explicit user confirmation.
- **Strict User Isolation**: All transactions, categories, voice entries, and statements are strictly scoped to `user_id = current_user.id` at the database query level.

---

## 📄 License

This project is created for personal financial management and tracking.
