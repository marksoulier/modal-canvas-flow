import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Play, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import ReactMarkdown from 'react-markdown';
import type { VideoItem } from '../data/videoLibrary';

interface BaseVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    videos: VideoItem[];
    title?: string;
    description?: string;
    showSkipButton?: boolean;
    onSkip?: () => void;
    showFinishButton?: boolean;
    onFinish?: () => void;
    finishButtonText?: string;
    showProgressDots?: boolean;
    onVideoComplete?: (videoId: string) => void;
}

const BaseVideoModal: React.FC<BaseVideoModalProps> = ({
    isOpen,
    onClose,
    videos,
    title,
    description,
    showSkipButton = false,
    onSkip,
    showFinishButton = false,
    onFinish,
    finishButtonText = "Complete",
    showProgressDots = true,
    onVideoComplete
}) => {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    const currentVideo = videos[currentVideoIndex];
    const isLastVideo = currentVideoIndex === videos.length - 1;

    useEffect(() => {
        if (isOpen) {
            setCurrentVideoIndex(0);
        }
    }, [isOpen]);

    const navigateToPrevious = () => {
        if (currentVideoIndex > 0) {
            setCurrentVideoIndex(prev => prev - 1);
        }
    };

    const navigateToNext = () => {
        if (currentVideoIndex < videos.length - 1) {
            setCurrentVideoIndex(prev => prev + 1);
        }
    };

    const handleFinish = () => {
        onFinish?.();
        onClose();
    };

    const handleSkip = () => {
        // Mark all videos as watched
        const allVideoIds = new Set(videos.map(v => v.id));
        onSkip?.();
        onClose();
    };

    if (videos.length === 0) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Play className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <div className="text-lg font-semibold">{title || currentVideo?.title}</div>
                            <div className="text-sm text-muted-foreground">{description}</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="h-full flex flex-col">
                    {/* Progress Header */}
                    <div className="flex justify-between items-center p-4 border-b bg-background">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">
                                Video {currentVideoIndex + 1} of {videos.length}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={navigateToPrevious}
                                disabled={currentVideoIndex === 0}
                                className="p-2 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Previous video (←)"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={navigateToNext}
                                disabled={currentVideoIndex === videos.length - 1}
                                className="p-2 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Next video (→)"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Video Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Video Player */}
                            <div className="flex justify-center">
                                <div className="w-full max-w-4xl">
                                    <VideoPlayer
                                        src={currentVideo?.videoSrc || ''}
                                        title={currentVideo?.title || ''}
                                        className="w-full aspect-video rounded-lg overflow-hidden shadow-lg"
                                    />
                                </div>
                            </div>

                            {/* Video Description */}
                            <div className="max-w-3xl mx-auto">
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>,
                                            h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground">{children}</h2>,
                                            h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
                                            p: ({ children }) => <p className="mb-3 text-muted-foreground leading-relaxed">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc list-inside space-y-2 mb-4 ml-4">{children}</ul>,
                                            li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                                            code: ({ children }) => <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{children}</code>,
                                            pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg text-sm mt-3 mb-3 overflow-x-auto">{children}</pre>,
                                            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4 bg-muted/30 py-2">{children}</blockquote>,
                                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                            em: ({ children }) => <em className="italic">{children}</em>
                                        }}
                                    >
                                        {currentVideo?.description || ''}
                                    </ReactMarkdown>
                                </div>

                                {/* Big Navigation Buttons */}
                                <div className="flex justify-between items-center mt-8 pt-6 border-t">
                                    <button
                                        onClick={navigateToPrevious}
                                        disabled={currentVideoIndex === 0}
                                        className="flex items-center gap-2 px-6 py-3 text-lg font-medium rounded-lg border-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Previous video (←)"
                                    >
                                        <ChevronLeft size={20} />
                                        Previous
                                    </button>

                                    {showFinishButton && isLastVideo ? (
                                        <button
                                            onClick={handleFinish}
                                            className="flex items-center gap-2 px-6 py-3 text-lg font-medium rounded-lg border-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                            {finishButtonText}
                                            <ChevronRight size={20} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={navigateToNext}
                                            disabled={currentVideoIndex === videos.length - 1}
                                            className="flex items-center gap-2 px-6 py-3 text-lg font-medium rounded-lg border-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Next video (→)"
                                        >
                                            Next
                                            <ChevronRight size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BaseVideoModal; 