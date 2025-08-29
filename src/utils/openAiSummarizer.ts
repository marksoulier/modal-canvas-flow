import { supabase } from '../integrations/supabase/client';

export interface PlanNarrative {
    story: string;
    completeness_score: number;
}

export interface SummarizeOptions {
    model?: string;
    useWebSearch?: boolean;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
}

export interface AdvisorAdviceSource {
    name: string;
    url: string;
}

export interface AdvisorAdviceItem {
    rank: number;
    action: string;
    rationale: string;
    sources: AdvisorAdviceSource[];
}

export interface AdvisorAdvice {
    questions: string[];
    advice: AdvisorAdviceItem[];
}

export async function summarizePlanToNarrative(
    planDescription: string,
    options: SummarizeOptions = {}
): Promise<PlanNarrative> {
    const systemPrompt = `You are a seasoned financial planner analyzing a financial simulation output.

IMPORTANT CONTEXT ABOUT THE DATA FORMAT:
- This is output from a financial simulator that generates detailed plan structures
- The "Plan events (detailed)" section contains events with system-generated descriptions by default
- Generic descriptions like "Basic purchase or spending of money" or "Transfer money between envelopes" are system defaults
- Only specific, custom descriptions (like "Bought our home" or "First Job") indicate user-customized events
- The "Envelopes" section shows all financial accounts with their categories and growth rates
- The level of detail in event descriptions does NOT indicate the sophistication of the financial plan
- Focus on the actual financial data: amounts, dates, account balances, growth rates, and net worth progression

Write a concise, professional narrative (3-4 paragraphs) that synthesizes the user's provided plan description into
a story of their life stage, income, expenses, assets, debts, major events (past/upcoming), and retirement trajectory.
Include specific numbers and dates whenever they appear.
Avoid making up facts, and call out uncertainties or missing data explicitly.

Then, assess how complete the input seems on a scale of 1-100, where:
- 100: Very detailed with specific amounts, dates, account balances, growth rates, and clear financial trajectory
- 50: Moderate detail with some specific numbers but missing key financial elements
- 1: Extremely vague with minimal financial data or just system defaults

Focus your completeness assessment on the actual financial data quality, not the verbosity of event descriptions.`;

    const userPrompt = `User-provided plan description:

${planDescription}

Tasks:
1) Produce a narrative summarizing their financial life and plan using the provided details only.
2) Provide a completeness score (1-100) for how granular and comprehensive the plan appears.`;

    try {
        const { data, error } = await supabase.functions.invoke('openai-api', {
            body: {
                messages: [
                    { role: "system", content: systemPrompt + "\n\nFormat your response as follows:\n[NARRATIVE]\n<your narrative here>\n[/NARRATIVE]\n[SCORE]<completeness score>[/SCORE]" },
                    { role: "user", content: userPrompt }
                ],
                // Optional knobs forwarded to the Edge Function
                model: 'gpt-5-nano',
                use_web_search: false,
                reasoning_effort: 'low',
                verbosity: 'low'
            }
        });

        if (error) throw error;
        const response = data?.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }

        // Extract narrative and score using regex
        const narrativeMatch = response.match(/\[NARRATIVE\]([\s\S]*?)\[\/NARRATIVE\]/);
        const scoreMatch = response.match(/\[SCORE\](\d+)\[\/SCORE\]/);

        if (!narrativeMatch || !scoreMatch) {
            throw new Error('Invalid response format from OpenAI');
        }

        return {
            story: narrativeMatch[1].trim(),
            completeness_score: parseInt(scoreMatch[1])
        };
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        throw error;
    }
}

export async function getAdvisorAdviceFromSummary(
    aiSummary: string,
    options: SummarizeOptions = {}
): Promise<AdvisorAdvice> {
    const systemPrompt = `You are a fiduciary financial advisor. Your job is to recommend the highest-value next actions for a user based on their AI-generated plan summary.

Use up-to-date, authoritative sources when relevant, especially:
- IRS (irs.gov) for tax rules and tax-advantaged account limits
- Congress/Government publications (congress.gov, gpo.gov) for laws
- SSA (ssa.gov) for Social Security guidance
- FINRA/SEC (finra.org, sec.gov) for investment and regulatory guidance

Requirements:
1) Before giving advice, identify any missing user-specific details that materially affect recommendations (income thresholds, filing status, state residency, age, eligibility constraints, employer plan features, etc.).
2) Then provide a ranked list (1-5) of the top opportunities by expected financial value to the user. Rank 1 should provide the largest expected value, rank 5 the least.
3) Each item must include a short action title, a concise rationale tailored to the user's summary, and 2-4 authoritative sources with URLs. Prefer primary sources.
4) Output must be STRICT JSON, no markdown, no prose outside JSON.
5) JSON schema:
{
  "questions": string[],
  "advice": [
    {
      "rank": number,
      "action": string,
      "rationale": string,
      "sources": [{ "name": string, "url": string }] 
    }
  ]
}`;

    const userPrompt = `User AI Summary:\n\n${aiSummary}\n\nProduce the JSON exactly per the schema. If you need more info, include targeted questions in the 'questions' array.`;

    try {
        const { data, error } = await supabase.functions.invoke('openai-api', {
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: 'gpt-5-nano',
                use_web_search: true,
                reasoning_effort: 'low',
                verbosity: 'low'
            }
        });

        if (error) throw error;
        const response = data?.content;
        if (!response) throw new Error('No response from OpenAI');

        // Expect strict JSON; try to parse directly. If the model wrapped it, attempt to extract JSON block.
        let jsonText = response.trim();
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace > 0 || lastBrace !== jsonText.length - 1) {
            jsonText = jsonText.slice(firstBrace, lastBrace + 1);
        }

        const parsed = JSON.parse(jsonText) as AdvisorAdvice;

        // Basic validation
        if (!parsed || !Array.isArray(parsed.advice) || !Array.isArray(parsed.questions)) {
            throw new Error('Invalid JSON structure from OpenAI');
        }

        return parsed;
    } catch (error) {
        console.error('Error getting advisor advice:', error);
        throw error;
    }
}
