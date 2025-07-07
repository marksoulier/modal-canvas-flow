import React, { useState, useRef } from 'react';
import { Menu, HelpCircle, Plus, Save, FileText, FolderOpen, User, List, Edit3 } from 'lucide-react';
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

import SubscriptionModal from '../components/SubscriptionModal';
import EventParameterForm from '../components/EventParameterForm';
import AddEnvelopeModal from '../components/AddEnvelopeModal';
import EnvelopeManagerModal from '../components/EnvelopeManagerModal';
import { Visualization } from '../visualization/Visualization';
import { usePlan } from '../contexts/PlanContext';
import ErrorToast from '../components/ErrorToast';
import PlanPreferencesModal from '../components/PlanPreferencesModal';

const Index = () => {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [eventLibraryOpen, setEventLibraryOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [planPreferencesModalOpen, setPlanPreferencesModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [eventParametersOpen, setEventParametersOpen] = useState(false);
  const [addEnvelopeModalOpen, setAddEnvelopeModalOpen] = useState(false);
  const [envelopeManagerModalOpen, setEnvelopeManagerModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Mock authentication state - replace with real auth logic
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { plan, loadPlanFromFile, savePlanToFile, updatePlanTitle } = usePlan();

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAnnotationClick = (eventId: number) => {
    setEditingEventId(eventId);
    setEventParametersOpen(true);
  };

  const handleExport = () => {
    savePlanToFile();
  };

  const handleOpen = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await loadPlanFromFile(file);
      } catch (error) {
        console.error('Error loading file:', error);
        // TODO: Show error toast
      }
    }
  };



  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(plan?.title || '');
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 10);
  };

  const handleTitleSave = () => {
    if (tempTitle.trim()) {
      updatePlanTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setTempTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleAccount = () => {
    if (isAuthenticated) {
      // TODO: Show account management or sign out
      setIsAuthenticated(false);
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Error Toast at the top */}
      <ErrorToast
        message={errorMessage}
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        onClick={() => { console.log("Error message clicked"); }}
      />
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Visualization as background layer */}
      <div className="absolute inset-0 z-0">
        <Visualization onAnnotationClick={handleAnnotationClick} />
      </div>

      {/* Overlay elements with higher z-index */}
      <div className="relative z-10">
        {/* Hamburger Menu and Title - Top Left */}
        <div className="absolute top-6 left-3 flex items-center gap-3">
          {/* Hamburger Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition-all duration-200">
                <Menu size={20} className="text-gray-700" />
              </button>
            </DropdownMenuTrigger>

            {/* Editable Title */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleTitleSave}
                    className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none min-w-[200px]"
                    placeholder="Enter plan title..."
                  />
                </div>
              ) : (
                <button
                  onClick={handleTitleClick}
                  className="group flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <h1 className="text-lg font-medium text-gray-400 group-hover:text-gray-600 transition-colors duration-200">
                    {plan?.title || 'Untitled Plan'}
                  </h1>
                  <Edit3 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </button>
              )}
            </div>
            <DropdownMenuContent className="w-56 bg-white border border-gray-200 shadow-lg ml-2">
              <DropdownMenuItem
                onClick={handleOpen}
                className="cursor-pointer"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSaveModalOpen(true)}
                className="cursor-pointer"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPlanPreferencesModalOpen(true)}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                Plan Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleAccount}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Help Button - Top Right */}
        <button
          onClick={() => setHelpModalOpen(true)}
          className="absolute top-6 right-6 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg shadow-sm transition-all duration-200"
        >
          <HelpCircle size={20} className="text-blue-600" />
        </button>

        {/* Add Event Button - Bottom Center */}
        <button
          onClick={() => setEventLibraryOpen(true)}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <Plus size={20} />
          Add Event
        </button>
      </div>

      {/* Modals */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      <SaveModal isOpen={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
      <EventLibraryModal
        isOpen={eventLibraryOpen}
        onClose={() => setEventLibraryOpen(false)}
        onEventAdded={(eventId) => {
          setEditingEventId(eventId);
          setEventParametersOpen(true);
        }}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={() => {
          setIsAuthenticated(true);
          setAuthModalOpen(false);
        }}
        onUpgrade={() => {
          setAuthModalOpen(false);
          setSubscriptionModalOpen(true);
        }}
      />

      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
      />
      <EventParameterForm
        isOpen={eventParametersOpen}
        onClose={() => {
          setEventParametersOpen(false);
          setEditingEventId(null);
        }}
        eventId={editingEventId!}
        onSelectEvent={(parentId) => {
          setEditingEventId(parentId);
          setEventParametersOpen(true);
        }}
      />
      <AddEnvelopeModal
        isOpen={addEnvelopeModalOpen}
        onClose={() => setAddEnvelopeModalOpen(false)}
      />
      <EnvelopeManagerModal
        isOpen={envelopeManagerModalOpen}
        onClose={() => setEnvelopeManagerModalOpen(false)}
      />
      <PlanPreferencesModal
        isOpen={planPreferencesModalOpen}
        onClose={() => setPlanPreferencesModalOpen(false)}
        onAddEvent={() => {
          setPlanPreferencesModalOpen(false);
          setEventLibraryOpen(true);
        }}
        onAddEnvelope={() => {
          setPlanPreferencesModalOpen(false);
          setAddEnvelopeModalOpen(true);
        }}
        onManageEnvelopes={() => {
          setPlanPreferencesModalOpen(false);
          setEnvelopeManagerModalOpen(true);
        }}
      />
    </div>
  );
};

export default Index;
