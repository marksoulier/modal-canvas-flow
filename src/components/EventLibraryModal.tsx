import React, { useState } from 'react';
import { X, Search, Calendar } from 'lucide-react';
import { iconMap } from '../types/eventSchema';
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
  const { schema, addEvent } = usePlan();

  const categories = schema ? ['All', ...new Set(schema.events.map(event => event.category))] : [];

  const getIconComponent = (iconName: string) => {
    const lucideIconName = iconMap[iconName] || 'Circle';
    const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
    return <IconComponent size={20} />;
  };

  const filteredEvents = schema ? schema.events.filter(event => {
    const matchesSearch = event.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Event List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto h-full">
            <div className="p-4 space-y-3">
              {filteredEvents.map((event) => (
                <button
                  key={event.type}
                  onClick={() => setSelectedEvent(event.type)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedEvent === event.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-2 flex-shrink-0">
                      {getIconComponent(event.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{event.type}</h3>
                      <p className="text-sm text-gray-500 mt-1">{event.category}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Event Details */}
          <div className="w-1/2 p-6 overflow-y-auto">
            {selectedEvent ? (
              <div>
                {(() => {
                  const event = schema.events.find(e => e.type === selectedEvent);
                  if (!event) return null;

                  return (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          {getIconComponent(event.icon)}
                          <h3 className="text-2xl font-semibold text-gray-900">{event.type}</h3>
                        </div>
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                          {event.category}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                        <p className="text-gray-600 leading-relaxed">{event.description}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Parameters</h4>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <code className="text-sm text-gray-700 break-words">
                            {event.parameters.map(param => `${param.type}: ${param.description}`).join('\n')}
                          </code>
                        </div>
                      </div>

                      <button
                        onClick={handleAddEvent}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
