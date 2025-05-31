
import React, { useState } from 'react';
import { Menu, Help, Plus, Save } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import HelpModal from '../components/HelpModal';
import SaveModal from '../components/SaveModal';
import EventLibraryModal from '../components/EventLibraryModal';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [eventLibraryOpen, setEventLibraryOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Hamburger Menu Button - Top Left */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="absolute top-6 left-6 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition-all duration-200 z-10"
      >
        <Menu size={20} className="text-gray-700" />
      </button>

      {/* Help Button - Top Right */}
      <button
        onClick={() => setHelpModalOpen(true)}
        className="absolute top-6 right-6 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg shadow-sm transition-all duration-200 z-10"
      >
        <Help size={20} className="text-blue-600" />
      </button>

      {/* Add Event Button - Center */}
      <button
        onClick={() => setEventLibraryOpen(true)}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 bg-green-500 hover:bg-green-600 rounded-xl shadow-lg transition-all duration-200 z-10"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Save Button - Bottom Left */}
      <button
        onClick={() => setSaveModalOpen(true)}
        className="absolute bottom-6 left-6 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg shadow-sm transition-all duration-200 z-10"
      >
        <Save size={20} className="text-purple-600" />
      </button>

      {/* Additional Add Event Button - Bottom Right */}
      <button
        onClick={() => setEventLibraryOpen(true)}
        className="absolute bottom-6 right-6 px-4 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-all duration-200 z-10 text-white font-medium text-sm"
      >
        Add Event
      </button>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Modals */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      <SaveModal isOpen={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
      <EventLibraryModal isOpen={eventLibraryOpen} onClose={() => setEventLibraryOpen(false)} />
    </div>
  );
};

export default Index;
