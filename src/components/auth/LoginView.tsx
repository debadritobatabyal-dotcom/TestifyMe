import React, { useState } from 'react';
import { AuthService } from '../../services/authService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { GraduationCap, BookOpen, Mail, Lock, User as UserIcon, Hash, Phone, AlertCircle, ArrowLeft } from 'lucide-react';

export interface LoginViewProps {
  onLoginSuccess: () => void;
  initialRole?: 'student' | 'teacher';
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, initialRole = 'student' }) => {
  const [selectedPortal, setSelectedPortal] = useState<'landing' | 'student' | 'teacher'>(
    initialRole === 'teacher' ? 'teacher' : 'landing'
  );

  // Teacher mode: 'login' or 'register' (Requirement 1)
  const [teacherMode, setTeacherMode] = useState<'login' | 'register'>('login');
  // Student mode: 'login' or 'register'
  const [studentMode, setStudentMode] = useState<'login' | 'register'>('login');

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

  // Handle Teacher Login & Registration (Requirement 1)
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
      // First visit registration (Requirement 1 & 27)
      const res = await AuthService.registerStudent({
        name: fullName,
        studentId: rollNumber,
        email,
        password,
        phoneNumber: phone || undefined,
      });
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    } else {
      // Returning student login (Requirement 2 & 27)
      const res = await AuthService.loginStudent(email, password);
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onLoginSuccess();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1FA] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white mx-auto shadow-[0_8px_20px_-4px_rgba(124,58,237,0.35)]">
          <span className="font-heading font-black text-2xl">T</span>
        </div>

        <h1 className="text-3xl font-heading font-black text-[#332F3A] tracking-tight">
          Testify<span className="text-[#7C3AED]">Me</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#635F69] max-w-sm mx-auto">
          Private, secure, mobile-first examination platform for educators and students.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Landing Choice: Two Clear Options (Requirement 2) */}
        {selectedPortal === 'landing' && (
          <Card variant="elevated" padding="lg" className="space-y-4 text-center">
            <h2 className="text-base font-heading font-extrabold text-[#332F3A]">
              Choose Portal to Continue
            </h2>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => { setSelectedPortal('student'); setError(null); }}
                className="w-full clay-card p-4 flex items-center justify-between text-left hover:border-purple-500/40 transition-all min-h-[64px]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 text-[#7C3AED] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-[#332F3A]">Student Portal</h3>
                    <p className="text-xs text-[#635F69]">Enter test code, take exams, and view scores</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setSelectedPortal('teacher'); setError(null); }}
                className="w-full clay-card p-4 flex items-center justify-between text-left hover:border-purple-500/40 transition-all min-h-[64px]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-pink-100 text-[#DB2777] flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-[#332F3A]">Teacher Portal</h3>
                    <p className="text-xs text-[#635F69]">Faculty access for test creation, questions & results</p>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        )}

        {/* Student Authentication Flow */}
        {selectedPortal === 'student' && (
          <Card variant="elevated" padding="lg" className="space-y-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setSelectedPortal('landing'); setError(null); }}
                className="inline-flex items-center gap-1 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portals</span>
              </button>
              <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-[#7C3AED]">
                Student Portal
              </span>
            </div>

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

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStudentSubmit} className="space-y-3.5">
              {studentMode === 'register' && (
                <>
                  <Input
                    label="Full Name"
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    leftIcon={<UserIcon className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Student ID / Roll Number"
                    placeholder="e.g. ROLL-2026-44"
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value)}
                    leftIcon={<Hash className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Phone Number (Optional)"
                    placeholder="e.g. +1 555-0199"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    leftIcon={<Phone className="w-4 h-4" />}
                  />
                </>
              )}

              <Input
                label="Email Address"
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
              >
                {studentMode === 'register' ? 'Register & Save Profile' : 'Sign In to Student Portal'}
              </Button>
            </form>
          </Card>
        )}

        {/* Teacher Portal: Isolated Multi-Teacher Authentication (Requirement 1 & 2) */}
        {selectedPortal === 'teacher' && (
          <Card variant="elevated" padding="lg" className="space-y-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setSelectedPortal('landing'); setError(null); }}
                className="inline-flex items-center gap-1 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Portals</span>
              </button>
              <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-[#DB2777]">
                Teacher Portal
              </span>
            </div>

            {/* Toggle Login vs Register (Requirement 1) */}
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
                New Teacher Registration
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-heading font-extrabold text-[#332F3A]">
                {teacherMode === 'register' ? 'Create Teacher Workspace' : 'Sign In to Your Workspace'}
              </h2>
              <p className="text-xs text-[#635F69]">
                {teacherMode === 'register'
                  ? 'Register your isolated faculty workspace. Each teacher receives their own private question bank and examinations.'
                  : 'Access your private tests, question bank, and class analytics.'}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-3.5">
              {teacherMode === 'register' && (
                <>
                  <Input
                    label="Faculty Full Name"
                    placeholder="e.g. Dr. Arthur Vance"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    leftIcon={<UserIcon className="w-4 h-4" />}
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
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
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
                  required
                />
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
              >
                {teacherMode === 'register' ? 'Create Teacher Account' : 'Sign In as Faculty'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};
