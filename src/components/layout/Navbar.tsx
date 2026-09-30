import React from 'react';
import { User } from '../../types';
import { AuthService } from '../../services/authService';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LogOut } from 'lucide-react';

export interface NavbarProps {
  currentUser: User | null;
  onNavigateHome: () => void;
  activeTeacherTab?: 'dashboard' | 'questions';
  onSelectTeacherTab?: (tab: 'dashboard' | 'questions') => void;
  onOpenTeacherProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onNavigateHome,
  activeTeacherTab,
  onSelectTeacherTab,
  onOpenTeacherProfile,
}) => {
  const handleLogout = () => {
    AuthService.logout();
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F4F1FA]/90 backdrop-blur-md border-b border-purple-500/10 px-4 sm:px-6 py-3 select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]">
            <span className="font-heading font-black text-lg">T</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-[#332F3A]">
                Testify<span className="text-[#7C3AED]">Me</span>
              </span>
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider bg-purple-100 text-[#7C3AED] px-1.5 py-0.5 rounded-md">
                Pro
              </span>
            </div>
          </div>
        </div>

        {/* Teacher Navigation Tabs (Desktop) */}
        {currentUser?.role === 'teacher' && onSelectTeacherTab && (
          <nav className="hidden md:flex items-center gap-1 bg-white/80 p-1 rounded-2xl border border-gray-200">
            <button
              onClick={() => onSelectTeacherTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all min-h-[36px] ${
                activeTeacherTab === 'dashboard'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-[#635F69] hover:text-[#332F3A]'
              }`}
            >
              Assessments
            </button>
            <button
              onClick={() => onSelectTeacherTab('questions')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all min-h-[36px] ${
                activeTeacherTab === 'questions'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-[#635F69] hover:text-[#332F3A]'
              }`}
            >
              Question Bank
            </button>
          </nav>
        )}

        {/* User Status & Sign Out */}
        {currentUser && (
          <div className="flex items-center gap-2">
            {currentUser.role === 'teacher' && onOpenTeacherProfile ? (
              <button
                onClick={onOpenTeacherProfile}
                className="text-right hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-2xl bg-white/60 hover:bg-white border border-gray-200/80 transition-all cursor-pointer"
                title="View & Edit Faculty Profile"
              >
                <div>
                  <span className="block font-heading font-bold text-xs text-[#332F3A] text-right">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-heading font-bold text-[#7C3AED] uppercase tracking-wide">
                    {currentUser.schoolName || 'Faculty Workspace'}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center font-heading font-black text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              </button>
            ) : (
              <div className="text-right hidden sm:block">
                <span className="block font-heading font-bold text-xs text-[#332F3A]">
                  {currentUser.name}
                </span>
                <Badge variant={currentUser.role === 'teacher' ? 'primary' : 'neutral'} size="sm">
                  {currentUser.role === 'teacher' ? 'Faculty' : currentUser.studentId || 'Student'}
                </Badge>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="w-4 h-4" />}
              onClick={handleLogout}
              className="min-h-[36px] px-2.5 text-xs font-heading font-bold"
              title="Sign Out"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
