import React from 'react';
import { LayoutDashboard, Database, PlusCircle } from 'lucide-react';

export interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'questions';
  onSelectTab: (tab: 'dashboard' | 'questions') => void;
  onOpenCreateTest: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateTest,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-purple-500/10 px-4 py-2 shadow-[0_-4px_16px_rgba(51,47,58,0.06)]">
      <div className="flex items-center justify-around">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors min-h-[44px] justify-center ${
            activeTab === 'dashboard' ? 'text-[#7C3AED]' : 'text-[#635F69]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-heading font-bold">Assessments</span>
        </button>

        {/* Center Create Test Button */}
        <button
          onClick={onOpenCreateTest}
          className="flex flex-col items-center gap-0.5 -mt-4 bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] text-white p-2.5 rounded-full shadow-[0_6px_16px_rgba(124,58,237,0.4)] active:scale-95 transition-transform"
          aria-label="Create examination"
        >
          <PlusCircle className="w-6 h-6" />
        </button>

        <button
          onClick={() => onSelectTab('questions')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors min-h-[44px] justify-center ${
            activeTab === 'questions' ? 'text-[#7C3AED]' : 'text-[#635F69]'
          }`}
        >
          <Database className="w-5 h-5" />
          <span className="text-[10px] font-heading font-bold">Questions</span>
        </button>
      </div>
    </nav>
  );
};
