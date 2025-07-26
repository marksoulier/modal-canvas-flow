import React, { useRef, useEffect } from 'react';

interface VideoPlayerProps {
    src: string;
    title?: string;
    className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, className = '' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.loop = true;
            videoRef.current.play().catch(console.error);
        }
    }, []);

    return (
        <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
            {title && (
                <div className="bg-gray-900 p-2">
                    <div className="text-white text-sm font-medium text-center">{title}</div>
                </div>
            )}

            <video
                ref={videoRef}
                src={src}
                className="w-full h-full"
                muted
                loop
                autoPlay
                playsInline
            />
        </div>
    );
};

export default VideoPlayer; 