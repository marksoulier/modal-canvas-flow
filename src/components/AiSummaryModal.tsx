import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { summarizeRetirementPlan } from '../utils/planSummarizer';
import { summarizePlanToNarrative, type PlanNarrative, getAdvisorAdviceFromSummary } from '../utils/openAiSummarizer';

interface AiSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AiSummaryModal({ isOpen, onClose }: AiSummaryModalProps) {
    const { plan, schema } = usePlan();
    const [summary, setSummary] = useState<string>('');
    const [narrative, setNarrative] = useState<PlanNarrative | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [advisorAdvice, setAdvisorAdvice] = useState<{
        questions: string[];
        advice: { rank: number; action: string; rationale: string; sources: { name: string; url: string }[] }[];
    } | null>(null);
    const [isAdviceLoading, setIsAdviceLoading] = useState(false);

    const handleGenerateSummary = () => {
        if (!plan) {
            setSummary('No plan available to summarize.');
            return;
        }

        try {
            const planSummary = summarizeRetirementPlan(plan, schema);
            setSummary(planSummary);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating the summary');
            console.error('Error generating summary:', err);
        }
    };

    const handleGenerateNarrative = async () => {
        if (!summary) {
            setError('Please generate a plan summary first');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const aiNarrative = await summarizePlanToNarrative(summary, {
                model: 'gpt-5-nano',
                useWebSearch: false,
                reasoningEffort: 'minimal',
                verbosity: 'medium'
            });
            setNarrative(aiNarrative);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating the AI narrative');
            console.error('Error generating narrative:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGetAdvisorAdvice = async () => {
        if (!summary) {
            setError('Please generate a plan summary first');
            return;
        }

        setIsAdviceLoading(true);
        setError('');

        try {
            const advice = await getAdvisorAdviceFromSummary(summary, {
                model: 'gpt-5',
                useWebSearch: true,
                reasoningEffort: 'high',
                verbosity: 'medium'
            });
            setAdvisorAdvice(advice);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating advisor advice');
            console.error('Error generating advisor advice:', err);
        } finally {
            setIsAdviceLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>AI Plan Summary</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex gap-4">
                        <Button
                            onClick={handleGenerateSummary}
                            className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white"
                        >
                            Generate Plan Summary
                        </Button>

                        <Button
                            onClick={handleGenerateNarrative}
                            className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white"
                            disabled={!summary || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                'Generate AI Analysis'
                            )}
                        </Button>

                        <Button
                            onClick={handleGetAdvisorAdvice}
                            className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white"
                            disabled={!summary || isAdviceLoading}
                        >
                            {isAdviceLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching Advice...
                                </>
                            ) : (
                                'Get Advisor Advice'
                            )}
                        </Button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {summary && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Raw Plan Summary</h3>
                            <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap font-mono text-sm">
                                {summary}
                            </div>
                        </div>
                    )}

                    {narrative && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold">AI Financial Analysis</h3>
                                <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                                    Completeness Score: {narrative.completeness_score}/100
                                </span>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg prose prose-sm max-w-none">
                                {narrative.story.split('\n').map((paragraph, idx) => (
                                    <p key={idx}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {advisorAdvice && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-2">Top Financial Advisor Advice</h3>
                            {advisorAdvice.questions.length > 0 && (
                                <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
                                    <p className="font-medium mb-2">Missing details to clarify:</p>
                                    <ul className="list-disc pl-6 space-y-1">
                                        {advisorAdvice.questions.map((q, i) => (
                                            <li key={i}>{q}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <ol className="space-y-4 list-decimal pl-6">
                                {advisorAdvice.advice
                                    .sort((a, b) => a.rank - b.rank)
                                    .map((item, idx) => (
                                        <li key={idx} className="p-4 bg-gray-50 rounded-lg">
                                            <div className="font-semibold mb-1">{item.action}</div>
                                            <div className="text-sm text-gray-700 mb-2">{item.rationale}</div>
                                            {item.sources?.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="font-medium">Sources: </span>
                                                    <ul className="list-disc pl-5 mt-1 space-y-1">
                                                        {item.sources.map((s, si) => (
                                                            <li key={si}>
                                                                <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                                                    {s.name}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                            </ol>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
