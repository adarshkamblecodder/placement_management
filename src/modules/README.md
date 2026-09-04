# Modules

Module-based architecture for the Placement Management System.

```
src/modules/
  auth/                  Login/logout, password change/reset, credentials
  student/               Student-facing profile/resume/dashboard
  admin/                 Admin-facing modules (subdomains below)
    students/            Student CRUD, import, delete, profile view
    studentLogins/       Admin-managed student credential creation
    companies/           Company + placement drive CRUD
    shortlists/          Shortlist management
    interviewRounds/     Interview rounds + result tracking
    applications/        Application CRUD
    jobs/                Legacy jobs flow
    placements/          Placement records
    placed/              Placed students listing
    reports/             Placement analytics & reports
```

Each module follows the same internal layout where applicable:

```
modules/<name>/
  routes/        Express routers (mount path defined in route file)
  controllers/   Request/response coordination
  services/      Business logic + DB operations
  validations/   Input/policy validators
  index.js       Public exports for the module
```

Legacy files under `src/routes/admin_*.js`, `src/routes/student_profile.js`,
`src/services/studentProfileService.js`, `src/auth/*`, `src/utils/*`, and
`src/middleware/*` are kept as **compatibility shims** that re-export from
their new module/shared locations so existing imports continue to work.
