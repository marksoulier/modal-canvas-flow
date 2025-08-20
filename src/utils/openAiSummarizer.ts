import { supabase } from '../integrations/supabase/client';

export interface PlanNarrative {
    story: string;
    completeness_score: number;
}

export async function summarizePlanToNarrative(planDescription: string): Promise<PlanNarrative> {
    const systemPrompt = `You are a seasoned financial planner.
Write a concise, professional narrative (3-4 paragraphs) that synthesizes the user's provided plan description into
a story of their life stage, income, expenses, assets, debts, major events (past/upcoming), and retirement trajectory.
Include specific numbers and dates whenever they appear.
Avoid making up facts, and call out uncertainties or missing data explicitly.
Then, assess how complete the input seems on a scale of 1-100, where 100 means the plan is very detailed with amounts, dates, and envelopes,
and 1 means extremely vague.`;

    const userPrompt = `User-provided plan description:

${planDescription}

Tasks:
1) Produce a narrative summarizing their financial life and plan using the provided details only.
2) Provide a completeness score (1-100) for how granular and comprehensive the plan appears.`;

    try {
        const { data, error } = await supabase.functions.invoke('dynamic-action', {
            body: {
                messages: [
                    { role: "system", content: systemPrompt + "\n\nFormat your response as follows:\n[NARRATIVE]\n<your narrative here>\n[/NARRATIVE]\n[SCORE]<completeness score>[/SCORE]" },
                    { role: "user", content: userPrompt }
                ]
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
