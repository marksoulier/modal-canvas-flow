import React, { useState } from 'react';
import { Search, Calendar, Plus } from 'lucide-react';
import { iconMap } from '../contexts/PlanContext';
import * as LucideIcons from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface EventLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: (eventId: number) => void;
  selectedDayOffset?: number; // Optional day offset from birth date
}

const EventLibraryModal: React.FC<EventLibraryModalProps> = ({ isOpen, onClose, onEventAdded, selectedDayOffset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const { schema, addEvent, getEventDisplayType, getEventDisclaimer, getParameterDisplayName, daysSinceBirthToDateString, plan, getEventOnboardingStage } = usePlan();
  const { onboarding_state, getOnboardingStateNumber } = useAuth();

  const categories = schema ? ['All', ...new Set(schema.events.map(event => event.category))] : [];

  const getIconComponent = (iconName: string) => {
    const lucideIconName = iconMap[iconName] || 'Circle';
    const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
    return <IconComponent size={20} />;
  };

  const filteredEvents = schema ? schema.events.filter(event => {
    if (event.display_event !== true) return false;

    // Check onboarding stage - only show events that are available at current onboarding stage
    const eventOnboardingStage = getEventOnboardingStage(event.type);
    if (eventOnboardingStage) {
      const eventStageNumber = getOnboardingStateNumber(eventOnboardingStage as any);
      const currentStageNumber = getOnboardingStateNumber(onboarding_state);
      if (eventStageNumber > currentStageNumber) {
        return false; // Event is not available at current onboarding stage
      }
    }

    const displayName = getEventDisplayType(event.type).toLowerCase();
    const matchesSearch = displayName.includes(searchTerm.toLowerCase()) ||
      event.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) : [];

  const handleAddEvent = () => {
    if (selectedEvent && plan) {
      // If we have a selectedDayOffset, convert it to a date string and pass it as a parameter override for start_time
      const parameterOverrides = selectedDayOffset !== undefined ? {
        start_time: daysSinceBirthToDateString(selectedDayOffset, plan.birth_date)
      } : undefined;
      const eventId = addEvent(selectedEvent, parameterOverrides);
      onEventAdded(eventId);
      onClose();
    }
  };

  if (!schema) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl w-full max-h-[90vh] md:h-[85vh] flex flex-col">
        <DialogHeader className="flex items-center justify-between p-2 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">Financial Life Events Library</DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="p-2 sm:p-3 border-b border-gray-200">
          <div className="flex items-start gap-3">
            {/* Search bar taking 40% width */}
            <div className="relative w-[40%]">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#03c6fc]" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#03c6fc] focus:border-transparent text-gray-900 bg-white text-sm"
              />
            </div>

            {/* Category Filter Buttons to the right */}
            <div className="flex-1 flex flex-wrap gap-1.5 items-center min-h-[38px]">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedCategory === category
                    ? ''
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  style={selectedCategory === category
                    ? { border: '1.5px solid #03c6fc', background: 'rgba(3,198,252,0.08)', color: '#222' }
                    : {}}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add some custom styles for hiding scrollbar */}
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Event List */}
          <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto h-[30vh] lg:h-full bg-white">
            <div className="p-2 sm:p-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {filteredEvents.map((event) => (
                  <button
                    key={event.type}
                    onClick={() => setSelectedEvent(event.type)}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-lg border transition-colors ${selectedEvent === event.type
                      ? ''
                      : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    style={selectedEvent === event.type
                      ? { borderColor: '#03c6fc', background: 'rgba(3,198,252,0.06)' }
                      : {}}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0 text-[#03c6fc]">
                        {getIconComponent(event.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm">{getEventDisplayType(event.type)}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{event.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div className="w-full lg:w-1/2 p-3 sm:p-4 overflow-y-auto bg-white">
            {selectedEvent ? (
              <div>
                {(() => {
                  const event = schema.events.find(e => e.type === selectedEvent);
                  if (!event) return null;
                  const disclaimer = getEventDisclaimer(event.type);
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[#03c6fc]">{getIconComponent(event.icon)}</span>
                            <h3 className="text-lg font-semibold text-gray-900">{getEventDisplayType(event.type)}</h3>
                          </div>
                          <span className="inline-block px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 font-medium text-xs sm:text-sm rounded-md">
                            {event.category}
                          </span>
                        </div>

                        {/* Add Event Button - Top Right */}
                        <button
                          onClick={handleAddEvent}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-[#03c6fc]/10 backdrop-blur-sm hover:bg-[#03c6fc]/20 text-slate-700 shadow-sm border border-[#03c6fc]/20 hover:border-[#03c6fc]/40 flex-shrink-0"
                          style={{ boxShadow: '0 2px 8px rgba(3,198,252,0.04)' }}
                        >
                          <Plus size={14} />
                          Add Event
                        </button>
                      </div>

                      {/* Disclaimer Box */}
                      {disclaimer && (
                        <button
                          type="button"
                          onClick={handleAddEvent}
                          className="w-full text-left bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm mt-2 transition hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-300 cursor-pointer"
                          tabIndex={0}
                        >
                          {disclaimer}
                        </button>
                      )}

                      {/* Event Description (no header) */}
                      <button
                        type="button"
                        onClick={handleAddEvent}
                        className="w-full text-left text-gray-700 leading-relaxed mt-2 bg-transparent border-none p-0 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#03c6fc] cursor-pointer rounded-md transition text-xs sm:text-sm"
                        tabIndex={0}
                      >
                        {event.description}
                      </button>

                      {/* Parameters List (user-friendly, no header) */}
                      <div className="mt-3 space-y-2">
                        {event.parameters.map(param => (
                          <button
                            key={param.type}
                            type="button"
                            onClick={handleAddEvent}
                            className="w-full text-left flex flex-col bg-gray-50 rounded-md px-3 py-2 border border-gray-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#03c6fc] cursor-pointer transition"
                            tabIndex={0}
                          >
                            <span className="font-medium text-gray-900 text-xs">{getParameterDisplayName(event.type, param.type)}</span>
                            <span className="text-gray-600 text-xs mt-0.5">{param.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select an event to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventLibraryModal;