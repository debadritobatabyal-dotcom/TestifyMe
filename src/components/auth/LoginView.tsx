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
  ArrowLeft,
  X,
  ArrowRight,
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
  initialMode = 'register',
  isModal = false,
  onClose,
}) => {
  const [selectedPortal, setSelectedPortal] = useState<'landing' | 'student' | 'teacher'>(
    initialRole === 'teacher' ? 'teacher' : initialRole === 'student' ? 'student' : 'landing'
  );

  // Teacher mode: 'login' or 'register'
  const [teacherMode, setTeacherMode] = useState<'login' | 'register'>('login');
  // Student mode: 'login' or 'register' (default to initialMode or 'register' for first time students)
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
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your password.');
        setIsLoading(false);
        return;
      }

      const res = await AuthService.registerTeacher({
        name: teacherName,
        email,
        password,
        confirmPassword,
        schoolName: schoolName || undefined,
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

      const res = await AuthService.loginTeacher(email, password);
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

      const res = await AuthService.loginStudent(email, password);
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    }
  };

  // Content for the forms
  const formContent = (
    <div className="w-full">
      {/* 1. Landing Choice: Two Clear Options */}
      {selectedPortal === 'landing' && (
        <Card variant="elevated" padding="md" className="space-y-4 text-center">
          <h2 className="text-base font-heading font-extrabold text-[#332F3A]">
            Choose Portal to Continue
          </h2>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => { setSelectedPortal('student'); setError(null); }}
              className="w-full clay-card p-3.5 sm:p-4 flex items-center justify-between text-left hover:border-purple-500/40 transition-all min-h-[58px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-[#7C3AED] flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#332F3A]">Student Portal</h3>
                  <p className="text-[11px] sm:text-xs text-[#635F69]">Enter test code, take exams, and view scores</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#7C3AED] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => { setSelectedPortal('teacher'); setError(null); }}
              className="w-full clay-card p-3.5 sm:p-4 flex items-center justify-between text-left hover:border-purple-500/40 transition-all min-h-[58px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-100 text-[#DB2777] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#332F3A]">Teacher Portal</h3>
                  <p className="text-[11px] sm:text-xs text-[#635F69]">Faculty access for tests & question bank</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#DB2777] shrink-0" />
            </button>
          </div>
        </Card>
      )}

      {/* 2. Student Authentication Flow */}
      {selectedPortal === 'student' && (
        <Card variant="elevated" padding="md" className="space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            {!isModal ? (
              <button
                type="button"
                onClick={() => { setSelectedPortal('landing'); setError(null); }}
                className="inline-flex items-center gap-1 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portals</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-[#7C3AED]">
                <GraduationCap className="w-4 h-4" />
                <span>Student Access</span>
              </div>
            )}
            <span className="text-[11px] font-heading font-extrabold uppercase tracking-wider text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
              {studentMode === 'register' ? 'New Registration' : 'Student Login'}
            </span>
          </div>

          {/* Toggle Login vs Register */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-heading font-bold">
            <button
              type="button"
              onClick={() => { setStudentMode('login'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                studentMode === 'login' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69] hover:text-[#332F3A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setStudentMode('register'); setError(null); }}
              className={`py-2 rounded-xl transition-all ${
                studentMode === 'register' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69] hover:text-[#332F3A]'
              }`}
            >
              Register First
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

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
              label="Email Address"
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

            {/* Prominent, touch-friendly submit button */}
            <div className="pt-2 pb-1">
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
        </Card>
      )}

      {/* 3. Teacher Portal: Isolated Multi-Teacher Authentication */}
      {selectedPortal === 'teacher' && (
        <Card variant="elevated" padding="md" className="space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            {!isModal ? (
              <button
                type="button"
                onClick={() => { setSelectedPortal('landing'); setError(null); }}
                className="inline-flex items-center gap-1 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portals</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-[#DB2777]">
                <BookOpen className="w-4 h-4" />
                <span>Faculty Access</span>
              </div>
            )}
            <span className="text-[11px] font-heading font-extrabold uppercase tracking-wider text-[#DB2777] bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100">
              Teacher Portal
            </span>
          </div>

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
              New Teacher
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

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
                  placeholder="e.g. Department of Physics"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                />
              </>
            )}

            <Input
              label="Teacher Email Address"
              type="email"
              placeholder="teacher@example.com"
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

            <div className="pt-2 pb-1">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                className="py-3 text-sm font-bold shadow-md active:scale-[0.99] min-h-[46px]"
                isLoading={isLoading}
              >
                {teacherMode === 'register' ? 'Create Teacher Account' : 'Sign In as Faculty'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );

  // If rendered as a Modal
  if (isModal) {
    return (
      <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-2xl border border-purple-500/10 w-full flex flex-col overflow-hidden max-h-[88vh]">
        {/* Modal Top Header with Close Button */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-100 bg-[#FAF8FE] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center font-heading font-black text-sm">
              T
            </div>
            <div>
              <h2 className="text-sm font-heading font-black text-[#332F3A]">
                {studentMode === 'register' ? 'Student Registration' : 'Student Login'}
              </h2>
              <p className="text-[10px] text-[#635F69]">Quick sign-in to start your exam</p>
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
          {formContent}
        </div>
      </div>
    );
  }

  // Standalone Full-Page View
  return (
    <div className="min-h-screen bg-[#F4F1FA] flex flex-col justify-start sm:justify-center py-4 sm:py-8 px-3 sm:px-6 lg:px-8 overflow-y-auto">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-1.5 sm:space-y-2 pt-2 sm:pt-0">
        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white mx-auto shadow-md">
          <span className="font-heading font-black text-xl sm:text-2xl">T</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A] tracking-tight">
          Testify<span className="text-[#7C3AED]">Me</span>
        </h1>
        <p className="text-xs text-[#635F69] max-w-xs mx-auto">
          Private, secure examination platform for educators & students.
        </p>
      </div>

      <div className="mt-3.5 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md pb-8">
        {formContent}
      </div>
    </div>
  );
};
