import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { summarizeRetirementPlan } from '../utils/planSummarizer';
import { summarizePlanToNarrative, type PlanNarrative } from '../utils/openAiSummarizer';

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
            const aiNarrative = await summarizePlanToNarrative(summary);
            setNarrative(aiNarrative);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating the AI narrative');
            console.error('Error generating narrative:', err);
        } finally {
            setIsLoading(false);
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
