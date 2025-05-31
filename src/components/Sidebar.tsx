
import React from 'react';
import { X, Settings, User, Bell, Palette, Info } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-200"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide px-3 py-2">
              General
            </h3>
            
            <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={18} />
              <span>Preferences</span>
            </button>
            
            <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <User size={18} />
              <span>Account</span>
            </button>
            
            <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={18} />
              <span>Notifications</span>
            </button>
          </div>

          <div className="space-y-1 pt-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide px-3 py-2">
              Appearance
            </h3>
            
            <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Palette size={18} />
              <span>Theme</span>
            </button>
          </div>

          <div className="space-y-1 pt-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide px-3 py-2">
              Support
            </h3>
            
            <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Info size={18} />
              <span>About</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
