import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Plan, Envelope } from '../contexts/PlanContext';
import { Menu, Plus, Save, FileText, FolderOpen, User, Edit3, HelpCircle } from 'lucide-react';
import { RefreshCw, Copy } from 'lucide-react';
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
import DateRangePicker from '../components/DateRangePicker';
import { Visualization } from '../visualization/Visualization';
import { usePlan, getEnvelopeDisplayName } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import ErrorToast from '../components/ErrorToast';
import PlanPreferencesModal from '../components/PlanPreferencesModal';
import OnboardingFlow from '../components/OnboardingFlow';
import { extractSchema, validateProblem } from '../hooks/schemaChecker';
import { formatNumber } from '../visualization/viz_utils';
import PremiumConfirmationModal from '../components/PremiumConfirmationModal';
import ExitViewingModeDialog from '../components/ExitViewingModeDialog';

export default function Index() {
  // Auth context
  const { user, signOut: authSignOut, logAnonymousButtonClick } = useAuth();

  // Plan context
  const {
    plan,
    schema,
    loadPlanFromFile,
    savePlanToFile,
    updatePlanTitle,
    loadPlan,
    lockPlan,
    addEvent,
    copyPlanToLock,
    isExampleViewing
  } = usePlan();

  // Get onboarding state from localStorage first
  const hasCompletedOnboarding = Boolean(localStorage.getItem('onboarding-completed'));

  // Modal states
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [eventLibraryOpen, setEventLibraryOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn');
  const [planPreferencesModalOpen, setPlanPreferencesModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [userAccountModalOpen, setUserAccountModalOpen] = useState(false);
  const [eventParametersOpen, setEventParametersOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [addEnvelopeModalOpen, setAddEnvelopeModalOpen] = useState(false);
  const [envelopeManagerModalOpen, setEnvelopeManagerModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(!hasCompletedOnboarding && !isExampleViewing);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [isAddingEnvelope, setIsAddingEnvelope] = useState(false);
  const [premiumConfirmationOpen, setPremiumConfirmationOpen] = useState(false);

  // Add state for exit viewing mode dialog
  const [exitViewingModalOpen, setExitViewingModalOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Function to handle exiting viewing mode
  const handleExitViewingMode = () => {
    setIsExiting(true);
    // Remove URL parameters
    window.history.pushState({}, '', window.location.pathname);
    // Clear stored plans from localStorage
    localStorage.removeItem('user_plan_v1');
    localStorage.removeItem('user_plan_locked_v1');
    // Reload the page
    window.location.reload();
  };

  // Function to check if we should show exit dialog
  const checkViewingMode = (action: () => void) => {
    if (isExampleViewing) {
      setExitViewingModalOpen(true);
    } else {
      action();
    }
  };

  // Modify onboarding state to respect example viewing mode
  const showPostSignInModals = useCallback(() => {
    if (!localStorage.getItem('has-seen-subscription-modal')) {
      setUserAccountModalOpen(true);
      setSubscriptionModalOpen(true);
      localStorage.setItem('has-seen-subscription-modal', 'true');
    } else {
      setUserAccountModalOpen(true);
    }
  }, []);

  // Check for first Google sign-in on app startup
  useEffect(() => {
    const isFirstGoogleSignin = localStorage.getItem('first-google-signin');
    console.log('isFirstGoogleSignin', isFirstGoogleSignin);
    if (isFirstGoogleSignin === 'true' && user) {
      // Clear the flag immediately
      localStorage.removeItem('first-google-signin');
      // Show the subscription modal
      showPostSignInModals();
    }
  }, [user, showPostSignInModals]); // Depend on user state to ensure it runs when user is loaded

  // Check for Stripe return on app startup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Show the premium confirmation modal
      setPremiumConfirmationOpen(true);
    }
  }, []); // Empty dependency array means this runs once on mount

  const handleAnnotationClick = (eventId: number) => {
    setEditingEventId(eventId);
    setEventParametersOpen(true);
  };

  // Handle account warnings (negative non-debt accounts and positive debt accounts)
  const handleNegativeAccountWarning = (warnings: Array<{ envelopeName: string; category: string; minValue: number; date: number; warningType: 'negative' | 'positive' }>) => {
    if (warnings.length === 0) {
      // If no warnings, close the error modal if it's open
      if (errorOpen) {
        setErrorOpen(false);
      }
      return;
    }

    const negativeWarnings = warnings.filter(w => w.warningType === 'negative');
    const positiveWarnings = warnings.filter(w => w.warningType === 'positive');

    let message = '';

    if (negativeWarnings.length > 0 && positiveWarnings.length > 0) {
      // Both types of warnings
      const negativeMessages = negativeWarnings.map(warning =>
        `${getEnvelopeDisplayName(warning.envelopeName)}: ${formatNumber({ valueOf: () => warning.minValue })}`
      );
      const positiveMessages = positiveWarnings.map(warning =>
        `${getEnvelopeDisplayName(warning.envelopeName)}: ${formatNumber({ valueOf: () => warning.minValue })}`
      );
      message = `Warnings:\n${negativeWarnings.length} accounts go negative:\n${negativeMessages.join('\n')}\n\n${positiveWarnings.length} debt accounts go positive:\n${positiveMessages.join('\n')}`;
    } else if (negativeWarnings.length > 0) {
      // Only negative warnings
      const warningMessages = negativeWarnings.map(warning =>
        `${getEnvelopeDisplayName(warning.envelopeName)}: ${formatNumber({ valueOf: () => warning.minValue })}`
      );
      message = negativeWarnings.length === 1
        ? `Warning: ${warningMessages[0]} goes negative`
        : `Warning: ${negativeWarnings.length} accounts go negative:\n${warningMessages.join('\n')}`;
    } else if (positiveWarnings.length > 0) {
      // Only positive warnings
      const warningMessages = positiveWarnings.map(warning =>
        `${getEnvelopeDisplayName(warning.envelopeName)}: ${formatNumber({ valueOf: () => warning.minValue })}`
      );
      message = positiveWarnings.length === 1
        ? `Warning: ${warningMessages[0]} goes positive (debt should be negative)`
        : `Warning: ${positiveWarnings.length} debt accounts go positive:\n${warningMessages.join('\n')}`;
    }

    setErrorMessage(message);
    setErrorOpen(true);
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
    if (user) {
      showPostSignInModals();
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out from Index page...');
      await authSignOut();
      setUserAccountModalOpen(false);
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
    }
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

  // Modify the event library open handler
  const handleEventLibraryOpen = () => {
    checkViewingMode(() => setEventLibraryOpen(true));
  };

  // Modify the menu open handler
  const handleMenuClick = () => {
    checkViewingMode(() => setHelpModalOpen(true));
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
        <Visualization
          onAnnotationClick={handleAnnotationClick}
          onNegativeAccountWarning={handleNegativeAccountWarning}
        />
      </div>

      {/* Overlay elements with higher z-index */}
      <div className="relative z-10">
        {/* Date Range Picker - Top Right */}
        <DateRangePicker />

        {/* Hamburger Menu and Title - Top Left */}
        <div className="absolute top-6 left-3 flex items-center gap-3">
          {/* Hamburger Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-3 bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-gray-800 hover:border-gray-300 transition-all duration-200 z-50"
                onClick={(e) => {
                  if (isExampleViewing) {
                    e.preventDefault();
                    setExitViewingModalOpen(true);
                  }
                }}
              >
                <Menu size={20} />
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
                  {/* Copy and Switch buttons next to input */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={copyPlanToLock}
                      title="Copy current plan to locked plan"
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Copy size={18} className="text-gray-400 hover:text-gray-700" />
                    </button>
                    <button
                      onClick={lockPlan}
                      title="Switch with locked plan"
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <RefreshCw size={18} className="text-gray-400 hover:text-gray-700" />
                    </button>
                  </div>
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
                  {/* Copy and Switch buttons next to title */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={copyPlanToLock}
                      title="Copy current plan to locked plan"
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Copy size={18} className="text-gray-400 hover:text-gray-700" />
                    </button>
                    <button
                      onClick={lockPlan}
                      title="Switch with locked plan"
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <RefreshCw size={18} className="text-gray-400 hover:text-gray-700" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <DropdownMenuContent className="w-56 bg-white border border-gray-200 shadow-lg ml-2">
              <DropdownMenuItem
                onClick={() => checkViewingMode(handleOpen)}
                className="cursor-pointer"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => checkViewingMode(() => setSaveModalOpen(true))}
                className="cursor-pointer"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => checkViewingMode(() => setPlanPreferencesModalOpen(true))}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                Plan Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => checkViewingMode(() => setHelpModalOpen(true))}
                className="cursor-pointer"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => checkViewingMode(() => setOnboardingOpen(true))}
                className="cursor-pointer"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Onboarding
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => checkViewingMode(handleAccount)}
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
          onClick={async () => {
            if (logAnonymousButtonClick) {
              await logAnonymousButtonClick('add_event');
            }
            handleEventLibraryOpen();
          }}
          className="fixed bottom-16 left-1/2 transform -translate-x-1/2 bg-[#03c6fc]/10 backdrop-blur-sm hover:bg-[#03c6fc]/20 text-slate-700 px-5 py-2.5 rounded-lg shadow-sm border border-[#03c6fc]/20 hover:border-[#03c6fc]/40 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={18} className="" />
          Add Event
        </button>
      </div>

      {/* Modals */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onShowAuth={() => {
          setSaveModalOpen(false);
          setAuthModalOpen(true);
        }}
      />
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
          setAuthModalOpen(false);
          setTimeout(() => {
            showPostSignInModals();
          }, 100);
        }}
        mode={authModalMode}
        setMode={setAuthModalMode}
      />

      <UserAccountModal
        isOpen={userAccountModalOpen}
        onClose={() => setUserAccountModalOpen(false)}
        onSignOut={handleSignOut}
        onOpenSubscription={() => setSubscriptionModalOpen(true)}
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
        onAddEnvelope={handleAddEnvelope}
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
          handleEventLibraryOpen();
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

      {/* Onboarding Flow */}
      <OnboardingFlow
        isOpen={onboardingOpen}
        onComplete={() => {
          localStorage.setItem('onboarding-completed', 'true');
          setOnboardingOpen(false);
        }}
        onAuthRequired={() => {
          localStorage.setItem('onboarding-completed', 'true');
          setOnboardingOpen(false);
          setAuthModalMode('signUp'); // <-- set to sign up
          setAuthModalOpen(true);
        }}
        onAddEventAndEditParams={(eventType) => {
          const newId = addEvent(eventType);
          setEditingEventId(newId);
          setEventParametersOpen(true);
        }}
      />

      {/* Add PremiumConfirmationModal to the list of modals */}
      <PremiumConfirmationModal
        isOpen={premiumConfirmationOpen}
        onClose={() => setPremiumConfirmationOpen(false)}
      />

      {/* Add the ExitViewingModeDialog */}
      <ExitViewingModeDialog
        isOpen={exitViewingModalOpen}
        onClose={() => setExitViewingModalOpen(false)}
        onConfirm={handleExitViewingMode}
        isLoading={isExiting}
      />
    </div>
  );
};
