# Toeasy AI: Technical Manifesto for TestSprite Validation

## 📜 0. The First-Principle Engineering Standard
Every feature in Toeasy must be built on **Deterministic Logic** and **Real Value Addition**. AI is used as an Efficiency Multiplier, but the underlying data processing must be mathematically sound, contextually relevant, and audit-ready.

**CRITICAL:** Fraudulent data (mocking dataframes where real work is expected), "template-based" generic charts, and crashing on edge cases are strictly forbidden.

---

## 🛠️ 1. Module-Specific Technical Standards

### 📊 A. Visualization Layer (Dashboards & Charts)
- **Zero Mocking:** Dataframes used for charts must be the result of real SQL or JSON-transformation logic. No "lorem ipsum" data in charts.
- **Semantic Mapping:** Charts must match data relationships:
    - *Temporal Data* → Line/Area charts.
    - *Correlation* → Scatter plots.
    - *Composition* → Pie charts (with Top 10 + Other logic).
- **No Empty States:** If data is missing, the system must explain *why* and provide a recovery path, not just show an empty box.

### 📝 B. Strategic Reporting & Insights
- **Contextual Synthesis:** Reports must summarize real metrics found in the dataset.
- **Agentic Accuracy:** AI-generated summaries must highlight anomalies and root causes, not just restate the obvious.
- **Fault-Tolerance:** As demonstrated in `otpService`, external service failures (like Email APIs) should never block core user flows (Registration/Login).

### 📑 C. Productivity Hub (Spreadsheets & Playground)
- **First-Principle Calculation:** Spreadsheet formulas and calculations must align 100% with the source database values.
- **Playground Logic:** The SQL playground must execute real-time queries with proper syntax highlighting and error feedback.

### 🔄 D. Automation Layer (Dataflows & Web Scraper)
- **Dataflow Integrity:** Nodes must represent real transformations (Filters, Joins, Cleaning). Version control (commits) must be tracked for every change.
- **Web Scraper Resilience:** Must handle dynamic selectors, maintain data schema consistency, and provide clear logs of the extraction process.

### 🛡️ E. Connection & Security (Connectors & DB)
- **Fraud-Proof Connection:** Database connectors must use secure, URL-encoded credentials and maintain stable connection pools.
- **Audit Trails:** Every major change to a dataset or dashboard must be versioned.

---

## 🌳 2. The "Tree & Branch" Validation Strategy

### 🌳 The Trunk: Agentic Coordination (High Priority)
- **No Confusion:** Verify that the AI-mediated "War Rooms" and Chats maintain chronological and contextual accuracy.
- **Coordination Speed:** Test for high-concurrency in group coordination without race conditions.

### 🌿 The Branches: Specialized Tools
- **Data Analyst Tools:** Verify the integrity of the cleaning engine, SQL generator, and automated chart suggester.
- **Non-Tech Accessibility:** Ensure the AI handles complexity in the middle so that non-technical users see only "Clear Work" and "Fast Execution."

---

## 🧪 3. Mandatory TestSprite Scenarios

| Scenario | Expected Outcome | First Principle |
| :--- | :--- | :--- |
| **Data Ingestion** | Schema detection + Domain recognition | Semantic Accuracy |
| **High Cardinality**| Auto-grouping into "Other" category | Visualization Clarity |
| **Service Failure** | Fallback to Terminal/Log (No 500 Error) | System Resilience |
| **Complex Search** | AI generates correct SQL for data extraction | Agentic Efficiency |
| **Data Cleaning** | Irreversible record of changes + Backup | Data Integrity |

---

## 🚀 4. Vision for Final Output
The app should feel like a **Reliable Enterprise Brain**. 
- **NO** "Cringe" AI moments where only a chat box is provided.
- **YES** to AI working in the middle to handle tasks, schedule meetings, and automate reports while the person maintains the final creative control.

**"If it's in the app, it's real. If it's real, it's correct."**
