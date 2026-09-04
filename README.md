# 🎓 Campus Placement Management Platform

A high-performance, modular **Campus Placement Management Platform** built with Node.js, Express, Sequelize, and Nunjucks templates. Designed specifically to automate end-to-end seasonal placement workflows for university Training & Placement Officers (TPOs), Department Coordinators, and Graduating Students.

---

## 🌟 Product Vision & Workflow Personas

Traditional campus placements rely on spreadsheets and manual messaging, causing eligibility cross-checking bottlenecks, offer conflicts, and data discrepancies. This platform transforms that operational model:

1. **Training & Placement Officer (TPO / Super Admin)**:
   - Publishes placement drives with automated eligibility criteria (CGPA, backlogs, branch, year).
   - Manages recruiter relationships via a built-in corporate CRM (ratings, visit history, average packages).
   - Resolves offer conflicts with automated one-offer policy auto-withdrawals.
   - Generates leadership-grade visual analytics and exportable Excel reports for College Deans & Accreditation bodies.
2. **Department Placement Coordinator**:
   - Manages candidates within their assigned department branch (`CS`, `AIML`, `AIDS`, `MBA`).
   - Oversees profile verification gates before candidate resumes are visible to visiting recruiters.
3. **Student Candidate**:
   - Tracks drive eligibility with instant feedback reasons.
   - Manages resumes with automated PDF keyword skill extraction.
   - Receives automated email alerts on shortlisting, interview round schedules, and final decisions.

---

## 🏗️ Architecture & Technology Stack

- **Runtime & Framework**: Node.js v18+, Express 5
- **Architecture**: Modular Domain-Driven Monolith (DDD) with strict dependency enforcement (`Routes → Controllers → Services → Models`)
- **Database ORM**: Sequelize 6 with SQLite (`db.sqlite3`) & safe additive schema sync
- **Authentication**: Django-compatible PBKDF2 SHA-256 password hashing with RBAC (`superadmin`, `tpo`, `coordinator`, `student`)
- **Security & Integrity**: Universal CSRF protection, Nunjucks autoescaping (`autoescape: true`), express-rate-limit brute-force protection, secure session cookies
- **Templating & UI**: Nunjucks with Glassmorphism, 3D CSS hover elevation, dynamic theme variables, and Dark/Light mode toggle
- **External Integrations**: Nodemailer SMTP gateway, `xlsx` report generator, `pdf-parse` resume analyzer

---

## 🚀 Key Feature Matrix

### 1. Core TPO Workflow Tools
- **Automated Eligibility Engine**: Real-time validation against min CGPA, active backlogs, branches, and graduation year with user-friendly rejection reasoning.
- **One-Offer Conflict Resolution**: Automatically withdraws competing active applications when a candidate accepts an offer under the institution's one-offer policy.
- **Drive Lifecycle Tracker**: Tracks drives across lifecycle stages (*Announced → Registration Open → Shortlisting → Interviews In Progress → Results Declared → Closed*).
- **Profile Verification Gate**: Ensures academic metrics and uploaded resumes are verified by department coordinators before placement shortlisting.
- **Corporate CRM**: Tracks company tier, institutional ratings, campus visit history, and internal notes.

### 2. Student Experience
- **Interactive Profile Hub**: Reorganized into *Job Applications*, *Upcoming Interviews*, *Attended Evaluations*, and *Credentials*.
- **Resume-to-Skills Autofill**: Parses uploaded PDF resumes and automatically detects candidate technical competencies.
- **Interactive Certifications**: Hover color transitions and direct links to profile credentials.
- **Dedicated Interview Round Pages**: Full evaluation timeline and interviewer feedback at `/students/:id/interview-rounds/`.

### 3. Admin & Coordinator Tools
- **Skills Search & Filter**: Search by keyword or specific technical skills with instant clear (**X**) controls.
- **Multi-Select Shortlisting Flow**: Bulk selection checkboxes with a target Placement Drive selector dropdown.
- **Notifications & Readiness Panel**: Visual profile completion progress bars (0–100%) and 3-stage email dispatcher (Shortlists, Schedules, Results).
- **Bulk CSV / Excel Import**: Downloadable sample CSV format with row-level validation warnings.
- **Admin Audit Trail**: Complete JSON-structured logging viewable at `/admin/audit-log/`.

### 4. Standardized Technical Skills Library
The platform utilizes a standardized, pre-defined technical skills library to ensure data consistency between student profiles and recruiter filters. This prevents typos and fragmentation (e.g., "React.js" vs "ReactJS") and includes:
- **Programming Languages**: C, C++, Java, Python, JavaScript, TypeScript, C#, Go, Rust, Swift, Kotlin, Ruby, PHP, R
- **Web Development**: React.js, Angular, Vue.js, Node.js, Express.js, Django, Flask, Spring Boot, ASP.NET, HTML5/CSS3, Tailwind CSS, Bootstrap
- **Databases**: MySQL, PostgreSQL, MongoDB, SQLite, Redis, Oracle, Firebase
- **Cloud & DevOps**: AWS, GCP, Azure, Docker, Kubernetes, Git/GitHub, Jenkins, CI/CD, Linux
- **Data Science & ML**: Machine Learning, Deep Learning, AI, TensorFlow, PyTorch, Pandas, NumPy, Scikit-Learn, NLP
- **Core & Advanced Tech**: DSA, OOP, System Design, RESTful APIs, GraphQL, Microservices, Web3/Blockchain, Cybersecurity

---

## 🛠️ Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file from the sample template:
```bash
cp .env.sample .env
```

### 3. Seed Realistic Demo Data
```bash
node scripts/seed_demo_data.js
```

### 4. Launch the Server
```bash
npm run dev
# Server listening at http://localhost:3000
```

---

## 🔑 Default Credentials

| Role | Username / Identifier | Password | Access Scope |
|---|---|---|---|
| **Super Admin / Chief TPO** | `admin` | `admin123` | Full system access, all departments, audit logs |
| **CS Coordinator** | `cs_coordinator` | `admin123` | Scoped to CS branch candidates & verification |
| **AIML Coordinator** | `aiml_coordinator` | `admin123` | Scoped to AIML branch candidates & verification |
| **Student Sample** | `2024CS001` | `password123` | Student portal, resume upload, applications |

---

## 🗺️ Route Directory Map

| Route URL | HTTP Method | Access Level | Description |
|---|:---:|:---:|---|
| `/health` | `GET` | Public | Live system health check |
| `/login/` | `GET / POST` | Public | Rate-limited authentication & session initiation |
| `/admin-dashboard/` | `GET` | Staff / Admin | TPO overview with live department stats & skills search |
| `/students/` | `GET` | Admin / Coordinator | Student management, skills filter, multi-select shortlisting |
| `/students/sample-csv/` | `GET` | Staff / Admin | Download standardized bulk import CSV template |
| `/students/:pk/interview-rounds/` | `GET` | Staff / Admin | Dedicated candidate evaluation timeline |
| `/admin/notifications/` | `GET / POST` | Staff / Admin | Profile readiness tracker & 3-stage email dispatcher |
| `/companies/` | `GET / POST` | Staff / Admin | Corporate CRM, placement drives, full JD visibility |
| `/companies/delete-all/` | `POST` | Super Admin | Protected bulk company deletion with audit log |
| `/reports/` | `GET` | Staff / Admin | Visual analytics, branch comparison & YoY trends |
| `/reports/export/` | `GET` | Staff / Admin | Export formatted placement reports to Excel (`.xlsx`) |
| `/admin/audit-log/` | `GET` | Super Admin | Comprehensive system activity log |
| `/student/profile/` | `GET / POST` | Student | Student hub (applications, interviews, resume upload) |
| `/student/interview-rounds/` | `GET` | Student | Dedicated student interview assessment history |

---

## 📈 Known Limitations & Roadmap

- [ ] **Recruiter Direct Portal**: Dedicated recruiter login to submit JDs directly and download shortlisted resume bundles.
- [ ] **Distributed Job Queues**: Integration with BullMQ & Redis for handling mass email blasts exceeding 5,000+ candidates asynchronously.
- [ ] **Cloud Storage S3 Adapter**: Direct signed URL file uploads to AWS S3 / Google Cloud Storage.
