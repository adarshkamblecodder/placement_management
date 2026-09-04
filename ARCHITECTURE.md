# Architecture Specification — Campus Placement Management Platform

## 1. Architectural Pattern & Dependency Rule

The platform is designed as a **Modular Domain-Driven Monolith (DDD)** adhering to the strict layered dependency rule:

$$\text{HTTP Request} \longrightarrow \text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \text{Models} \longrightarrow \text{Database}$$

### Strict Layering Principles
1. **Routes Layer (`routes/`)**: Defines HTTP verbs, paths, rate-limiters, and authentication guards. No business logic or direct DB access.
2. **Controllers Layer (`controllers/`)**: Extracts, sanitizes, and validates request payloads; orchestrates service invocations; determines HTTP responses (JSON or Nunjucks template rendering).
3. **Services Layer (`services/`)**: Pure domain logic, transaction boundaries, calculation engines (eligibility rules, offer conflict resolution, resume parsing, email dispatch, Excel export).
4. **Models Layer (`db/models/`)**: Sequelize ORM definitions, associations, data types, constraints, and table hooks.

---

## 2. System Architecture Diagram

```mermaid
graph TD
    Client["Browser / Client (Desktop & Mobile)"] --> Nginx["Reverse Proxy / SSL Termination"]
    Nginx --> Express["Express 5 Web Application Server"]
    
    subgraph Security_Middleware["Security & Session Layer"]
        Express --> SessionStore["express-session (Cookie + CSRF Guard)"]
        Express --> RateLimiter["express-rate-limit (Auth Protection)"]
        Express --> GlobalError["Global Error Handler & Logger"]
    end

    subgraph Domain_Modules["Modular Domain Layer"]
        SessionStore --> AuthMod["Auth Module (PBKDF2, RBAC, Sessions)"]
        SessionStore --> StudentMod["Student Module (Profile, Resumes, Applications)"]
        SessionStore --> AdminMod["Admin / TPO Module"]
        
        AdminMod --> SubStudents["Students Management & Bulk Import"]
        AdminMod --> SubCompanies["Company CRM & Placement Drives"]
        AdminMod --> SubShortlists["Shortlisting & Eligibility Engine"]
        AdminMod --> SubInterviews["Interview Rounds & Evaluations"]
        AdminMod --> SubNotifications["Profile Readiness & Email Center"]
        AdminMod --> SubReports["Leadership Analytics & Excel Export"]
        AdminMod --> SubAudit["Audit Trail & State Logs"]
    end

    subgraph Data_Layer["Storage & Data Access"]
        Domain_Modules --> Sequelize["Sequelize ORM 6"]
        Sequelize --> SQLite["SQLite (db.sqlite3) / PostgreSQL"]
    end

    subgraph Side_Services["Asynchronous & External Services"]
        Domain_Modules --> Multer["Multer (Memory/Disk File Stream)"]
        Domain_Modules --> Nodemailer["Nodemailer (SMTP / Gmail Gateway)"]
        Domain_Modules --> PDFParser["PDF-Parse (Resume Skills Extractor)"]
        Domain_Modules --> XLSXEngine["XLSX (Bulk Import / Report Engine)"]
    end
```

---

## 3. End-to-End Request Lifecycle: Drive Application & Eligibility Check

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Candidate
    participant Route as Express Router (student.routes.js)
    participant Auth as Auth & CSRF Middleware
    participant Controller as StudentController
    participant EligService as EligibilityService
    participant ConflictService as OfferConflictService
    participant DB as Sequelize Models (Student, Drive, Application)
    participant Mailer as Nodemailer Gateway

    Student->>Route: POST /student/drives/:id/apply (with _csrf)
    Route->>Auth: Validate Session Cookie & CSRF Token
    Auth-->>Route: User Authenticated (Student Role)
    Route->>Controller: applyForDrive(req, res)
    Controller->>DB: Fetch Student & PlacementDrive with rules
    DB-->>Controller: studentRecord, driveRecord
    Controller->>EligService: checkEligibility(student, drive, policy)
    
    alt Ineligible (CGPA low, Backlogs present, Branch mismatch)
        EligService-->>Controller: { isEligible: false, reasons: [...] }
        Controller-->>Student: Render Warning Flash & Rejection Reasons
    else Eligible & Profile Verified
        EligService-->>Controller: { isEligible: true }
        Controller->>DB: Create Application Record (Status: 'Applied')
        Controller->>Mailer: Dispatch Application Confirmation Email
        Controller-->>Student: 302 Redirect to /student/profile/ with Success Flash
    end
```

---

## 4. Scalability & Production Evolution Roadmap

| Component | Current Implementation | Production Scalability Strategy |
|---|---|---|
| **Session Management** | `MemoryStore` / Local Cookie Session | Migrate to distributed **Redis Store** (`connect-redis`) for multi-instance horizontal scaling. |
| **Database Engine** | SQLite (`db.sqlite3`) with additive sync | Seamlessly switch Sequelize connection string to **PostgreSQL** or **MySQL** for high concurrency and multi-tenancy. |
| **File / Media Storage** | Local File System (`media/profile_photos`, `resumes`) | Swap local Multer storage target with **AWS S3 / Google Cloud Storage** signed URLs. |
| **Performance Caching** | Direct DB count queries on dashboard | Layer in Redis caching for department counts and stats with 60s TTL or cache-invalidation on placement events. |
| **Background Processing** | In-process Async Mailer | Introduce **BullMQ / Celery** with Redis queues for large-scale bulk email broadcasts (1,000+ candidates). |
