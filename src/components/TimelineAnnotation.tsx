
import React from 'react';
import { User } from 'lucide-react';

interface TimelineAnnotationProps {
  onClick?: () => void;
  className?: string;
}

const TimelineAnnotation: React.FC<TimelineAnnotationProps> = ({ onClick, className = '' }) => {
  return (
    <div 
      className={`relative cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* Main rounded rectangle with icon */}
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-3 w-12 h-12 flex items-center justify-center">
        <User size={20} className="text-gray-600" />
      </div>
      
      {/* Droplet connector */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2">
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-300"></div>
        <div className="w-1 h-4 bg-gray-300 mx-auto"></div>
        <div className="w-0 h-0 border-l-2 border-r-2 border-t-3 border-l-transparent border-r-transparent border-t-gray-300 mx-auto"></div>
      </div>
    </div>
  );
};

export default TimelineAnnotation;
