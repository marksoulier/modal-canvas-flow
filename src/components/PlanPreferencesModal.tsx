import React, { useState, useRef } from 'react';
import { X, Plus, Wallet, List, Edit3 } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import DatePicker from './DatePicker';

interface PlanPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddEvent: () => void;
    onAddEnvelope: () => void;
    onManageEnvelopes: () => void;
}

const PlanPreferencesModal: React.FC<PlanPreferencesModalProps> = ({
    isOpen,
    onClose,
    onAddEvent,
    onAddEnvelope,
    onManageEnvelopes,
}) => {
    const { plan, updatePlanTitle, updateBirthDate } = usePlan();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

    const handleTitleClick = () => {
        setIsEditingTitle(true);
        setTempTitle(plan?.title || '');
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

    const handleBirthDateChange = (value: number) => {

        updateBirthDate(value);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Plan Preferences</DialogTitle>
                </DialogHeader>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Plan Title Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">Plan Title</h3>
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    onKeyDown={handleTitleKeyDown}
                                    onBlur={handleTitleSave}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter plan title..."
                                />
                            </div>
                        ) : (
                            <button
                                onClick={handleTitleClick}
                                className="group flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors duration-200"
                            >
                                <span className="text-lg font-medium">
                                    {plan?.title || 'Untitled Plan'}
                                </span>
                                <Edit3 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </button>
                        )}
                    </div>

                    {/* Birth Date Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">Birth Date</h3>
                        <DatePicker
                            value={0}
                            onChange={handleBirthDateChange}
                            birthDate={plan?.birth_date || ''}
                            placeholder="Select birth date"
                        />
                    </div>

                    {/* Main Events Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">Main Events</h3>
                        <div className="space-y-2">
                            {plan?.events && plan.events.length > 0 ? (
                                plan.events.map((event) => (
                                    <div
                                        key={event.id}
                                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                    >
                                        <div className="font-medium text-gray-900">{event.description}</div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Type: {event.type}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-gray-500 text-center py-4">
                                    No events added yet
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onAddEvent}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Add Event
                        </button>
                    </div>

                    {/* Envelopes Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">Envelopes</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={onAddEnvelope}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                <Wallet size={16} />
                                + Envelope
                            </button>
                            <button
                                onClick={onManageEnvelopes}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                <List size={16} />
                                Manage Envelopes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
                    >
                        Close
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PlanPreferencesModal; 