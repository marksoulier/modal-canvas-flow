
import React, { useState } from 'react';
import { X, Download, Cloud, FileText } from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose }) => {
  const [selectedOption, setSelectedOption] = useState('');

  if (!isOpen) return null;

  const saveOptions = [
    {
      id: 'local',
      icon: Download,
      title: 'Save Locally',
      description: 'Download to your device',
      color: 'text-blue-500'
    },
    {
      id: 'cloud',
      icon: Cloud,
      title: 'Save to Cloud',
      description: 'Sync across all devices',
      color: 'text-green-500'
    },
    {
      id: 'export',
      icon: FileText,
      title: 'Export as File',
      description: 'Export in various formats',
      color: 'text-purple-500'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Save Options</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {saveOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full flex items-center gap-3 p-4 text-left border rounded-lg transition-colors ${
                  selectedOption === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <option.icon size={20} className={option.color} />
                <div>
                  <div className="font-medium text-gray-900">{option.title}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!selectedOption}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SaveModal;
