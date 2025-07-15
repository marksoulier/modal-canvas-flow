import React, { useState, useRef } from 'react';
import type { Plan, Envelope } from '../contexts/PlanContext';
import { Menu, Plus, Save, FileText, FolderOpen, User, Edit3, HelpCircle } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
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
import UserAccountModal from '../components/UserAccountModal';
import EventParameterForm from '../components/EventParameterForm';
import EditEnvelopeModal from '../components/EditEnvelopeModal';
import EnvelopeManagerModal from '../components/EnvelopeManagerModal';
import { Visualization } from '../visualization/Visualization';
import { usePlan } from '../contexts/PlanContext';
import ErrorToast from '../components/ErrorToast';
import PlanPreferencesModal from '../components/PlanPreferencesModal';
import { extractSchema, validateProblem } from '../hooks/schemaChecker';

const Index = () => {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [eventLibraryOpen, setEventLibraryOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [planPreferencesModalOpen, setPlanPreferencesModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(true);
  const [userAccountModalOpen, setUserAccountModalOpen] = useState(false);
  const [eventParametersOpen, setEventParametersOpen] = useState(false);
  const [addEnvelopeModalOpen, setAddEnvelopeModalOpen] = useState(false);
  const [envelopeManagerModalOpen, setEnvelopeManagerModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [isAddingEnvelope, setIsAddingEnvelope] = useState(false);

  // Mock authentication state - replace with real auth logic
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { plan, schema, loadPlanFromFile, savePlanToFile, updatePlanTitle, loadPlan, lockPlan } = usePlan();

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAnnotationClick = (eventId: number) => {
    setEditingEventId(eventId);
    setEventParametersOpen(true);
  };

  // Use the context's savePlanToFile for export
  const handleExport = savePlanToFile;

  const handleOpen = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const planData = JSON.parse(text);

        // Validate before loading
        if (schema) {
          const schemaMap = extractSchema(schema);
          const issues = validateProblem(planData, schemaMap, schema, planData);
          if (issues.length > 0) {
            setErrorMessage(
              `File validation failed:\n${issues.join('\n')}`
            );
            setErrorOpen(true);
            console.error('File validation failed:', issues, planData);
            return; // Do not load invalid plan
          }
        }

        await loadPlanFromFile(file); // Only load if valid
      } catch (error) {
        setErrorMessage('Error loading file: ' + (error as Error).message);
        setErrorOpen(true);
        console.error('Error loading file:', error);
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
      setUserAccountModalOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUserAccountModalOpen(false);
  };

  // Handler to open EditEnvelopeModal for a specific envelope
  const handleOpenEnvelopeEditModal = (envelopeName: string) => {
    if (!plan) return;
    const envelope = plan.envelopes.find(e => e.name === envelopeName) || null;
    setEditingEnvelope(envelope);
    setAddEnvelopeModalOpen(true);
    setIsAddingEnvelope(false);
  };

  // Handler to open EditEnvelopeModal for adding a new envelope
  const handleAddEnvelope = () => {
    setEditingEnvelope(null);
    setAddEnvelopeModalOpen(true);
    setIsAddingEnvelope(true);
  };

  // Handler to save envelope (add or edit)
  const handleSaveEnvelope = (envelope: Envelope) => {
    if (!plan) return;
    let updatedEnvelopes;
    if (isAddingEnvelope) {
      updatedEnvelopes = [...plan.envelopes, envelope];
    } else if (editingEnvelope) {
      updatedEnvelopes = plan.envelopes.map(e => e === editingEnvelope ? envelope : e);
    } else {
      updatedEnvelopes = plan.envelopes;
    }
    // Save to plan
    const updatedPlan = { ...plan, envelopes: updatedEnvelopes };
    loadPlan(updatedPlan);
    setAddEnvelopeModalOpen(false);
    setEditingEnvelope(null);
    setIsAddingEnvelope(false);
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
              <button className="p-3 bg-white/90 backdrop-blur-sm hover:bg-white/95 rounded-lg shadow-sm border border-gray-100 transition-all duration-200">
                <Menu size={20} className="text-gray-600" />
              </button>
            </DropdownMenuTrigger>

            {/* Editable Title */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 px-3 py-2">
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
                  {/* Switch button next to input */}
                  <button
                    onClick={lockPlan}
                    title="Switch with locked plan"
                    className="ml-1 p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw size={18} className="text-gray-400 hover:text-gray-700" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTitleClick}
                    className="group flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                  >
                    <h1 className="text-lg font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-200">
                      {plan?.title || 'Untitled Plan'}
                    </h1>
                    <Edit3 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </button>
                  {/* Switch button next to title */}
                  <button
                    onClick={lockPlan}
                    title="Switch with locked plan"
                    className="ml-1 p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw size={18} className="text-gray-400 hover:text-gray-700" />
                  </button>
                </div>
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
                onClick={() => setHelpModalOpen(true)}
                className="cursor-pointer"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </DropdownMenuItem>
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

        {/* Add Event Button - Bottom Center (more subtle and higher up) */}
        <button
          onClick={() => setEventLibraryOpen(true)}
          className="fixed bottom-16 left-1/2 transform -translate-x-1/2 bg-[#03c6fc]/10 backdrop-blur-sm hover:bg-[#03c6fc]/20 text-slate-700 px-5 py-2.5 rounded-lg shadow-sm border border-[#03c6fc]/20 hover:border-[#03c6fc]/40 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={18} className="" />
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

      <UserAccountModal
        isOpen={userAccountModalOpen}
        onClose={() => setUserAccountModalOpen(false)}
        onSignOut={handleSignOut}
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
        onOpenEnvelopeModal={handleOpenEnvelopeEditModal}
      />
      <EditEnvelopeModal
        isOpen={addEnvelopeModalOpen}
        onClose={() => {
          setAddEnvelopeModalOpen(false);
          setEditingEnvelope(null);
          setIsAddingEnvelope(false);
        }}
        envelope={editingEnvelope ? { ...editingEnvelope, rate: editingEnvelope.rate ?? 0 } : null}
        onSave={handleSaveEnvelope}
      />
      <EnvelopeManagerModal
        isOpen={envelopeManagerModalOpen}
        onClose={() => setEnvelopeManagerModalOpen(false)}
        onEditEnvelope={(envelope) => {
          setEditingEnvelope(envelope);
          setAddEnvelopeModalOpen(true);
          setIsAddingEnvelope(false);
        }}
        onAddEnvelope={handleAddEnvelope}
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
          handleAddEnvelope();
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
