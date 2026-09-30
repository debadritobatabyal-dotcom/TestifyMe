import { useState, useEffect } from 'react';
import { User, Test } from './types';
import { AuthService } from './services/authService';
import { Navbar } from './components/layout/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { LoginView } from './components/auth/LoginView';
import { StudentDashboard } from './components/student/StudentDashboard';
import { TestAccessView } from './components/student/TestAccessView';
import { ExamInterface } from './components/student/ExamInterface';
import { DashboardOverview } from './components/teacher/DashboardOverview';
import { QuestionBankManager } from './components/teacher/QuestionBankManager';
import { TestResultsView } from './components/teacher/TestResultsView';
import { ClassAnalyticsView } from './components/teacher/ClassAnalyticsView';
import { CreateTestModal } from './components/teacher/CreateTestModal';
import { TeacherProfileModal } from './components/teacher/TeacherProfileModal';
import { ShieldAlert } from 'lucide-react';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => AuthService.getCurrentUser());
  const [teacherTab, setTeacherTab] = useState<'dashboard' | 'questions'>('dashboard');

  // Student navigation states
  const [studentActiveTest, setStudentActiveTest] = useState<Test | null>(null);
  const [testCodeToAccess, setTestCodeToAccess] = useState<string | null>(null);

  // Teacher navigation states
  const [isCreateTestOpen, setIsCreateTestOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [viewingResultsTest, setViewingResultsTest] = useState<Test | null>(null);
  const [viewingAnalyticsTest, setViewingAnalyticsTest] = useState<Test | null>(null);

  // Path detection for /teacher or /test/:code
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    return AuthService.subscribe(user => {
      setCurrentUser(user);
      setStudentActiveTest(null);
      // Preserve pending test code if user was redirected to login from a test link
      const pending = typeof window !== 'undefined' ? sessionStorage.getItem('testifyme_pending_test_code') : null;
      if (pending) {
        setTestCodeToAccess(pending.toUpperCase());
      }
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Direct test URL handling (e.g. /test/CLAS-FM5D or /test/chem-7x92 or ?code=CLAS-FM5D)
  useEffect(() => {
    let code: string | null = null;
    const match = currentPath.match(/^\/test\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      code = match[1].toUpperCase();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const queryCode = urlParams.get('code');
      if (queryCode) {
        code = queryCode.trim().toUpperCase();
      }
    }

    if (code) {
      sessionStorage.setItem('testifyme_pending_test_code', code);
      setTestCodeToAccess(code);
    }
  }, [currentPath]);

  // UNAUTHORIZED TEACHER ACCESS CHECK (Requirements 4 & 5)
  // If user navigates to /teacher without authenticated faculty educator credentials
  const isTeacherRoute = currentPath === '/teacher' || currentPath.startsWith('/teacher/');

  if (isTeacherRoute && (!currentUser || currentUser.role !== 'teacher')) {
    return (
      <div className="min-h-screen bg-[#F4F1FA] flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-heading font-black text-[#332F3A]">Access Denied</h1>
          <p className="text-xs sm:text-sm text-[#635F69] leading-relaxed">
            Unauthorized: The Teacher Portal is restricted to verified faculty members. Normal student accounts and unauthenticated users cannot access faculty endpoints or assessment records.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => {
                window.history.pushState({}, '', '/');
                setCurrentPath('/');
              }}
            >
              Return to Portal
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Active Test Code from state or session
  const pendingCode = testCodeToAccess || (typeof window !== 'undefined' ? sessionStorage.getItem('testifyme_pending_test_code') : null);
  const isTestLinkRoute = Boolean(currentPath.match(/^\/test\/([A-Za-z0-9_-]+)/) || new URLSearchParams(window.location.search).get('code') || pendingCode);
  const activeTestCode = pendingCode || (currentPath.match(/^\/test\/([A-Za-z0-9_-]+)/)?.[1]?.toUpperCase() ?? null);

  // If not logged in: Allow public test view, but require login to start exam (Requirements 8, 9, 10)
  if (!currentUser) {
    if (isTestLinkRoute && activeTestCode && !isTeacherRoute) {
      return (
        <div className="min-h-screen bg-[#F4F1FA] flex flex-col">
          <Navbar
            currentUser={null}
            onNavigateHome={() => {
              sessionStorage.removeItem('testifyme_pending_test_code');
              setTestCodeToAccess(null);
              window.history.pushState({}, '', '/');
              setCurrentPath('/');
            }}
          />
          <main className="flex-1">
            <TestAccessView
              testCode={activeTestCode}
              student={null}
              onStartExam={() => setIsLoginModalOpen(true)}
              onRequireLogin={() => setIsLoginModalOpen(true)}
              onBack={() => {
                sessionStorage.removeItem('testifyme_pending_test_code');
                setTestCodeToAccess(null);
                window.history.pushState({}, '', '/');
                setCurrentPath('/');
              }}
            />
          </main>

          {isLoginModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
              <div className="w-full max-w-md my-auto">
                <LoginView
                  initialRole="student"
                  initialMode="register"
                  isModal={true}
                  onClose={() => setIsLoginModalOpen(false)}
                  onLoginSuccess={() => {
                    setIsLoginModalOpen(false);
                    setCurrentUser(AuthService.getCurrentUser());
                    if (activeTestCode) {
                      setTestCodeToAccess(activeTestCode);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <LoginView
        initialRole={isTeacherRoute ? 'teacher' : 'student'}
        onLoginSuccess={() => {
          setCurrentUser(AuthService.getCurrentUser());
          setCurrentPath(window.location.pathname);
          const pending = sessionStorage.getItem('testifyme_pending_test_code');
          if (pending) {
            setTestCodeToAccess(pending.toUpperCase());
          }
        }}
      />
    );
  }

  // STUDENT WORKFLOW (Requirements 2, 21, 28)
  if (currentUser.role === 'student') {
    // 1. If actively taking exam, show distraction-free ExamInterface (Section 39)
    if (studentActiveTest) {
      return (
        <ExamInterface
          test={studentActiveTest}
          student={currentUser}
          onExit={() => setStudentActiveTest(null)}
        />
      );
    }

    // 2. If entered test code or via direct URL /test/:code
    if (testCodeToAccess) {
      return (
        <div className="min-h-screen bg-[#F4F1FA] flex flex-col">
          <Navbar
            currentUser={currentUser}
            onNavigateHome={() => {
              sessionStorage.removeItem('testifyme_pending_test_code');
              setTestCodeToAccess(null);
            }}
          />
          <main className="flex-1">
            <TestAccessView
              testCode={testCodeToAccess}
              student={currentUser}
              onStartExam={test => {
                sessionStorage.removeItem('testifyme_pending_test_code');
                setStudentActiveTest(test);
                setTestCodeToAccess(null);
              }}
              onBack={() => {
                sessionStorage.removeItem('testifyme_pending_test_code');
                setTestCodeToAccess(null);
                window.history.pushState({}, '', '/');
                setCurrentPath('/');
              }}
              onRequireLogin={() => setIsLoginModalOpen(true)}
            />
          </main>
        </div>
      );
    }

    // 3. Default: Student Dashboard
    return (
      <div className="min-h-screen bg-[#F4F1FA] flex flex-col">
        <Navbar
          currentUser={currentUser}
          onNavigateHome={() => {
            setStudentActiveTest(null);
            setTestCodeToAccess(null);
          }}
        />
        <main className="flex-1 pb-12">
          <StudentDashboard
            student={currentUser}
            onEnterTestCode={code => {
              const clean = code.trim().toUpperCase();
              sessionStorage.setItem('testifyme_pending_test_code', clean);
              setTestCodeToAccess(clean);
            }}
            onSelectTest={test => {
              const code = (test.testCode || test.accessCode).trim().toUpperCase();
              sessionStorage.setItem('testifyme_pending_test_code', code);
              setTestCodeToAccess(code);
            }}
          />
        </main>
      </div>
    );
  }

  // TEACHER WORKFLOW (Requirement 3, 23, 26)
  return (
    <div className="min-h-screen bg-[#F4F1FA] flex flex-col pb-20 md:pb-8">
      <Navbar
        currentUser={currentUser}
        onNavigateHome={() => {
          setViewingResultsTest(null);
          setViewingAnalyticsTest(null);
          setTeacherTab('dashboard');
        }}
        activeTeacherTab={teacherTab}
        onSelectTeacherTab={tab => {
          setViewingResultsTest(null);
          setViewingAnalyticsTest(null);
          setTeacherTab(tab);
        }}
        onOpenTeacherProfile={() => setIsProfileModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {viewingResultsTest ? (
          <TestResultsView
            test={viewingResultsTest}
            onBack={() => setViewingResultsTest(null)}
            onViewAnalytics={() => {
              setViewingAnalyticsTest(viewingResultsTest);
              setViewingResultsTest(null);
            }}
          />
        ) : viewingAnalyticsTest ? (
          <ClassAnalyticsView
            test={viewingAnalyticsTest}
            onBack={() => {
              setViewingResultsTest(viewingAnalyticsTest);
              setViewingAnalyticsTest(null);
            }}
          />
        ) : teacherTab === 'questions' ? (
          <QuestionBankManager teacher={currentUser} />
        ) : (
          <DashboardOverview
            teacher={currentUser}
            onOpenCreateTest={() => setIsCreateTestOpen(true)}
            onSelectTestResults={test => setViewingResultsTest(test)}
            onSelectTestAnalytics={test => setViewingAnalyticsTest(test)}
          />
        )}
      </main>

      {!viewingResultsTest && !viewingAnalyticsTest && (
        <MobileBottomNav
          activeTab={teacherTab}
          onSelectTab={tab => {
            setViewingResultsTest(null);
            setViewingAnalyticsTest(null);
            setTeacherTab(tab);
          }}
          onOpenCreateTest={() => setIsCreateTestOpen(true)}
        />
      )}

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={isCreateTestOpen}
        onClose={() => setIsCreateTestOpen(false)}
        teacher={currentUser}
        onTestCreated={test => {
          alert(`Test "${test.name}" created successfully!\nAccess Code: ${test.accessCode}`);
          setTeacherTab('dashboard');
        }}
      />

      {/* Teacher Profile & Workspace Identity Modal (Requirement 7) */}
      <TeacherProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        teacher={currentUser}
        onProfileUpdated={updated => setCurrentUser(updated)}
      />
    </div>
  );
}

export default App;
