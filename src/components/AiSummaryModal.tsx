import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { summarizeRetirementPlan } from '../utils/planSummarizer';
import { summarizePlanToNarrative, getAdvisorAdviceFromSummary } from '../utils/openAiSummarizer';

const DEBUG = false;

interface AiSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AiSummaryModal({ isOpen, onClose }: AiSummaryModalProps) {
    const { plan, schema } = usePlan();
    const [summary, setSummary] = useState<string>('');
    // Commented out for now: const [narrative, setNarrative] = useState<PlanNarrative | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [advisorAdvice, setAdvisorAdvice] = useState<{
        questions: string[];
        advice: { rank: number; action: string; rationale: string; sources: { name: string; url: string }[] }[];
    } | null>(null);
    const [isAdviceLoading, setIsAdviceLoading] = useState(false);
    // Commented out for now: const [aiQuestion, setAiQuestion] = useState<string>('');
    // Commented out for now: const [isAiQuestionLoading, setIsAiQuestionLoading] = useState(false);
    const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
            await summarizePlanToNarrative(summary, {
                model: 'gpt-5-nano',
                useWebSearch: false,
                reasoningEffort: 'minimal',
                verbosity: 'medium'
            });
            // setNarrative(aiNarrative); // Commented out for now
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

    const handleGetRecommendations = async () => {
        if (!plan) {
            setError('No plan available to generate recommendations.');
            return;
        }

        setIsRecommendationsLoading(true);
        setError('');
        setLoadingMessageIndex(0);

        const loadingMessages = [
            'Reading financial plan...',
            'Simulating financial forecast...',
            'Researching IRS tax law...',
            'Researching congress law...',
            'Optimizing plan...'
        ];

        // Start loading message rotation
        const messageInterval = setInterval(() => {
            setLoadingMessageIndex(prev => {
                const nextIndex = (prev + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[nextIndex]);
                return nextIndex;
            });
        }, 2000);

        try {
            // Generate plan summary
            const planSummary = summarizeRetirementPlan(plan, schema);
            setSummary(planSummary);

            // Get advisor advice based on the summary
            const advice = await getAdvisorAdviceFromSummary(planSummary, {
                model: 'gpt-5',
                useWebSearch: true,
                reasoningEffort: 'high',
                verbosity: 'medium'
            });
            setAdvisorAdvice(advice);

            // Clear any previous narrative from questions
            // setNarrative(null); // Commented out for now
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating recommendations');
            console.error('Error generating recommendations:', err);
        } finally {
            clearInterval(messageInterval);
            setIsRecommendationsLoading(false);
            setLoadingMessage('');
            setLoadingMessageIndex(0);
        }
    };

    // Commented out for now
    /*
    const handleAskAi = async () => {
        if (!aiQuestion.trim()) {
            setError('Please enter a question');
            return;
        }

        setIsAiQuestionLoading(true);
        setError('');

        try {
            // Generate plan summary if we don't have one yet
            let planContext = summary;
            if (!planContext && plan) {
                try {
                    planContext = summarizeRetirementPlan(plan, schema);
                    setSummary(planContext);
                } catch (err) {
                    console.warn('Could not generate plan summary for context:', err);
                }
            }

            // Combine the user's question with the plan context and instruction for short response
            const questionWithContext = planContext
                ? `Based on this financial plan:\n\n${planContext}\n\nUser question: ${aiQuestion}\n\nPlease provide a concise answer in 8 sentences or less.`
                : `User question: ${aiQuestion}\n\nPlease provide a concise answer in 8 sentences or less.`;

            const aiResponse = await summarizePlanToNarrative(questionWithContext, {
                model: 'gpt-5-nano',
                useWebSearch: false,
                reasoningEffort: 'minimal',
                verbosity: 'medium'
            });
            setNarrative(aiResponse);
            
            // Clear any previous advisor advice from recommendations
            setAdvisorAdvice(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while processing your question');
            console.error('Error processing AI question:', err);
        } finally {
            setIsAiQuestionLoading(false);
        }
    };
    */

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>AI Financial Assistant</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Debug Mode Controls */}
                    {DEBUG && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Debug Mode</h3>
                            <div className="flex gap-4">
                                <Button
                                    onClick={handleGenerateSummary}
                                    className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white text-sm"
                                >
                                    Generate Plan Summary
                                </Button>

                                <Button
                                    onClick={handleGenerateNarrative}
                                    className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white text-sm"
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
                                    className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white text-sm"
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
                        </div>
                    )}

                    {/* AI Recommendations */}
                    <div className="flex flex-col items-center space-y-6">
                        {/* AI Recommendations Button */}
                        <Button
                            onClick={handleGetRecommendations}
                            className="bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white px-8 py-3 text-lg rounded-full"
                            disabled={isRecommendationsLoading}
                        >
                            {isRecommendationsLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Generating Recommendations...
                                </>
                            ) : (
                                'AI Recommendations'
                            )}
                        </Button>

                        {/* Loading Messages */}
                        {isRecommendationsLoading && (
                            <div className="text-center">
                                <div className="text-sm text-gray-600 animate-pulse">
                                    {loadingMessage || 'Reading financial plan...'}
                                </div>
                            </div>
                        )}

                        {/* Commented out Ask AI Question Section for now */}
                        {/* 
                        <div className="flex items-center w-full max-w-2xl">
                            <div className="flex-1 border-t border-gray-300"></div>
                            <span className="px-4 text-sm text-gray-500">or</span>
                            <div className="flex-1 border-t border-gray-300"></div>
                        </div>

                        <div className="w-full max-w-2xl">
                            <h3 className="text-lg font-semibold text-center mb-4">Ask AI a Question</h3>
                            <div className="relative">
                                <textarea
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                    placeholder="Ask the AI a question about your financial plan..."
                                    className="w-full p-4 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#03c6fc] focus:border-transparent"
                                    rows={3}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAskAi();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleAskAi}
                                    disabled={!aiQuestion.trim() || isAiQuestionLoading}
                                    className="absolute right-2 bottom-2 p-2 bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        */}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Debug Mode Results */}
                    {DEBUG && summary && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Raw Plan Summary</h3>
                            <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap font-mono text-sm">
                                {summary}
                            </div>
                        </div>
                    )}

                    {/* AI Recommendations Results */}
                    {advisorAdvice && (
                        <div className="mt-6">
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

                    {/* Commented out AI Question Response for now */}
                    {/* 
                    {narrative && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold">AI Answer</h3>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                    Concise Response
                                </span>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg prose prose-sm max-w-none">
                                {narrative.story.split('\n').map((paragraph, idx) => (
                                    <p key={idx}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    */}
                </div>
            </DialogContent>
        </Dialog>
    );
}
