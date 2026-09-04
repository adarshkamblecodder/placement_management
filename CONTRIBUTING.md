# Contributing Guidelines — Campus Placement Management Platform

Thank you for contributing to the Campus Placement Management Platform! To maintain enterprise software quality and architectural consistency, please follow these guidelines.

---

## 🏛️ The Layered Dependency Rule (Mandatory)

All codebase modifications must strictly follow the one-way dependency chain:

$$\text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \text{Models}$$

### Rules:
1. **Never write DB queries in route files**: Always place Sequelize model queries in dedicated service functions or controllers.
2. **Controllers handle HTTP concerns**: Request parsing, input validation, flash messaging, and rendering templates.
3. **Services contain pure business logic**: Calculation engines, eligibility checks, transaction boundaries, and email formatting.
4. **Shared utilities stay in `src/shared/`**: Middleware (CSRF, RBAC, rate-limiting), mailers, and cross-cutting formatters.

---

## 🛠️ Local Development Workflow

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 2. Setup Environment
```bash
# Clone the repository and navigate to root
cd placement_management

# Install dependencies
npm install

# Copy sample environment configuration
cp .env.sample .env
```

### 3. Initialize Database & Seed Demo Data
```bash
# Seed realistic corporate drives, students, and admin accounts
node scripts/seed_demo_data.js
```

### 4. Start Development Server
```bash
npm run dev
# Server listening on http://localhost:3000
```

---

## 🧪 Testing & Quality Assurance

Before submitting any Pull Request:
```bash
# Run comprehensive verification suite
npm test
```

Ensure all verification checks pass:
- `/health` endpoint responds with 200 OK
- CSRF validation blocks unauthenticated POSTs
- Model schemas match additive migration rules
- RBAC guards enforce permissions for SuperAdmin, TPO, and Coordinator roles
