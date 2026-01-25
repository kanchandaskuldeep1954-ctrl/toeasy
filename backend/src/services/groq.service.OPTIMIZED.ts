// OPTIMIZED VERSION OF modifyReportWithAI
// Replace the existing method in groq.service.ts with this implementation

static async modifyReportWithAI(dataset: any, report: any, instruction: string): Promise < any > {
    try {
        const headers = dataset.headers || [];
        const kpiSummary = (report.sections || [])
            .flatMap((s: any) => s.kpis || [])
            .map((k: any) => `${k.label}: ${k.value}`)
            .slice(0, 20)
            .join(', ');

        const originalSections = report.sections || [];

        const groqPrompt = `You are a Senior Data Scientist. Modify this report based on user instructions.
    
    INSTRUCTION: "${instruction}"
    
    DATASET: ${dataset.data?.length || 0} rows, Columns: ${headers.slice(0, 15).join(', ')}
    KNOWN METRICS: ${kpiSummary}
    
    RULES:
    1. REAL DATA ONLY. Do not invent numbers.
    2. If asked for NEW sections (Risk, Predictive), add them.
    3. CRITICAL OPTIMIZATION: To save space, for ANY section that does NOT need changes, return EXACTLY: { "id": "section_id", "unchanged": true }
    4. Only return full content for NEW or MODIFIED sections.
    
    INPUT SECTIONS:
    ${JSON.stringify(originalSections.map((s: any) => ({ id: s.id, title: s.title, contentPreview: s.content.substring(0, 100) + "..." })))}
    
    RETURN ONLY JSON ARRAY (Sections):
    [
      { "id": "intro", "unchanged": true },
      { "id": "new_risk_section", "title": "Risk Analysis", "content": "..." }
    ]`;

        const result = await this.callGroq(groqPrompt, 7000);

        const modifiedSections = this.cleanAndParseJSON(result);

        if(!Array.isArray(modifiedSections) || modifiedSections.length === 0) {
    console.warn('Modify Report: AI returned invalid structure, reverting.', modifiedSections);
    return report;
}

// Merge Logic: Rehydrate "unchanged" sections
const mergedSections = modifiedSections.map((s: any) => {
    if (s.unchanged && s.id) {
        const original = originalSections.find((os: any) => os.id === s.id);
        return original || s;
    }
    return {
        ...s,
        id: s.id || `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        charts: s.charts || [],
        kpis: s.kpis || []
    };
});

return {
    ...report,
    sections: mergedSections,
    version: String(Number(report.version || "1.0") + 0.1)
};

  } catch (error) {
    console.error('Modify report error:', error);
    return report;
}
}
