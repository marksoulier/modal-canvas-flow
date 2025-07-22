import React from 'react';
import { User, Repeat } from 'lucide-react';

interface TimelineAnnotationProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
  highlighted?: boolean;
  isRecurring?: boolean;
}

const TimelineAnnotation: React.FC<TimelineAnnotationProps> = ({ onClick, icon, label, highlighted, isRecurring }) => {
  return (
    <div
      className={`relative cursor-pointer`}
      onClick={onClick}
    >
      {/* Main rounded rectangle with icon */}
      <div className={`${highlighted ? 'bg-gray-200' : 'bg-white'} border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-3 w-12 h-12 flex flex-col items-center justify-center relative`}>
        {/* Recurring indicator at the bottom center */}
        {isRecurring && (
          <div className="absolute bottom-1 left-1/2 transform translate-x-2 -translate-y-7 z-0">
            <Repeat size={10} className="text-black" />
          </div>
        )}

        {/* Main icon on top layer */}
        <div className="relative z-10">
          {icon ? icon : <User size={20} className="text-gray-600" />}
        </div>
      </div>

      {/* Droplet connector */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2">
        <div className="w-1 h-1 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-300"></div>
      </div>
    </div>
  );
};

export default TimelineAnnotation;
