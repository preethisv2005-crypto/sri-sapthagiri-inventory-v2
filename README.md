# Sri Sapthagiri Systems — Inventory Management System

A production-ready inventory management system for Sri Sapthagiri Logistics. Manages Pipes, Fittings, Motors, Transport Challans, Internal Transactions, Reports, and Data Retention.

---

## 🏗️ Project Structure

```
project-root/
├── frontend/          ← Deployed to Vercel
│   ├── index.html
│   ├── styles.css
│   ├── vercel.json
│   └── js/
│       ├── api.js
│       ├── app.js
│       ├── pipes.js
│       ├── fittings.js
│       ├── motors.js
│       ├── challans.js
│       ├── dashboard.js
│       ├── settings.js
│       └── utils.js
│
├── backend/           ← Deployed to Render
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Challan.js
│   │   ├── Fitting.js
│   │   ├── Motor.js
│   │   ├── Pipe.js
│   │   └── Settings.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── utils/
│       └── logger.js
│
├── render.yaml        ← Render deployment config
├── .gitignore
└── README.md
```

---

## 🚀 Production Deployment

### Live URLs
| Component | URL |
|-----------|-----|
| Frontend  | https://srisapthagirisystems.in |
| Backend API | https://sri-sapthagiri-backend.onrender.com |
| Database | MongoDB Atlas |

---

## ⚙️ Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/sri-sapthagiri-inventory.git
cd sri-sapthagiri-inventory
```

### 2. Set up the Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and passwords
npm install
npm run dev    # Starts on http://localhost:3001
```

### 3. Serve the Frontend
```bash
# Open frontend/index.html in a browser, or use:
npx serve frontend -p 8080
# Visit: http://localhost:8080
```

---

## 🔐 Environment Variables (Backend)

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB Atlas connection string | ✅ Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | `production` or `development` | No |
| `ADMIN_PASSWORD` | Admin login password | ✅ Yes |
| `TRANSPORTER_PASSWORD` | Transporter login password | ✅ Yes |

---

## 📦 Deploy to Render (Backend)

1. Sign in to [render.com](https://render.com) → Connect GitHub repo
2. New Web Service → Select repo → Set **Root Directory** to `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add environment variables in the Render dashboard
6. Health check path: `/api/health`

---

## 🌐 Deploy to Vercel (Frontend)

1. Sign in to [vercel.com](https://vercel.com) → Import repo
2. Set **Root Directory** to `frontend`
3. No build command needed (static site)
4. After deploying backend, update `API_BASE` in `frontend/js/api.js` with your Render URL

---

## 🗄️ MongoDB Atlas Setup

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Add a database user and note credentials
3. Allow IP `0.0.0.0/0` in Network Access (for Render free tier)
4. Copy the connection string to `MONGO_URI` in Render env vars

---

## 🗂️ Collections in MongoDB

| Collection | Purpose |
|------------|---------|
| `pipes` | Pipe inventory with stock by godown |
| `fittings` | Fittings inventory with stock |
| `motors` | Motor inventory with serial numbers |
| `challans` | Transport challans (inward/outward) |
| `settings` | App configuration (schemas, godowns, data retention) |
| `activitylogs` | Full audit trail of all operations |

---

## 🌍 GoDaddy DNS (Custom Domain)

Point `srisapthagirisystems.in` to Vercel:
- In GoDaddy DNS settings, add `CNAME` record: `www → cname.vercel-dns.com`
- For the root domain `@`, use the A records provided by Vercel in the custom domain panel

---

## 📋 Features

- ✅ Pipe, Fitting, Motor inventory CRUD
- ✅ Multi-godown stock management
- ✅ Transport Challans (Inward/Outward)
- ✅ Challan PDF printing
- ✅ Internal Transactions
- ✅ Reports with PDF export
- ✅ Dashboard with stock alerts
- ✅ Data Retention configuration (24 months default)
- ✅ Automated & manual database pruning
- ✅ Full audit trail logging
- ✅ Responsive (mobile + desktop)
- ✅ Role-based access (Admin / Transporter)
