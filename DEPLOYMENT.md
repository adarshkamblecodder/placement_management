# Deployment Guide — Placement Management System

Three deployment options are covered. Pick the one that fits your setup.

| Option | Platform | Best For |
|--------|----------|----------|
| [A](#option-a--rendercoom) | Render.com | Free tier, quick start |
| [B](#option-b--vps--ubuntu-server) | VPS / Ubuntu | Full control, production |
| [C](#option-c--railwayapp) | Railway.app | Simplest, 1-click |

---

## Option A — Render.com

### Step 1 — Push code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/placement-management.git
git push -u origin main
```

### Step 2 — Create a PostgreSQL database on Render

1. Go to [render.com](https://render.com) → **New → PostgreSQL**
2. Give it a name (e.g. `placement-db`) and click **Create Database**
3. Note down after it provisions:
   - Internal Database URL
   - Hostname, Port, Database name, Username, Password

### Step 3 — Create a Web Service on Render

1. **New → Web Service** → Connect your GitHub repository
2. Set the following:

   | Field | Value |
   |-------|-------|
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |

### Step 4 — Add Environment Variables

Go to your Web Service → **Environment** tab and add:

```
NODE_ENV          = production
SECRET_KEY        = (generate: openssl rand -hex 32)
DB_HOST           = (Render Postgres internal hostname)
DB_PORT           = 5432
DB_NAME           = (your database name)
DB_USER           = (your database user)
DB_PASSWORD       = (your database password)
COLLEGE_NAME      = Your College Name
COLLEGE_LOGO      = /static/logo.png
DOMAIN_NAME       = your-app.onrender.com
THEME_COLOR       = #4f46e5
THEME_COLOR_DARK  = #0ea5e9
SHOW_POWERED_BY   = true
POWERED_BY_NAME   = Placement Portal
SMTP_HOST         = smtp.gmail.com
SMTP_PORT         = 587
SMTP_SECURE       = false
SMTP_USER         = your@gmail.com
SMTP_PASS         = your_gmail_app_password
MAIL_FROM         = your@gmail.com
```

### Step 5 — Deploy

Render auto-deploys on every push to `main`. You can also trigger a manual deploy from the dashboard.

---

## Option B — VPS / Ubuntu Server

> Works on DigitalOcean, AWS EC2, Linode, or any Ubuntu VPS.

### Step 1 — Install dependencies on the server

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx
```

### Step 2 — Create the PostgreSQL database

```bash
sudo -u postgres psql
```

Inside the psql prompt:

```sql
CREATE USER placement_user WITH PASSWORD 'your_password';
CREATE DATABASE placement_db OWNER placement_user;
\q
```

### Step 3 — Upload the project

**Option 1 — SCP from local machine:**

```bash
scp -r h:/placement_management user@your-server-ip:/var/www/placement_management
```

**Option 2 — Clone from GitHub on the server:**

```bash
git clone https://github.com/your-username/placement-management.git /var/www/placement_management
```

### Step 4 — Install dependencies on the server

```bash
cd /var/www/placement_management
npm install --omit=dev
```

### Step 5 — Create the `.env` file

```bash
cp .env.sample .env
nano .env
```

Fill in all values (see [Environment Variables](#environment-variables-quick-reference)).

### Step 6 — Install PM2 and start the app

```bash
npm install -g pm2
pm2 start server.js --name placement-portal
pm2 save
pm2 startup
```

> Follow the printed command to enable auto-start on server reboot.

### Step 7 — Configure Nginx as a reverse proxy

```bash
sudo nano /etc/nginx/sites-available/placement
```

Paste the following:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /static/ {
        alias /var/www/placement_management/staticfiles/;
    }

    location /media/ {
        alias /var/www/placement_management/media/;
    }
}
```

Then enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/placement /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 8 — Enable HTTPS with SSL (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews the certificate every 90 days.

---

## Option C — Railway.app

### Step 1 — Deploy from GitHub

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Select your repository

### Step 2 — Add PostgreSQL

1. Inside your project click **New → Database → Add PostgreSQL**
2. Railway automatically injects `DATABASE_URL` into your environment

### Step 3 — Add Environment Variables

Go to your service → **Variables** tab and add all variables from [the reference table](#environment-variables-quick-reference).

> Railway uses `DATABASE_URL` automatically so you can skip individual `DB_*` variables.

### Step 4 — Deploy

Railway detects the `Procfile` automatically:

```
web: node server.js
```

The app deploys on every push to `main`.

---

## After Any Deployment — First-Time Setup

The app auto-creates an admin account in development mode only.  
For **production**, run one of the following on the server:

```bash
node scripts/create_admin_user.js
# or
node reset_admin.js
```

Then verify the app is running:

```
GET https://yourdomain.com/health
```

Expected response:

```json
{ "ok": true, "service": "placement-node" }
```

---

## Gmail App Password Setup

Required for the shortlist notification emails to work.

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** (required before App Passwords appear)
3. Search for **App Passwords**
4. Create a new one → Select **Mail**
5. Copy the generated 16-character password
6. Paste it as `SMTP_PASS` in your environment variables

---

## Environment Variables — Quick Reference

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` for live deployment |
| `SECRET_KEY` | Random secret for session encryption (min 32 chars) |
| `DB_HOST` | PostgreSQL server hostname |
| `DB_PORT` | PostgreSQL port (default: `5432`) |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `COLLEGE_NAME` | Your college name (shown in UI and emails) |
| `COLLEGE_LOGO` | Path to college logo (e.g. `/static/logo.png`) |
| `DOMAIN_NAME` | Your deployed domain (e.g. `placement.yourcollege.edu`) |
| `THEME_COLOR` | Primary colour for light mode (hex, e.g. `#4f46e5`) |
| `THEME_COLOR_DARK` | Primary colour for dark mode (hex, e.g. `#0ea5e9`) |
| `SHOW_POWERED_BY` | `true` or `false` |
| `POWERED_BY_NAME` | Name shown in footer (e.g. `Placement Portal`) |
| `SMTP_HOST` | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (`587` for TLS, `465` for SSL) |
| `SMTP_SECURE` | `false` for port 587, `true` for port 465 |
| `SMTP_USER` | Your email address |
| `SMTP_PASS` | Gmail App Password (16 characters) |
| `MAIL_FROM` | Sender email address |

---

## PM2 Useful Commands

```bash
pm2 list                        # list all running processes
pm2 logs placement-portal       # view live logs
pm2 restart placement-portal    # restart the app
pm2 stop placement-portal       # stop the app
pm2 delete placement-portal     # remove from PM2
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js v5 |
| Template Engine | Nunjucks |
| Database | PostgreSQL |
| ORM | Sequelize v6 |
| File Uploads | Multer |
| Email | Nodemailer |
| Excel | XLSX / SheetJS |
| Auth | express-session |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
