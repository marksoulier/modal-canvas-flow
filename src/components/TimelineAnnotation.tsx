import React from 'react';
import { User, Repeat, X } from 'lucide-react';

interface TimelineAnnotationProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  highlighted?: boolean;
  isRecurring?: boolean;
  isEnding?: boolean;
  isShadowMode?: boolean;
  iconSizePercent?: number; // 100 = full size, 50 = half size, etc.
  isRecurringInstance?: boolean;
}

const TimelineAnnotation: React.FC<TimelineAnnotationProps> = ({ onClick, icon, highlighted, isRecurring, isEnding, isShadowMode, iconSizePercent = 100, isRecurringInstance }) => {
  const renderedIcon = React.useMemo(() => {
    const colorClass = isShadowMode ? 'text-gray-400' : 'text-black';
    if (React.isValidElement(icon)) {
      const existingProps: any = (icon as any).props || {};
      const existingClass = existingProps.className || '';
      return React.cloneElement(icon as React.ReactElement, { className: `${existingClass} ${colorClass}`.trim() });
    }
    return <User size={20} className={colorClass} />;
  }, [icon, isShadowMode]);
  return (
    <div
      className={`relative ${isShadowMode ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={onClick}
    >
      {/* Main rounded rectangle with icon */}
      <div className={`${isShadowMode
        ? 'bg-transparent shadow-none'
        : `${highlighted ? 'bg-[#e6f8fd]' : 'bg-white'} shadow-md hover:shadow-lg transition-shadow duration-200`
        } border-2 ${isRecurringInstance ? 'border-dashed' : 'border-solid'} border-gray-300 rounded-lg p-3 w-12 h-12 flex flex-col items-center justify-center relative`}>
        {/* Recurring indicator at the bottom center - only show if not ending and not a generated recurring instance */}
        {isRecurring && !isEnding && !isRecurringInstance && (
          <div className="absolute bottom-1 left-1/2 transform translate-x-2 -translate-y-7 z-0">
            <Repeat size={10} className={`${isShadowMode ? 'text-gray-400' : 'text-black'}`} />
          </div>
        )}

        {/* Ending indicator at the bottom center */}
        {isEnding && (
          <div className="absolute bottom-1 left-1/2 transform translate-x-2 -translate-y-7 z-0">
            <X size={10} className={`${isShadowMode ? 'text-gray-400' : 'text-black'}`} />
          </div>
        )}

        {/* Main icon on top layer */}
        <div className="relative z-10">
          {renderedIcon}
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
