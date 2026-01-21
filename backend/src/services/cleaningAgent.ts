import { DataForensicsEngine, ForensicResult } from './dataForensicsEngine.js';
import { GroqService } from './groq.service.js';

/**
 * ProCleaningAgent - Orchestrates professional-level data cleaning
 */
export class ProCleaningAgent {

    /**
     * Deep analysis of any dataset using Forensics + AI
     */
    static async analyze(headers: string[], data: any[]): Promise<any> {
        console.log(`[ProCleaningAgent] Starting analysis for ${data.length} rows`);

        // Stage 1: Forensic Analysis (Universal)
        const forensics: ForensicResult = await DataForensicsEngine.analyze(headers, data, 1000);

        // Stage 2: Semantic Analysis (AI)
        // Sample for AI context (first 20 rows + middle 20 + last 20)
        const sample = [
            ...data.slice(0, 20),
            ...data.slice(Math.floor(data.length / 2), Math.floor(data.length / 2) + 20),
            ...data.slice(-20)
        ];

        const semanticInsights = await GroqService.analyzeSemantics(headers, sample, forensics);
        console.log(`[ProCleaningAgent] Semantic Analysis complete: ${semanticInsights.category}`);

        // Stage 3: Generate Master Rule Set
        const forensicRules = forensics.validationRules;
        const aiRules = await GroqService.generateAdvancedRules(headers, sample, semanticInsights);

        console.log(`[ProCleaningAgent] Rules generated: ${forensicRules.length} (Forensic) + ${aiRules.length} (AI)`);

        // Stage 4: Deduplicate and Merge Rules
        const masterRules = this.mergeRules(forensicRules, aiRules);

        // Stage 5: Final Pro Report
        return {
            insights: semanticInsights,
            forensics: forensics.summary,
            profiles: forensics.profiles,
            rules: masterRules,
            meta: {
                analyzedAt: new Date().toISOString(),
                datasetCategory: semanticInsights.category,
                datasetPurpose: semanticInsights.purpose
            }
        };
    }

    /**
     * Merge forensic rules with AI rules, prioritizing AI for semantic nuances
     */
    private static mergeRules(forensicRules: any[], aiRules: any[]): any[] {
        const merged = [...forensicRules];

        aiRules.forEach(aiRule => {
            // Check if a similar forensic rule exists (by column and description similarity)
            const duplicateIdx = merged.findIndex(fr =>
                (fr.column === aiRule.column && fr.description.toLowerCase().includes(aiRule.column.toLowerCase())) ||
                (fr.description.toLowerCase() === aiRule.description.toLowerCase())
            );

            if (duplicateIdx !== -1) {
                // If AI rule is more specific (has a healFunction or better reasoning), replace it
                if (aiRule.healFunction && !merged[duplicateIdx].healFunction) {
                    merged[duplicateIdx] = { ...merged[duplicateIdx], ...aiRule };
                } else {
                    // Just add if unique enough
                    merged.push({ ...aiRule, id: `ai_rule_${Math.random().toString(36).substr(2, 9)}` });
                }
            } else {
                merged.push({ ...aiRule, id: `ai_rule_${Math.random().toString(36).substr(2, 9)}` });
            }
        });

        return merged;
    }

    /**
     * Apply a fix rule to the entire dataset
     */
    static async applyFix(data: any[], rule: any, currentHeaders: string[]): Promise<{ data: any[], headers: string[], affected: number }> {
        let affected = 0;
        let newData = [...data];
        let newHeaders = [...currentHeaders];

        try {
            // If it's a removal rule
            if (rule.category === 'Removal' || rule.description.toLowerCase().includes('remove')) {
                // Handle deletion logic
                const result = this.handleDeletion(newData, rule, newHeaders);
                return { ...result, affected: result.affected };
            }

            // Normal healing logic
            const healFn = new Function('row', `try { ${rule.healFunction} } catch(e) {}`);
            const checkFn = rule.expression ? new Function('row', `try { return (${rule.expression}); } catch(e) { return true; }`) : null;

            newData.forEach(row => {
                const needsFix = checkFn ? !checkFn(row) : true;
                if (needsFix) {
                    const original = JSON.stringify(row);
                    healFn(row);
                    if (original !== JSON.stringify(row)) {
                        affected++;
                    }
                }
            });

            return { data: newData, headers: newHeaders, affected };
        } catch (e) {
            console.error('[ProCleaningAgent] Fix application failed:', e);
            return { data, headers: currentHeaders, affected: 0 };
        }
    }

    /**
     * Handle row/column deletion with proper shifting
     */
    private static handleDeletion(data: any[], rule: any, headers: string[]): { data: any[], headers: string[], affected: number } {
        let affected = 0;
        let newData = [...data];
        let newHeaders = [...headers];

        if (rule.column && rule.column !== '*' && headers.includes(rule.column)) {
            // Column deletion
            newData = newData.map(row => {
                const { [rule.column]: removed, ...rest } = row;
                return rest;
            });
            newHeaders = headers.filter(h => h !== rule.column);
            affected = 1;
        } else if (rule.expression) {
            // Row deletion based on expression
            const checkFn = new Function('row', `try { return (${rule.expression}); } catch(e) { return true; }`);
            const originalLen = newData.length;
            newData = newData.filter(row => checkFn(row));
            affected = originalLen - newData.length;
        }

        return { data: newData, headers: newHeaders, affected };
    }
}
