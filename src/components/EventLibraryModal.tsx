
import React, { useState } from 'react';
import { X, Search, Calendar, Clock, MapPin, Users } from 'lucide-react';

interface EventLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EventLibraryModal: React.FC<EventLibraryModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const events = [
    {
      id: '1',
      title: 'Tech Conference 2024',
      category: 'Technology',
      date: 'March 15, 2024',
      time: '9:00 AM - 5:00 PM',
      location: 'San Francisco, CA',
      attendees: 500,
      description: 'Join industry leaders for the latest in technology trends and innovations.',
      color: 'bg-blue-500'
    },
    {
      id: '2',
      title: 'Design Workshop',
      category: 'Design',
      date: 'March 20, 2024',
      time: '2:00 PM - 6:00 PM',
      location: 'New York, NY',
      attendees: 50,
      description: 'Hands-on workshop covering modern design principles and tools.',
      color: 'bg-purple-500'
    },
    {
      id: '3',
      title: 'Marketing Summit',
      category: 'Business',
      date: 'March 25, 2024',
      time: '10:00 AM - 4:00 PM',
      location: 'Los Angeles, CA',
      attendees: 200,
      description: 'Learn the latest marketing strategies from top professionals.',
      color: 'bg-green-500'
    },
    {
      id: '4',
      title: 'Music Festival',
      category: 'Entertainment',
      date: 'April 1, 2024',
      time: '6:00 PM - 11:00 PM',
      location: 'Austin, TX',
      attendees: 2000,
      description: 'Three days of amazing music from local and international artists.',
      color: 'bg-orange-500'
    },
    {
      id: '5',
      title: 'Startup Pitch Night',
      category: 'Business',
      date: 'April 5, 2024',
      time: '7:00 PM - 10:00 PM',
      location: 'Seattle, WA',
      attendees: 100,
      description: 'Watch promising startups pitch their ideas to investors.',
      color: 'bg-red-500'
    },
    {
      id: '6',
      title: 'Art Exhibition',
      category: 'Arts',
      date: 'April 10, 2024',
      time: '11:00 AM - 8:00 PM',
      location: 'Chicago, IL',
      attendees: 300,
      description: 'Contemporary art exhibition featuring emerging artists.',
      color: 'bg-pink-500'
    }
  ];

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-xl shadow-xl max-w-4xl w-full h-[80vh] flex flex-col transform transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Event Library</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-gray-200">
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
          </div>

          {/* Content */}
          <div className="flex-1 flex">
            {/* Event List */}
            <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
              <div className="p-4 space-y-3">
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedEvent === event.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full ${event.color} mt-2 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{event.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{event.category}</p>
                        <p className="text-sm text-gray-500">{event.date}</p>
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
                    const event = events.find(e => e.id === selectedEvent);
                    if (!event) return null;
                    
                    return (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-4 h-4 rounded-full ${event.color}`} />
                            <h3 className="text-2xl font-semibold text-gray-900">{event.title}</h3>
                          </div>
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            {event.category}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-gray-600">
                            <Calendar size={18} />
                            <span>{event.date}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-gray-600">
                            <Clock size={18} />
                            <span>{event.time}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-gray-600">
                            <MapPin size={18} />
                            <span>{event.location}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-gray-600">
                            <Users size={18} />
                            <span>{event.attendees} attendees</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                          <p className="text-gray-600 leading-relaxed">{event.description}</p>
                        </div>

                        <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Add to Calendar
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
        </div>
      </div>
    </>
  );
};

export default EventLibraryModal;
