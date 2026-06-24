# BritSync Docu — Standalone Document Signer & Editor

Welcome to **BritSync Docu**, a premium, secure standalone document signing and collaborative editor application. This platform allows users to create A4-styled documents, customize them using a rich WYSIWYG editor (with dynamic Table of Contents), upload existing PDF/Word files, place form fields (signatures, names, text fields) via drag-and-drop, and send them to clients/members for digital signature verification.

---

## 🏗 System Architecture & Database Requirements

BritSync Docu consists of two layers:
1. **Frontend (this folder)**: React SPA built with Vite, TypeScript, and TailwindCSS (Glassmorphic dark mode theme).
2. **Backend Server (`britsync-server`)**: Node.js & Express API server.

### 🗄️ Database: MongoDB
The system stores all persistent data in **MongoDB**. This includes:
* **Users & Auth**: Authentication credentials, cryptographically secure hashes, and JSON Web Tokens.
* **Workspace & Teams**: Role-based access control memberships (`viewer`, `member`, `admin`, `owner`).
* **Documents & Fields**: Stored field locations (signatures, dates, text inputs), original and compiled PDF URLs, and progress states.
* **Audit Trails**: Security audit records mapping IP addresses, browser agents, timestamps, and signature verification fingerprints.

---

## ⚙️ Environment Configuration

To run the application, configure your environments:

### 1. Backend Server (`britsync-server/.env`)
Create a `.env` file inside the `britsync-server` folder:
```env
PORT=5003
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/britsync
JWT_SECRET=your_super_secret_jwt_key
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend Client (`britsync-docu/.env`)
Create a `.env` file inside this folder (`britsync-docu`):
```env
VITE_API_URL=http://localhost:5003/api
```

---

## 🚀 Getting Started

### 1. Install Dependencies
Run in this directory:
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The client application will start at `http://localhost:5173/` or another local port.

### 3. Production Build
To compile production-ready static assets:
```bash
npm run build
```
This will compile and optimize all TypeScript/React components into the `dist/` directory, which can be mapped directly to your Nginx static directories.

---

## 🔒 Security & Access Roles
The system enforces strict RBAC (Role-Based Access Control) on both frontend screens and backend APIs:
* **Viewer**: Read-only access. Creation, uploads, changes, and team controls are hidden and blocked.
* **Member**: Can create, edit, compile, and send documents. Cannot manage billing or invite team members.
* **Admin / Owner**: Full configuration access, invite team members, adjust workspace permissions.
