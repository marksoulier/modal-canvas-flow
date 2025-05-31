
import React from 'react';
import { X, BookOpen, MessageCircle, Mail } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
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
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Help & Support</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <button className="w-full flex items-center gap-3 p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <BookOpen size={20} className="text-blue-500" />
              <div>
                <div className="font-medium text-gray-900">Documentation</div>
                <div className="text-sm text-gray-500">Learn how to use the app</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <MessageCircle size={20} className="text-green-500" />
              <div>
                <div className="font-medium text-gray-900">Live Chat</div>
                <div className="text-sm text-gray-500">Chat with our support team</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Mail size={20} className="text-purple-500" />
              <div>
                <div className="font-medium text-gray-900">Email Support</div>
                <div className="text-sm text-gray-500">Send us an email</div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Need immediate assistance? Check our FAQ section.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpModal;
