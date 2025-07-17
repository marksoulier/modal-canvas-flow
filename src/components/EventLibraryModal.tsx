import React, { useState } from 'react';
import { X, Search, Calendar } from 'lucide-react';
import { iconMap } from '../contexts/PlanContext';
import * as LucideIcons from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
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
}

const EventLibraryModal: React.FC<EventLibraryModalProps> = ({ isOpen, onClose, onEventAdded }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const { schema, addEvent, getEventDisplayType, getEventDisclaimer, getParameterDisplayName } = usePlan();

  const categories = schema ? ['All', ...new Set(schema.events.map(event => event.category))] : [];

  const getIconComponent = (iconName: string) => {
    const lucideIconName = iconMap[iconName] || 'Circle';
    const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
    return <IconComponent size={20} />;
  };

  const filteredEvents = schema ? schema.events.filter(event => {
    if (event.display_event !== true) return false;
    const displayName = getEventDisplayType(event.type).toLowerCase();
    const matchesSearch = displayName.includes(searchTerm.toLowerCase()) ||
      event.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) : [];

  const handleAddEvent = () => {
    if (selectedEvent) {
      const eventId = addEvent(selectedEvent);
      onEventAdded(eventId);
      onClose();
    }
  };

  if (!schema) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[85vh] flex flex-col">
        <DialogHeader className="flex items-center justify-between p-6 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">Financial Life Events Library</DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#03c6fc]" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#03c6fc] focus:border-transparent text-gray-900 bg-white"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategory === category
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

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Event List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto h-full bg-white">
            <div className="p-4 space-y-3">
              {filteredEvents.map((event) => (
                <button
                  key={event.type}
                  onClick={() => setSelectedEvent(event.type)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedEvent === event.type
                    ? ''
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  style={selectedEvent === event.type
                    ? { borderColor: '#03c6fc', background: 'rgba(3,198,252,0.06)' }
                    : {}}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-2 flex-shrink-0 text-[#03c6fc]">
                      {getIconComponent(event.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{getEventDisplayType(event.type)}</h3>
                      <p className="text-sm text-gray-500 mt-1">{event.category}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Event Details */}
          <div className="w-1/2 p-6 overflow-y-auto bg-white">
            {selectedEvent ? (
              <div>
                {(() => {
                  const event = schema.events.find(e => e.type === selectedEvent);
                  if (!event) return null;
                  const disclaimer = getEventDisclaimer(event.type);
                  return (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[#03c6fc]">{getIconComponent(event.icon)}</span>
                          <h3 className="text-2xl font-semibold text-gray-900">{getEventDisplayType(event.type)}</h3>
                        </div>
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 font-medium text-[0.95rem] rounded-md">
                          {event.category}
                        </span>
                      </div>

                      {/* Disclaimer Box */}
                      {disclaimer && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md px-4 py-3 text-sm mt-2">
                          {disclaimer}
                        </div>
                      )}

                      {/* Event Description (no header) */}
                      <p className="text-gray-700 leading-relaxed mt-2">{event.description}</p>

                      {/* Parameters List (user-friendly, no header) */}
                      <div className="mt-4 space-y-3">
                        {event.parameters.map(param => (
                          <div key={param.type} className="flex flex-col bg-gray-50 rounded-md px-4 py-2 border border-gray-100">
                            <span className="font-medium text-gray-900 text-sm">{getParameterDisplayName(event.type, param.type)}</span>
                            <span className="text-gray-600 text-sm mt-0.5">{param.description}</span>
                          </div>
                        ))}
                      </div>

                      {/* Add Event Button - More Subtle and Higher Up */}
                      <button
                        onClick={handleAddEvent}
                        className="w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm mt-4 bg-[#03c6fc]/10 backdrop-blur-sm hover:bg-[#03c6fc]/20 text-slate-700 shadow-sm border border-[#03c6fc]/20 hover:border-[#03c6fc]/40"
                        style={{ boxShadow: '0 2px 8px rgba(3,198,252,0.04)' }}
                      >
                        Add Event
                      </button>
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
