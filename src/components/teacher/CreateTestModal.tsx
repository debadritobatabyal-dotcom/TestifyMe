import React, { useState } from 'react';
import { Test, User, TestStatus, StudentSafeQuestion } from '../../types';
import { Storage } from '../../services/storage';
import { TestService } from '../../services/testService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Calendar, Clock, AlertTriangle, ShieldCheck, Settings } from 'lucide-react';

export interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User;
  onTestCreated: (test: Test) => void;
}

export const CreateTestModal: React.FC<CreateTestModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onTestCreated,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(40);

  // Question counts (Requirement 17 & 19)
  const [totalQuestions, setTotalQuestions] = useState<number>(40);
  const [arCount, setArCount] = useState<number>(5);
  const [mcqCount, setMcqCount] = useState<number>(35);

  // Scoring (Requirement 18)
  const [positiveMarks, setPositiveMarks] = useState<number>(1);
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState<boolean>(true);
  const [negativeMarks, setNegativeMarks] = useState<number>(0.25);

  // Advanced settings (Requirement 19)
  const [allowUnanswered, setAllowUnanswered] = useState<boolean>(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState<boolean>(true);
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(true);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [customAccessCode, setCustomAccessCode] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Dates
  const now = new Date();
  const defaultStartStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const defaultEndStr = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [startTimeStr, setStartTimeStr] = useState<string>(defaultStartStr);
  const [endTimeStr, setEndTimeStr] = useState<string>(defaultEndStr);

  const activeQuestions = Storage.getQuestions(teacher.id).filter(q => q.active);
  const availableAR = activeQuestions.filter(q => q.type === 'ASSERTION_REASON').length;
  const availableMCQ = activeQuestions.filter(q => q.type === 'MCQ').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a test name.');
      return;
    }

    if (totalQuestions !== arCount + mcqCount) {
      setError(`Total questions (${totalQuestions}) must equal Assertion–Reason (${arCount}) + MCQs (${mcqCount}).`);
      return;
    }

    // Availability validation (Requirement 17)
    if (availableAR < arCount || availableMCQ < mcqCount) {
      setError(
        `Insufficient questions in your question bank. You need at least ${arCount} Assertion–Reason questions (have ${availableAR}) and ${mcqCount} standard MCQs (have ${availableMCQ}) to generate this test. Please import or add questions to your question bank first.`
      );
      return;
    }

    const startTimestamp = new Date(startTimeStr).getTime();
    const endTimestamp = new Date(endTimeStr).getTime();

    if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
      setError('Please select valid start and end dates and times.');
      return;
    }

    if (startTimestamp >= endTimestamp) {
      setError('End date/time must be strictly after start date/time.');
      return;
    }

    // Generate clean unique access code / test code (Requirements 2 & 13)
    const accessCode =
      customAccessCode.trim().toUpperCase() ||
      TestService.generateUniqueTestCode(name);

    const now = Date.now();
    let initialStatus: TestStatus = 'scheduled';
    if (now >= startTimestamp && now <= endTimestamp) {
      initialStatus = 'active';
    } else if (now > endTimestamp) {
      initialStatus = 'closed';
    }

    // Sample questions from teacher bank and embed student-safe questions + answer keys
    const arQuestions = activeQuestions.filter(q => q.type === 'ASSERTION_REASON');
    const mcqQuestions = activeQuestions.filter(q => q.type === 'MCQ');

    const shuffledAR = [...arQuestions].sort(() => Math.random() - 0.5);
    const shuffledMCQ = [...mcqQuestions].sort(() => Math.random() - 0.5);
    const selectedAR = shuffledAR.slice(0, Math.min(arCount, arQuestions.length));
    const selectedMCQ = shuffledMCQ.slice(0, Math.min(mcqCount, mcqQuestions.length));
    const combinedQuestions = [...selectedAR, ...selectedMCQ];

    const safeQuestions: StudentSafeQuestion[] = combinedQuestions.map(q => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      assertion: q.assertion,
      reason: q.reason,
      options: q.options.map((opt: { id: string; text: string }) => ({ id: opt.id, text: opt.text })),
      marks: positiveMarks,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    const answerKeys: Record<string, string> = {};
    const explanations: Record<string, string> = {};
    combinedQuestions.forEach(q => {
      answerKeys[q.id] = q.correctAnswer;
      if (q.explanation) explanations[q.id] = q.explanation;
    });

    const newTest: Test = {
      id: `test-${Date.now().toString(36)}`,
      ownerId: teacher.id,
      name: name.trim(),
      description: description.trim(),
      durationMinutes,
      startTime: startTimestamp,
      endTime: endTimestamp,
      totalQuestions,
      assertionReasonCount: arCount,
      mcqCount,
      positiveMarks,
      negativeMarkingEnabled,
      negativeMarks: negativeMarkingEnabled ? negativeMarks : 0,
      allowUnanswered,
      randomizeQuestions,
      randomizeOptions,
      maxAttempts,
      accessCode,
      testCode: accessCode,
      status: initialStatus,
      isPublished: true,
      createdBy: teacher.id,
      createdAt: Date.now(),
      questions: safeQuestions,
      answerKeys,
      explanations,
    };

    Storage.saveTest(newTest, teacher.id);
    onTestCreated(newTest);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Examination"
      description="Configure your timed assessment, scoring scheme, and question distribution."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <Input
          label="Test Title"
          placeholder="e.g. Midterm Comprehensive Physics Examination"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        {/* Description */}
        <div className="space-y-1 text-left">
          <label className="font-heading font-bold text-[#332F3A]">Instructions</label>
          <textarea
            rows={2}
            className="w-full bg-white text-[#332F3A] rounded-[16px] border border-gray-300 p-2.5 text-xs focus:border-[#7C3AED]"
            placeholder="Exam instructions for students..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Question Distribution & Verification (Requirement 17) */}
        <div className="bg-[#FAF8FE] border border-purple-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-xs text-[#7C3AED] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
              Question Bank Distribution
            </span>
            <Badge variant="primary" size="sm">
              Total: {totalQuestions} Questions
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Assertion–Reason (${availableAR} in bank)`}
              type="number"
              min={0}
              value={arCount}
              onChange={e => {
                const val = parseInt(e.target.value) || 0;
                setArCount(val);
                setTotalQuestions(val + mcqCount);
              }}
            />

            <Input
              label={`Standard MCQs (${availableMCQ} in bank)`}
              type="number"
              min={0}
              value={mcqCount}
              onChange={e => {
                const val = parseInt(e.target.value) || 0;
                setMcqCount(val);
                setTotalQuestions(arCount + val);
              }}
            />
          </div>
        </div>

        {/* Timing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Duration (Mins)"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={e => setDurationMinutes(parseInt(e.target.value) || 40)}
            leftIcon={<Clock className="w-4 h-4" />}
            required
          />

          <Input
            label="Window Start"
            type="datetime-local"
            value={startTimeStr}
            onChange={e => setStartTimeStr(e.target.value)}
            leftIcon={<Calendar className="w-4 h-4" />}
            required
          />

          <Input
            label="Window End"
            type="datetime-local"
            value={endTimeStr}
            onChange={e => setEndTimeStr(e.target.value)}
            leftIcon={<Calendar className="w-4 h-4" />}
            required
          />
        </div>

        {/* Configurable Negative Marking (Requirement 18) */}
        <div className="border border-gray-200 rounded-2xl p-3.5 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-heading font-bold text-xs text-[#332F3A]">
                Negative Marking Scheme
              </span>
              <p className="text-[11px] text-[#635F69]">Deduct penalty marks for wrong selections</p>
            </div>
            <button
              type="button"
              onClick={() => setNegativeMarkingEnabled(!negativeMarkingEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 min-h-[28px] ${
                negativeMarkingEnabled ? 'bg-[#7C3AED]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  negativeMarkingEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Input
              label="Correct Answer (+)"
              type="number"
              step="0.5"
              min="0.5"
              value={positiveMarks}
              onChange={e => setPositiveMarks(parseFloat(e.target.value) || 1)}
            />

            <Input
              label="Incorrect Answer (-)"
              type="number"
              step="0.25"
              min="0"
              disabled={!negativeMarkingEnabled}
              value={negativeMarks}
              onChange={e => setNegativeMarks(parseFloat(e.target.value) || 0)}
            />

            <div className="space-y-1 text-left">
              <label className="text-xs font-heading font-bold text-[#332F3A]">Unanswered</label>
              <input
                className="w-full bg-gray-100 rounded-[16px] border border-gray-200 px-3 py-2 text-xs font-bold text-[#635F69] min-h-[44px]"
                value="0 Marks"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Additional Settings (Requirement 19) */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-2">
          <span className="font-heading font-bold text-xs text-[#332F3A] flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-[#7C3AED]" />
            Examination Settings
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={e => setRandomizeQuestions(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span>Randomize Questions</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeOptions}
                onChange={e => setRandomizeOptions(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span>Randomize Options</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowUnanswered}
                onChange={e => setAllowUnanswered(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span>Allow Unanswered</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Maximum Attempts"
            type="number"
            min={1}
            max={10}
            value={maxAttempts}
            onChange={e => setMaxAttempts(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />

          <Input
            label="Custom Access Code (Optional)"
            placeholder="Leave blank to auto-generate (e.g. CHEM-7X92)"
            value={customAccessCode}
            onChange={e => setCustomAccessCode(e.target.value.toUpperCase())}
          />
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit">
            Create Examination
          </Button>
        </div>
      </form>
    </Modal>
  );
};
