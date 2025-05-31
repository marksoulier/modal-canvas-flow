import React, { useState } from 'react';
import { Menu, HelpCircle, Plus, Save, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import HelpModal from '../components/HelpModal';
import SaveModal from '../components/SaveModal';
import EventLibraryModal from '../components/EventLibraryModal';
import AuthModal from '../components/AuthModal';
import SettingsModal from '../components/SettingsModal';
import SubscriptionModal from '../components/SubscriptionModal';

const Index = () => {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [eventLibraryOpen, setEventLibraryOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  // Mock authentication state - replace with real auth logic
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleExport = () => {
    // Export functionality - placeholder for now
    console.log('Exporting financial plan...');
  };

  const handleSettings = () => {
    if (isAuthenticated) {
      setSettingsModalOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Hamburger Dropdown Menu - Top Left */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="absolute top-6 left-6 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition-all duration-200 z-10">
            <Menu size={20} className="text-gray-700" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-white border border-gray-200 shadow-lg">
          <DropdownMenuItem 
            onClick={() => setEventLibraryOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setSaveModalOpen(true)}
            className="cursor-pointer"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleExport}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleSettings}
            className="cursor-pointer"
          >
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help Button - Top Right */}
      <button
        onClick={() => setHelpModalOpen(true)}
        className="absolute top-6 right-6 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg shadow-sm transition-all duration-200 z-10"
      >
        <HelpCircle size={20} className="text-blue-600" />
      </button>

      {/* Modals */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      <SaveModal isOpen={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
      <EventLibraryModal isOpen={eventLibraryOpen} onClose={() => setEventLibraryOpen(false)} />
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)}
        onSignIn={() => {
          setIsAuthenticated(true);
          setAuthModalOpen(false);
          setSettingsModalOpen(true);
        }}
        onUpgrade={() => {
          setAuthModalOpen(false);
          setSubscriptionModalOpen(true);
        }}
      />
      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)}
        onSignOut={() => {
          setIsAuthenticated(false);
          setSettingsModalOpen(false);
        }}
      />
      <SubscriptionModal 
        isOpen={subscriptionModalOpen} 
        onClose={() => setSubscriptionModalOpen(false)}
      />
    </div>
  );
};

export default Index;
