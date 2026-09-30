import React, { useState } from 'react';
import { AuthService } from '../../services/authService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  GraduationCap,
  BookOpen,
  Mail,
  Lock,
  User as UserIcon,
  Hash,
  Phone,
  AlertCircle,
  X,
  Building,
} from 'lucide-react';

export interface LoginViewProps {
  onLoginSuccess: () => void;
  initialRole?: 'student' | 'teacher';
  initialMode?: 'login' | 'register';
  isModal?: boolean;
  onClose?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  initialRole = 'student',
  initialMode = 'login',
  isModal = false,
  onClose,
}) => {
  // Current active portal: 'student' or 'teacher'
  const [selectedPortal, setSelectedPortal] = useState<'student' | 'teacher'>(
    initialRole === 'teacher' ? 'teacher' : 'student'
  );

  // Modes for each portal
  const [teacherMode, setTeacherMode] = useState<'login' | 'register'>('login');
  const [studentMode, setStudentMode] = useState<'login' | 'register'>(initialMode);

  // Fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Teacher Login & Registration
  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (teacherMode === 'register') {
      if (!teacherName.trim()) {
        setError('Please enter your full name.');
        setIsLoading(false);
        return;
      }
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your password.');
        setIsLoading(false);
        return;
      }

      const res = await AuthService.registerTeacher({
        name: teacherName.trim(),
        email: email.trim(),
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
        schoolName: schoolName.trim() || undefined,
      });
      setIsLoading(false);

      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Please provide teacher email and password.');
        setIsLoading(false);
        return;
      }

      const res = await AuthService.loginTeacher(email.trim(), password.trim());
      setIsLoading(false);

      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    }
  };

  // Handle Student Login or Registration
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (studentMode === 'register') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        setIsLoading(false);
        return;
      }
      if (!rollNumber.trim()) {
        setError('Please enter your Student ID or Roll Number.');
        setIsLoading(false);
        return;
      }
      if (!email.trim() || !password.trim()) {
        setError('Please provide an email and password.');
        setIsLoading(false);
        return;
      }

      const res = await AuthService.registerStudent({
        name: fullName.trim(),
        studentId: rollNumber.trim().toUpperCase(),
        email: email.trim(),
        password: password.trim(),
        phoneNumber: phone.trim() || undefined,
      });
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your student email and password.');
        setIsLoading(false);
        return;
      }

      const res = await AuthService.loginStudent(email.trim(), password.trim());
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    }
  };

  const formCard = (
    <Card variant="elevated" padding="md" className="space-y-4">
      {/* Top Portal Switcher: Student vs Teacher */}
      <div className="grid grid-cols-2 p-1.5 bg-[#F4F1FA] rounded-2xl border border-purple-500/15 text-xs sm:text-sm font-heading font-extrabold shadow-inner">
        <button
          type="button"
          onClick={() => { setSelectedPortal('student'); setError(null); }}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
            selectedPortal === 'student'
              ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-md'
              : 'text-[#635F69] hover:text-[#332F3A]'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span>Student Portal</span>
        </button>
        <button
          type="button"
          onClick={() => { setSelectedPortal('teacher'); setError(null); }}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
            selectedPortal === 'teacher'
              ? 'bg-gradient-to-r from-[#DB2777] to-[#EC4899] text-white shadow-md'
              : 'text-[#635F69] hover:text-[#332F3A]'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Teacher Login</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STUDENT PORTAL FORM */}
      {selectedPortal === 'student' && (
        <div className="space-y-3.5">
          {/* Toggle Login vs Register */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-heading font-bold">
            <button
              type="button"
              onClick={() => { setStudentMode('login'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                studentMode === 'login' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
              }`}
            >
              Student Login
            </button>
            <button
              type="button"
              onClick={() => { setStudentMode('register'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                studentMode === 'register' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
              }`}
            >
              First-Time Register
            </button>
          </div>

          <form onSubmit={handleStudentSubmit} className="space-y-3">
            {studentMode === 'register' && (
              <>
                <Input
                  label="Full Name"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  autoComplete="name"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label="Student ID / Roll No"
                    placeholder="e.g. 2026-44"
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value)}
                    leftIcon={<Hash className="w-4 h-4" />}
                    autoCapitalize="characters"
                    required
                  />

                  <Input
                    label="Phone (Optional)"
                    placeholder="e.g. 9876543210"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    leftIcon={<Phone className="w-4 h-4" />}
                    autoComplete="tel"
                  />
                </div>
              </>
            )}

            <Input
              label="Student Email Address"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              inputMode="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete={studentMode === 'register' ? 'new-password' : 'current-password'}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                className="py-3 text-sm font-bold shadow-md active:scale-[0.99] min-h-[46px]"
                isLoading={isLoading}
              >
                {studentMode === 'register' ? 'Register & Start Exam →' : 'Sign In as Student →'}
              </Button>
            </div>
          </form>

          {/* Quick link to Teacher */}
          <div className="text-center pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setSelectedPortal('teacher'); setError(null); }}
              className="text-xs text-[#635F69] hover:text-[#DB2777] font-medium transition-colors"
            >
              Are you an educator? <strong className="text-[#DB2777]">Switch to Teacher Login →</strong>
            </button>
          </div>
        </div>
      )}

      {/* TEACHER PORTAL FORM */}
      {selectedPortal === 'teacher' && (
        <div className="space-y-3.5">
          {/* Toggle Login vs Register */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-heading font-bold">
            <button
              type="button"
              onClick={() => { setTeacherMode('login'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                teacherMode === 'login' ? 'bg-white text-[#DB2777] shadow-xs' : 'text-[#635F69]'
              }`}
            >
              Faculty Login
            </button>
            <button
              type="button"
              onClick={() => { setTeacherMode('register'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                teacherMode === 'register' ? 'bg-white text-[#DB2777] shadow-xs' : 'text-[#635F69]'
              }`}
            >
              New Teacher Register
            </button>
          </div>

          <form onSubmit={handleTeacherSubmit} className="space-y-3">
            {teacherMode === 'register' && (
              <>
                <Input
                  label="Faculty Full Name"
                  placeholder="e.g. Dr. Arthur Vance"
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  autoComplete="name"
                  required
                />

                <Input
                  label="Institution / Department (Optional)"
                  placeholder="e.g. Dept. of Physics / KV Delhi"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  leftIcon={<Building className="w-4 h-4" />}
                />
              </>
            )}

            <Input
              label="Teacher Email Address"
              type="email"
              placeholder="teacher@institution.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              inputMode="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete={teacherMode === 'register' ? 'new-password' : 'current-password'}
              required
            />

            {teacherMode === 'register' && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="new-password"
                required
              />
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                className="py-3 text-sm font-bold shadow-md bg-gradient-to-r from-[#DB2777] to-[#BE185D] hover:from-[#BE185D] hover:to-[#9D174D] active:scale-[0.99] min-h-[46px]"
                isLoading={isLoading}
              >
                {teacherMode === 'register' ? 'Create Teacher Workspace →' : 'Sign In as Faculty →'}
              </Button>
            </div>
          </form>

          {/* Quick link to Student */}
          <div className="text-center pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setSelectedPortal('student'); setError(null); }}
              className="text-xs text-[#635F69] hover:text-[#7C3AED] font-medium transition-colors"
            >
              Taking an exam as a Student? <strong className="text-[#7C3AED]">Switch to Student Portal →</strong>
            </button>
          </div>
        </div>
      )}
    </Card>
  );

  // If rendered as a Modal
  if (isModal) {
    return (
      <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-2xl border border-purple-500/10 w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Top Header with Close Button */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-100 bg-[#FAF8FE] shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-heading font-black text-sm text-white ${
              selectedPortal === 'teacher' ? 'bg-[#DB2777]' : 'bg-[#7C3AED]'
            }`}>
              T
            </div>
            <div>
              <h2 className="text-sm font-heading font-black text-[#332F3A]">
                {selectedPortal === 'teacher' ? 'Faculty Authentication' : 'Student Authentication'}
              </h2>
              <p className="text-[10px] text-[#635F69]">
                {selectedPortal === 'teacher' ? 'Access your teacher workspace' : 'Quick sign-in to start your exam'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-[#635F69] hover:bg-gray-200 hover:text-[#332F3A] flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 overscroll-contain flex-1">
          {formCard}
        </div>
      </div>
    );
  }

  // Standalone Full-Page View
  return (
    <div className="min-h-screen bg-[#F4F1FA] flex flex-col justify-start sm:justify-center py-4 sm:py-8 px-3 sm:px-6 lg:px-8 overflow-y-auto">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-1.5 sm:space-y-2 pt-2 sm:pt-0">
        <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white mx-auto shadow-md transition-colors ${
          selectedPortal === 'teacher'
            ? 'bg-gradient-to-tr from-[#DB2777] to-[#EC4899]'
            : 'bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6]'
        }`}>
          <span className="font-heading font-black text-xl sm:text-2xl">T</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A] tracking-tight">
          Testify<span className={selectedPortal === 'teacher' ? 'text-[#DB2777]' : 'text-[#7C3AED]'}>Me</span>
        </h1>
        <p className="text-xs text-[#635F69] max-w-xs mx-auto">
          Private, secure examination platform for educators & students.
        </p>
      </div>

      <div className="mt-3.5 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md pb-8">
        {formCard}
      </div>
    </div>
  );
};
