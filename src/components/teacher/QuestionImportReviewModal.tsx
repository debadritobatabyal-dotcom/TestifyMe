import React, { useState } from 'react';
import { ImportedQuestionCandidate, ParseReport, Question, QuestionType } from '../../types';
import { Storage } from '../../services/storage';
import { ASSERTION_REASON_OPTIONS } from '../../services/questionParserService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AlertTriangle, Trash2, Edit3, Check } from 'lucide-react';

export interface QuestionImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ParseReport | null;
  teacherId?: string;
  onPublished: (count: number) => void;
}

export const QuestionImportReviewModal: React.FC<QuestionImportReviewModalProps> = ({
  isOpen,
  onClose,
  report,
  teacherId = '',
  onPublished,
}) => {
  const [candidates, setCandidates] = useState<ImportedQuestionCandidate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sync state when report opens
  React.useEffect(() => {
    if (report) {
      setCandidates([...report.candidates]);
    }
  }, [report]);

  if (!report) return null;

  const validCount = candidates.filter(c => c.isValid).length;
  const needsReviewCount = candidates.filter(c => !c.isValid).length;

  const handleUpdateCandidate = (updated: ImportedQuestionCandidate) => {
    // Re-validate candidate
    const isNowValid =
      Boolean(updated.correctAnswer) &&
      (updated.type === 'MCQ'
        ? Boolean(updated.questionText) && updated.options.filter(o => o.text.trim()).length >= 2
        : Boolean(updated.assertion) && Boolean(updated.reason));

    const finalCandidate: ImportedQuestionCandidate = {
      ...updated,
      isValid: isNowValid,
      validationMessage: isNowValid ? undefined : 'Correct answer and required text must be filled.',
    };

    setCandidates(prev => prev.map(c => (c.id === updated.id ? finalCandidate : c)));
    setEditingId(null);
  };

  const handleDeleteCandidate = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  const handlePublishAllValid = () => {
    const validQuestions: Question[] = candidates
      .filter(c => c.isValid)
      .map(c => ({
        id: `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        ownerId: teacherId,
        type: c.type,
        questionText: c.questionText,
        assertion: c.assertion,
        reason: c.reason,
        options: c.options,
        correctAnswer: c.correctAnswer,
        marks: c.marks || 1,
        explanation: c.explanation,
        subject: c.subject || 'General',
        chapter: c.chapter || '',
        topic: c.topic || '',
        difficulty: c.difficulty || 'medium',
        active: true,
        createdAt: Date.now(),
      }));

    if (validQuestions.length === 0) {
      alert('Please fix or review invalid questions before publishing.');
      return;
    }

    Storage.addQuestionsBulk(validQuestions, teacherId);
    onPublished(validQuestions.length);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Imported Questions"
      description="Inspect, correct, and verify questions before publishing them to the active Question Bank."
      maxWidth="2xl"
    >
      <div className="space-y-5 py-2">
        {/* Import Summary Statistics (Section 13) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
            <span className="text-xl font-heading font-black text-[#332F3A]">
              {candidates.length}
            </span>
            <span className="block text-[11px] font-heading font-bold text-[#635F69]">
              Imported Total
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <span className="text-xl font-heading font-black text-emerald-700">
              {validCount}
            </span>
            <span className="block text-[11px] font-heading font-bold text-emerald-800">
              ✓ Valid
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <span className="text-xl font-heading font-black text-amber-700">
              {needsReviewCount}
            </span>
            <span className="block text-[11px] font-heading font-bold text-amber-800">
              Needs Review
            </span>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
            <span className="text-xl font-heading font-black text-[#7C3AED]">
              {report.duplicateCount}
            </span>
            <span className="block text-[11px] font-heading font-bold text-purple-900">
              Duplicates
            </span>
          </div>
        </div>

        {needsReviewCount > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>{needsReviewCount} questions require teacher review</strong> (e.g. missing answer key in source or incomplete options). Select the correct answer or edit to validate them.
            </span>
          </div>
        )}

        {/* Question Candidate List */}
        <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1">
          {candidates.map((c, index) => {
            const isEditing = editingId === c.id;

            return (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border text-xs transition-all ${
                  c.isValid
                    ? 'bg-white border-purple-500/10 shadow-xs'
                    : 'bg-amber-50/40 border-amber-300 shadow-xs'
                }`}
              >
                {/* Header bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-[#332F3A]">
                      #{index + 1}
                    </span>
                    <Badge variant={c.type === 'ASSERTION_REASON' ? 'secondary' : 'primary'} size="sm">
                      {c.type === 'ASSERTION_REASON' ? 'Assertion–Reason' : 'MCQ'}
                    </Badge>
                    {c.subject && (
                      <Badge variant="neutral" size="sm">
                        {c.subject}
                      </Badge>
                    )}
                    {c.isValid ? (
                      <Badge variant="success" size="sm">
                        ✓ Valid
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Needs Review
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(isEditing ? null : c.id)}
                      className="p-1.5 rounded-lg text-[#635F69] hover:text-[#7C3AED] hover:bg-purple-50"
                      title={isEditing ? 'Close edit' : 'Edit question'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCandidate(c.id)}
                      className="p-1.5 rounded-lg text-[#635F69] hover:text-rose-600 hover:bg-rose-50"
                      title="Discard candidate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Validation message if invalid */}
                {!c.isValid && c.validationMessage && (
                  <p className="text-[11px] font-bold text-amber-800 mb-2">
                    Notice: {c.validationMessage}
                  </p>
                )}

                {/* View / Edit Mode */}
                {isEditing ? (
                  /* Editable form */
                  <div className="space-y-3 pt-1">
                    <div className="flex gap-2">
                      <select
                        className="bg-white rounded-lg border border-gray-300 p-1.5 text-xs"
                        value={c.type}
                        onChange={e => {
                          const newType = e.target.value as QuestionType;
                          handleUpdateCandidate({
                            ...c,
                            type: newType,
                            options: newType === 'ASSERTION_REASON' ? [...ASSERTION_REASON_OPTIONS] : c.options,
                          });
                        }}
                      >
                        <option value="MCQ">Standard MCQ</option>
                        <option value="ASSERTION_REASON">Assertion–Reason</option>
                      </select>

                      <input
                        className="flex-1 bg-white rounded-lg border border-gray-300 p-1.5 text-xs"
                        value={c.subject || ''}
                        placeholder="Subject (e.g. Physics)"
                        onChange={e => handleUpdateCandidate({ ...c, subject: e.target.value })}
                      />
                    </div>

                    {c.type === 'ASSERTION_REASON' ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          className="w-full bg-white rounded-lg border border-gray-300 p-2 text-xs"
                          placeholder="Assertion statement..."
                          value={c.assertion || ''}
                          onChange={e => handleUpdateCandidate({ ...c, assertion: e.target.value })}
                        />
                        <textarea
                          rows={2}
                          className="w-full bg-white rounded-lg border border-gray-300 p-2 text-xs"
                          placeholder="Reason statement..."
                          value={c.reason || ''}
                          onChange={e => handleUpdateCandidate({ ...c, reason: e.target.value })}
                        />
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        className="w-full bg-white rounded-lg border border-gray-300 p-2 text-xs font-medium"
                        value={c.questionText}
                        onChange={e => handleUpdateCandidate({ ...c, questionText: e.target.value })}
                      />
                    )}

                    {/* Option inputs */}
                    {c.type === 'MCQ' && (
                      <div className="space-y-1.5">
                        {c.options.map((opt, oIdx) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <span className="font-bold w-4">{opt.id}.</span>
                            <input
                              className="flex-1 bg-white rounded-lg border border-gray-300 p-1 text-xs"
                              value={opt.text}
                              onChange={e => {
                                const newOpts = [...c.options];
                                newOpts[oIdx] = { ...opt, text: e.target.value };
                                handleUpdateCandidate({ ...c, options: newOpts });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Correct Answer Selection (Requirement 14) */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-heading font-bold text-[#332F3A]">
                        Select Correct Answer:
                      </span>
                      {['A', 'B', 'C', 'D'].map(letter => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleUpdateCandidate({ ...c, correctAnswer: letter })}
                          className={`w-7 h-7 rounded-lg font-heading font-bold flex items-center justify-center transition-colors ${
                            c.correctAnswer === letter
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-gray-100 text-[#635F69] hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Read-only review preview */
                  <div className="space-y-2">
                    {c.type === 'ASSERTION_REASON' ? (
                      <div className="space-y-1 bg-[#FAF8FE] p-2.5 rounded-xl border border-purple-100">
                        <p><strong>Assertion:</strong> {c.assertion}</p>
                        <p><strong>Reason:</strong> {c.reason}</p>
                      </div>
                    ) : (
                      <p className="font-medium text-[#332F3A] leading-relaxed">{c.questionText}</p>
                    )}

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {c.options.map(opt => (
                        <div
                          key={opt.id}
                          className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                            opt.id === c.correctAnswer
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                              : 'bg-white border-gray-200 text-[#635F69]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              opt.id === c.correctAnswer ? 'bg-emerald-600 text-white' : 'bg-gray-100'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span className="truncate">{opt.text || '(empty option)'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Quick answer key picker if unassigned */}
                    {!c.correctAnswer && (
                      <div className="flex items-center gap-2 pt-1 bg-amber-100/60 p-2 rounded-xl">
                        <span className="font-bold text-amber-900">Assign Correct Answer:</span>
                        {['A', 'B', 'C', 'D'].map(letter => (
                          <button
                            key={letter}
                            onClick={() => handleUpdateCandidate({ ...c, correctAnswer: letter })}
                            className="w-6 h-6 rounded-md bg-white border border-amber-300 font-bold text-[#332F3A] hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Publish Action Footer */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose} fullWidth className="sm:w-auto">
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            fullWidth
            className="sm:w-auto min-w-[200px]"
            disabled={validCount === 0}
            icon={<Check className="w-4 h-4" />}
            onClick={handlePublishAllValid}
          >
            Publish {validCount} Questions to Bank
          </Button>
        </div>
      </div>
    </Modal>
  );
};
