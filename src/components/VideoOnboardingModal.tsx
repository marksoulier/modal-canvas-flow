import React from 'react';
import BaseVideoModal from './BaseVideoModal';
import { getAllVideos, onboardingVideoSegments } from '../data/videoLibrary';
import type { VideoSegment } from '../data/videoLibrary';

interface VideoOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    stageKey: string;
}

const VideoOnboardingModal: React.FC<VideoOnboardingModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    stageKey
}) => {
    // Get the video segment for this stage
    const videoSegment = onboardingVideoSegments.find(segment => segment.stageKey === stageKey);
    const segmentVideos = videoSegment ? videoSegment.videoIds.map(id => getAllVideos().find(v => v.id === id)).filter((video): video is NonNullable<typeof video> => video !== undefined) : [];

    if (!videoSegment || segmentVideos.length === 0) {
        return null;
    }

    return (
        <BaseVideoModal
            isOpen={isOpen}
            onClose={onClose}
            videos={segmentVideos}
            title={videoSegment.title}
            description={videoSegment.description}
            showSkipButton={true}
            onSkip={onComplete}
            showFinishButton={true}
            onFinish={onComplete}
            finishButtonText="Let's Go!"
            showProgressDots={true}
        />
    );
};

export default VideoOnboardingModal; 