/**
 * Source Classification Service
 * 
 * AI-powered classification of uploaded data to determine:
 * 1. What TYPE of data this is (invoice, sales, HR, etc.)
 * 2. What WORKFLOW is most appropriate
 * 3. What ENTITIES are detected (customer names, dates, amounts, etc.)
 * 
 * This is the FOUNDATION of the Intelligent Core Loop.
 */

import { config } from '../config.js';

// ============================================
// Type Definitions
// ============================================

export type SourceType =
    | 'invoice'
    | 'sales_data'
    | 'financial_report'
    | 'employee_roster'
    | 'customer_list'
    | 'inventory'
    | 'survey_results'
    | 'log_file'
    | 'time_series'
    | 'transaction_log'
    | 'product_catalog'
    | 'generic_dataset';

export type SuggestedWorkflow =
    | 'financial_analysis'
    | 'sales_insights'
    | 'hr_analytics'
    | 'inventory_management'
    | 'customer_intelligence'
    | 'operational_monitoring'
    | 'quick_exploration';

export interface DetectedEntity {
    name: string;
    column: string;
    confidence: number;
    examples: string[];
}

export interface SourceClassification {
    sourceType: SourceType;
    confidence: number; // 0-100
    reasoning: string;
    suggestedWorkflow: SuggestedWorkflow;
    detectedEntities: DetectedEntity[];
    keyInsights: string[];
    alternativeTypes: { type: SourceType; confidence: number }[];
}

// ============================================
// Classification Patterns
// ============================================

const CLASSIFICATION_PATTERNS: Record<SourceType, {
    keywords: string[];
    columnPatterns: RegExp[];
    valuePatterns: RegExp[];
    workflow: SuggestedWorkflow;
}> = {
    invoice: {
        keywords: ['invoice', 'bill', 'amount', 'due', 'paid', 'vendor', 'customer', 'total', 'tax', 'subtotal'],
        columnPatterns: [/invoice.*id/i, /bill.*no/i, /amount/i, /due.*date/i, /payment.*status/i],
        valuePatterns: [/INV-\d+/i, /BILL-\d+/i, /\$[\d,]+\.\d{2}/],
        workflow: 'financial_analysis'
    },
    sales_data: {
        keywords: ['sales', 'revenue', 'product', 'quantity', 'customer', 'order', 'unit', 'price', 'discount'],
        columnPatterns: [/sales/i, /revenue/i, /order.*id/i, /product/i, /quantity/i, /unit.*price/i],
        valuePatterns: [/ORD-\d+/i, /SKU-\d+/i],
        workflow: 'sales_insights'
    },
    financial_report: {
        keywords: ['balance', 'asset', 'liability', 'equity', 'profit', 'loss', 'income', 'expense', 'fiscal'],
        columnPatterns: [/account/i, /debit/i, /credit/i, /balance/i, /gl.*code/i],
        valuePatterns: [/\d{4}-\d{4}/], // Account codes
        workflow: 'financial_analysis'
    },
    employee_roster: {
        keywords: ['employee', 'staff', 'name', 'department', 'salary', 'hire', 'position', 'manager', 'email'],
        columnPatterns: [/employee.*id/i, /emp.*name/i, /department/i, /salary/i, /hire.*date/i, /manager/i],
        valuePatterns: [/EMP-\d+/i, /@[a-z]+\.[a-z]+/i], // Employee IDs, emails
        workflow: 'hr_analytics'
    },
    customer_list: {
        keywords: ['customer', 'client', 'contact', 'email', 'phone', 'address', 'company', 'account'],
        columnPatterns: [/customer.*id/i, /client.*name/i, /email/i, /phone/i, /address/i],
        valuePatterns: [/CUST-\d+/i, /@[a-z]+\.[a-z]+/i],
        workflow: 'customer_intelligence'
    },
    inventory: {
        keywords: ['stock', 'warehouse', 'sku', 'quantity', 'reorder', 'supplier', 'location', 'bin'],
        columnPatterns: [/sku/i, /stock/i, /warehouse/i, /quantity.*on.*hand/i, /reorder.*point/i],
        valuePatterns: [/SKU-\d+/i, /WH-\d+/i, /BIN-[A-Z]\d+/i],
        workflow: 'inventory_management'
    },
    survey_results: {
        keywords: ['response', 'rating', 'score', 'feedback', 'question', 'answer', 'likert', 'nps'],
        columnPatterns: [/q\d+/i, /question/i, /response/i, /rating/i, /score/i],
        valuePatterns: [/^[1-5]$/, /strongly agree/i, /satisfied/i],
        workflow: 'quick_exploration'
    },
    log_file: {
        keywords: ['timestamp', 'log', 'event', 'level', 'error', 'warning', 'info', 'debug', 'trace'],
        columnPatterns: [/timestamp/i, /log.*level/i, /event.*type/i, /message/i, /stack.*trace/i],
        valuePatterns: [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i, /ERROR|WARN|INFO|DEBUG/i],
        workflow: 'operational_monitoring'
    },
    time_series: {
        keywords: ['date', 'time', 'period', 'daily', 'monthly', 'trend', 'forecast', 'actual'],
        columnPatterns: [/date/i, /period/i, /month/i, /year/i, /week/i],
        valuePatterns: [/\d{4}-\d{2}-\d{2}/],
        workflow: 'quick_exploration'
    },
    transaction_log: {
        keywords: ['transaction', 'txn', 'transfer', 'debit', 'credit', 'account', 'reference'],
        columnPatterns: [/txn.*id/i, /transaction/i, /reference/i, /from.*account/i, /to.*account/i],
        valuePatterns: [/TXN-\d+/i, /REF-\d+/i],
        workflow: 'financial_analysis'
    },
    product_catalog: {
        keywords: ['product', 'item', 'category', 'price', 'description', 'brand', 'sku', 'upc'],
        columnPatterns: [/product.*id/i, /item.*name/i, /category/i, /price/i, /description/i],
        valuePatterns: [/PROD-\d+/i, /\d{12,13}/], // UPC codes
        workflow: 'inventory_management'
    },
    generic_dataset: {
        keywords: [],
        columnPatterns: [],
        valuePatterns: [],
        workflow: 'quick_exploration'
    }
};

// ============================================
// Entity Detection Patterns
// ============================================

const ENTITY_PATTERNS: { name: string; patterns: RegExp[]; columnHints: RegExp[] }[] = [
    {
        name: 'email_address',
        patterns: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/],
        columnHints: [/email/i, /e-mail/i, /contact/i]
    },
    {
        name: 'phone_number',
        patterns: [/^\+?[\d\s\-\(\)]{10,}$/],
        columnHints: [/phone/i, /mobile/i, /cell/i, /tel/i]
    },
    {
        name: 'currency_amount',
        patterns: [/^\$?[\d,]+\.?\d{0,2}$/, /^₹?[\d,]+\.?\d{0,2}$/, /^€?[\d,]+\.?\d{0,2}$/],
        columnHints: [/amount/i, /price/i, /cost/i, /revenue/i, /salary/i, /total/i]
    },
    {
        name: 'date',
        patterns: [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/],
        columnHints: [/date/i, /created/i, /updated/i, /due/i, /start/i, /end/i]
    },
    {
        name: 'percentage',
        patterns: [/^\d+\.?\d*%$/],
        columnHints: [/percent/i, /rate/i, /ratio/i, /growth/i, /discount/i]
    },
    {
        name: 'id_code',
        patterns: [/^[A-Z]{2,4}-\d{4,}$/i, /^[A-Z0-9]{8,}$/],
        columnHints: [/id/i, /code/i, /sku/i, /reference/i, /number/i]
    },
    {
        name: 'person_name',
        patterns: [/^[A-Z][a-z]+ [A-Z][a-z]+$/],
        columnHints: [/name/i, /employee/i, /customer/i, /contact/i, /manager/i]
    },
    {
        name: 'company_name',
        patterns: [/^[A-Z].*(?:Inc|LLC|Ltd|Corp|Co)\.*$/i],
        columnHints: [/company/i, /vendor/i, /supplier/i, /client/i, /organization/i]
    }
];

// ============================================
// Classification Logic
// ============================================

/**
 * Classify the source type of uploaded data based on column headers and sample values.
 * Uses a combination of heuristic pattern matching and (optionally) AI analysis.
 */
export async function classifySource(
    headers: string[],
    sampleData: any[],
    options: { useAI?: boolean } = {}
): Promise<SourceClassification> {
    const scores: Record<SourceType, number> = {} as any;

    // Initialize scores
    for (const type of Object.keys(CLASSIFICATION_PATTERNS) as SourceType[]) {
        scores[type] = 0;
    }

    const headersLower = headers.map(h => h.toLowerCase());
    const headersJoined = headersLower.join(' ');

    // Score based on column header keywords
    for (const [type, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
        for (const keyword of patterns.keywords) {
            if (headersJoined.includes(keyword)) {
                scores[type as SourceType] += 10;
            }
        }
        for (const pattern of patterns.columnPatterns) {
            for (const header of headers) {
                if (pattern.test(header)) {
                    scores[type as SourceType] += 15;
                }
            }
        }
    }

    // Score based on sample values
    const flatValues: string[] = [];
    for (const row of sampleData.slice(0, 50)) {
        for (const val of Object.values(row)) {
            if (val !== null && val !== undefined) {
                flatValues.push(String(val));
            }
        }
    }

    for (const [type, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
        for (const pattern of patterns.valuePatterns) {
            const matches = flatValues.filter(v => pattern.test(v)).length;
            scores[type as SourceType] += matches * 2;
        }
    }

    // Find the best match
    const sortedTypes = (Object.entries(scores) as [SourceType, number][])
        .sort((a, b) => b[1] - a[1]);

    const bestType = sortedTypes[0][0];
    const bestScore = sortedTypes[0][1];
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const confidence = Math.min(Math.round((bestScore / totalScore) * 100), 98);

    // Detect entities
    const detectedEntities = detectEntities(headers, sampleData);

    // Generate key insights
    const keyInsights = generateKeyInsights(headers, sampleData, bestType, detectedEntities);

    // Build response
    const classification: SourceClassification = {
        sourceType: bestType,
        confidence: confidence > 20 ? confidence : 0,
        reasoning: generateReasoning(bestType, headers, detectedEntities),
        suggestedWorkflow: CLASSIFICATION_PATTERNS[bestType].workflow,
        detectedEntities,
        keyInsights,
        alternativeTypes: sortedTypes.slice(1, 4).map(([type, score]) => ({
            type,
            confidence: Math.min(Math.round((score / totalScore) * 100), 95)
        }))
    };

    // If confidence is low and AI is enabled, use Groq for deeper analysis
    if (classification.confidence < 50 && options.useAI && config.groqApiKey) {
        return await enhanceWithAI(classification, headers, sampleData);
    }

    return classification;
}

/**
 * Detect entities (email, phone, currency, date, etc.) in the data
 */
function detectEntities(headers: string[], sampleData: any[]): DetectedEntity[] {
    const entities: DetectedEntity[] = [];

    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const columnValues = sampleData.slice(0, 20).map(row => {
            const vals = Object.values(row);
            return vals[i] !== undefined ? String(vals[i]) : '';
        }).filter(v => v.length > 0);

        for (const entityDef of ENTITY_PATTERNS) {
            // Check column name hints
            const nameMatch = entityDef.columnHints.some(p => p.test(header));

            // Check value patterns
            const valueMatches = columnValues.filter(v =>
                entityDef.patterns.some(p => p.test(v))
            );

            const matchRatio = valueMatches.length / (columnValues.length || 1);

            if (nameMatch || matchRatio > 0.5) {
                entities.push({
                    name: entityDef.name,
                    column: header,
                    confidence: Math.round((nameMatch ? 0.5 : 0) + (matchRatio * 0.5) * 100),
                    examples: valueMatches.slice(0, 3)
                });
                break; // Only one entity type per column
            }
        }
    }

    return entities;
}

/**
 * Generate key insights about the data
 */
function generateKeyInsights(
    headers: string[],
    sampleData: any[],
    sourceType: SourceType,
    entities: DetectedEntity[]
): string[] {
    const insights: string[] = [];

    // Row count insight
    insights.push(`Dataset contains ${sampleData.length}+ rows and ${headers.length} columns`);

    // Entity-based insights
    const dateEntities = entities.filter(e => e.name === 'date');
    if (dateEntities.length > 0) {
        insights.push(`Time-based data detected in "${dateEntities[0].column}" — trend analysis possible`);
    }

    const currencyEntities = entities.filter(e => e.name === 'currency_amount');
    if (currencyEntities.length > 0) {
        insights.push(`Financial metrics found in "${currencyEntities.map(e => e.column).join('", "')}" — aggregation recommended`);
    }

    const idEntities = entities.filter(e => e.name === 'id_code');
    if (idEntities.length > 0) {
        insights.push(`Unique identifiers detected in "${idEntities[0].column}" — can be used as primary key`);
    }

    // Type-specific insights
    switch (sourceType) {
        case 'invoice':
            insights.push('Suggested: Generate accounts receivable aging report');
            break;
        case 'sales_data':
            insights.push('Suggested: Create revenue trends and top products dashboard');
            break;
        case 'employee_roster':
            insights.push('Suggested: Build org chart and department headcount analysis');
            break;
        case 'inventory':
            insights.push('Suggested: Identify low-stock items and reorder recommendations');
            break;
    }

    return insights;
}

/**
 * Generate human-readable reasoning for the classification
 */
function generateReasoning(
    sourceType: SourceType,
    headers: string[],
    entities: DetectedEntity[]
): string {
    const entityNames = entities.map(e => e.name).join(', ');

    const reasons: Record<SourceType, string> = {
        invoice: `Detected invoice-related columns (${headers.slice(0, 3).join(', ')}) and financial entities (${entityNames || 'amounts, dates'})`,
        sales_data: `Found sales-related fields including product, quantity, and revenue indicators`,
        financial_report: `Recognized accounting structure with debit/credit or balance sheet patterns`,
        employee_roster: `Identified HR-related columns like employee names, departments, and compensation`,
        customer_list: `Detected customer/contact information including names, emails, and addresses`,
        inventory: `Found inventory management fields like SKU, quantity, and warehouse locations`,
        survey_results: `Recognized survey response patterns with ratings or Likert scale values`,
        log_file: `Detected log file structure with timestamps and event/level indicators`,
        time_series: `Found temporal patterns with date columns suitable for trend analysis`,
        transaction_log: `Identified transaction records with IDs, amounts, and reference codes`,
        product_catalog: `Recognized product catalog structure with items, categories, and pricing`,
        generic_dataset: `Structure doesn't match known patterns — treating as general-purpose data`
    };

    return reasons[sourceType];
}

/**
 * Enhance classification using Groq AI for low-confidence cases
 */
async function enhanceWithAI(
    initialClassification: SourceClassification,
    headers: string[],
    sampleData: any[]
): Promise<SourceClassification> {
    try {
        const sampleJson = JSON.stringify(sampleData.slice(0, 5), null, 2);

        const prompt = `You are a data analyst. Analyze this dataset and classify it.

COLUMN HEADERS: ${headers.join(', ')}

SAMPLE DATA (first 5 rows):
${sampleJson}

Classify this data into ONE of these types:
- invoice (bills, payments, accounts receivable)
- sales_data (orders, revenue, products sold)
- financial_report (balance sheets, P&L, accounting)
- employee_roster (HR data, staff lists, payroll)
- customer_list (contacts, clients, CRM data)
- inventory (stock levels, warehouses, SKUs)
- survey_results (feedback, ratings, questionnaires)
- log_file (system logs, event traces)
- time_series (metrics over time, trends)
- transaction_log (bank transactions, ledger entries)
- product_catalog (item listings, catalogs)
- generic_dataset (if none of the above)

Respond ONLY with valid JSON in this exact format:
{
  "sourceType": "the_type",
  "confidence": 85,
  "reasoning": "Brief explanation of why this classification was chosen"
}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            console.error('Groq API error in classification:', await response.text());
            return initialClassification;
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const aiResult = JSON.parse(jsonMatch[0]);
            return {
                ...initialClassification,
                sourceType: aiResult.sourceType || initialClassification.sourceType,
                confidence: aiResult.confidence || 75,
                reasoning: aiResult.reasoning || initialClassification.reasoning
            };
        }
    } catch (error) {
        console.error('AI classification enhancement failed:', error);
    }

    return initialClassification;
}

// ============================================
// Exports
// ============================================

export default {
    classifySource,
    detectEntities,
    CLASSIFICATION_PATTERNS,
    ENTITY_PATTERNS
};
