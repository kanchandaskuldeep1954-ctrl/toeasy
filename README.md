# Toeasy AI - Data Operating System

**Professional-grade autonomous data operating system for analysts and scientists.**

Automated cleaning, AI-driven exploration, executive reporting, and intelligent dashboards with real-time visualization.

---

## ✨ Features

### 🎯 **Core Capabilities**
- ✅ **Smart Data Cleaning** - Automatic anomaly detection, missing value handling, deduplication
- ✅ **AI-Generated Dashboards** - Auto-generates 4-6 relevant charts from any dataset
- ✅ **15+ Interactive Chart Types** - Bar, Line, Pie, Scatter, Heatmap, Radar, Treemap, Area, Funnel, Gauge, and more
- ✅ **Dynamic KPI Calculations** - Real-time sum, average, max, min, count operations
- ✅ **AI-Powered Modifications** - Modify charts with natural language ("Change to line chart")
- ✅ **Strategic Report Generation** - AI generates executive summaries and insights
- ✅ **Cross-Filtering** - PowerBI-style slicers that update all charts in real-time
- ✅ **Multi-Format Export** - HTML, PDF, CSV, JSON, PowerBI-ready formats

### 🤖 **AI Capabilities**
- Natural language SQL query generation
- Synthetic dataset generation for testing
- Chart specification from natural language prompts
- AI-powered data quality analysis
- Intelligent data recovery and healing

### 📊 **Data Management**
- Support for 30+ data sources (CSV, Excel, SQL databases, APIs, SaaS)
- Data validation rules with automatic remediation
- Quality metrics and health scoring
- Audit trails and recovery history

### 🔐 **Enterprise Features**
- JWT authentication with tier-based access
- Subscription management (Basic, Pro, Enterprise)
- Role-based permissions
- Redis caching for performance
- Rate limiting and API protection

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis (for caching)
- Groq API key (for AI features)

### Installation

\`\`\`bash
# Clone repository
git clone https://github.com/kanchandaskuldeep1954-ctrl/toeasy.git
cd toeasy

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Setup environment variables
cp .env.example .env
cp backend/.env.example backend/.env

# Add your API keys
# VITE_BACKEND_URL=http://localhost:3000/api
# GROQ_API_KEY=your_groq_key
# DATABASE_URL=postgresql://...
# REDIS_URL=redis://localhost:6379
\`\`\`

### Development

\`\`\`bash
# Terminal 1: Backend (port 3000)
cd backend
npm run dev

# Terminal 2: Frontend (port 5173)
npm run dev

# Open http://localhost:5173
\`\`\`

### Production Build

\`\`\`bash
npm run build
cd backend
npm run build

# Deployment to Vercel/Railway
npm install -g @vercel/cli
vercel deploy
\`\`\`

---

## 📊 Dashboard Features

### Auto-Generated Charts
When you upload a dataset, the system automatically analyzes it and generates:
1. **Bar Chart** - Categorical vs Numeric distribution
2. **Line Chart** - Trend analysis
3. **Pie Chart** - Market share/composition
4. **Scatter Plot** - Correlation analysis (numeric × numeric)
5. **Radar Chart** - Multi-metric performance
6. **Heatmap** - Intensity mapping (categorical × categorical)

### Interactive Features
- **Click to Filter** - Click any bar/slice to filter all charts
- **Slicers** - PowerBI-style dropdown filters
- **Edit Mode** - Manually configure chart properties
- **AI Magic Edit** - "Change to area chart", "Add trendline", etc.
- **Copilot** - Ask "Add sales by region" to generate new charts

### Customization
- 15+ chart types
- Custom color schemes
- Aggregation options (sum, avg, count, max, min, unique)
- Sorting and grouping
- Threshold lines and reference values

---

## 🔧 API Endpoints

### Dashboard Generation
\`\`\`
POST /api/suggest-dashboard
- Input: { dataset: Dataset }
- Output: { charts, kpis, patterns }
- Auto-generates dashboard config from data
\`\`\`

### Chart Management
\`\`\`
POST /api/generate-chart
- Generate new chart from natural language prompt

POST /api/modify-chart
- Modify existing chart with AI suggestions

POST /api/generate-report
- Create strategic report with insights

POST /api/consult-agent
- Ask questions about your data
\`\`\`

### Data Operations
\`\`\`
POST /api/generate-sql
- Convert natural language to SQL

POST /api/generate-synthetic
- Generate test data on demand
\`\`\`

---

## 📁 Project Structure

\`\`\`
.
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── DashboardView.tsx    # Main dashboard with charts
│   │   ├── ReportView.tsx        # Report generation
│   │   ├── CleanView.tsx         # Data cleaning
│   │   ├── ExploreView.tsx       # SQL explorer
│   │   └── ...
│   ├── services/
│   │   ├── groqService.ts        # AI API client
│   │   ├── apiClient.ts          # HTTP client
│   │   └── ...
│   └── types.ts                  # TypeScript types
│
├── backend/                      # Backend source
│   ├── src/
│   │   ├── services/
│   │   │   └── groq.service.ts  # AI implementation
│   │   ├── routes/               # API endpoints
│   │   │   ├── dashboards.ts    # Dashboard CRUD
│   │   │   ├── datasets.ts      # Dataset management
│   │   │   └── ...
│   │   ├── middleware/           # Auth, subscription, cache
│   │   ├── db.ts                 # Database connection
│   │   └── index.ts              # Express app setup
│   └── package.json
│
├── components/                   # Legacy components
├── public/                       # Static assets
├── package.json                  # Frontend dependencies
└── README.md                     # This file
\`\`\`

---

## 🔐 Authentication

\`\`\`bash
# Login endpoint
POST /api/auth/login
{ email, password }
→ { token, user, subscription }

# Token stored in localStorage
# Automatically added to all requests via interceptor
# 401 response → Auto logout and redirect to login
\`\`\`

---

## 💰 Subscription Tiers

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|-----------|
| Datasets | 3 | 50 | Unlimited |
| Rows per Dataset | 500 | 50,000 | 1,000,000 |
| Queries/month | 10 | 1,000 | Unlimited |
| Connectors | 1 | 5 | 100 |
| Dashboards | Limited | 100 | Unlimited |
| Reports | 5/mo | Unlimited | Unlimited |
| Support | Email | Priority | Dedicated |

---

## 🧪 Testing

\`\`\`bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
\`\`\`

---

## 📈 Performance

- **Charts render in <100ms** with Recharts optimization
- **Caching layer** reduces API calls by 80%
- **Pagination** handles 1M+ row datasets efficiently
- **Lazy loading** for large visualizations
- **Worker threads** for heavy computations

---

## 🐛 Troubleshooting

### Dashboard shows empty
- Check API endpoint status: \`curl http://localhost:3000/api/suggest-dashboard\`
- Verify dataset has both numeric and categorical columns
- Check browser console for error messages

### Charts not updating when filtering
- Clear browser localStorage and reload
- Check that dataset has valid data in all rows
- Verify slicer columns have appropriate values

### "API error: 404"
- Ensure backend is running on port 3000
- Check VITE_BACKEND_URL environment variable
- Verify all 5 dashboard endpoints are implemented

### Performance issues
- Reduce dataset size initially (start with <10K rows)
- Clear Redis cache: \`redis-cli FLUSHDB\`
- Check CPU/memory usage on backend

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit changes (\`git commit -m 'Add amazing feature'\`)
4. Push to branch (\`git push origin feature/amazing-feature\`)
5. Open Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

- **Email**: support@toeasy.ai
- **Issues**: GitHub Issues
- **Documentation**: https://docs.toeasy.ai

---

## 🚀 Roadmap

- [ ] Real-time collaborative editing
- [ ] Advanced ML pattern detection
- [ ] Custom visualization builder
- [ ] Mobile app
- [ ] GraphQL API
- [ ] Data marketplace
- [ ] Custom ML model training
- [ ] Real-time data streaming

---

**Built with ❤️ by the Toeasy team**

Last updated: January 16, 2026
