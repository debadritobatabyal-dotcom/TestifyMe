import React, { useState } from 'react';
import { Question, QuestionType, DifficultyLevel, ParseReport } from '../../types';
import { Storage } from '../../services/storage';
import { ASSERTION_REASON_OPTIONS } from '../../services/questionParserService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { QuestionImportModal } from './QuestionImportModal';
import { QuestionImportReviewModal } from './QuestionImportReviewModal';
import {
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit,
  Database,
} from 'lucide-react';

import { User } from '../../types';

export interface QuestionBankManagerProps {
  teacher: User;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ teacher }) => {
  const [questions, setQuestions] = useState<Question[]>(() => Storage.getQuestions(teacher.id));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Staged Import Review
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [stagingReport, setStagingReport] = useState<ParseReport | null>(null);

  // Manual Add / Edit
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const refreshList = () => {
    setQuestions(Storage.getQuestions(teacher.id));
  };

  const handleToggleActive = (id: string) => {
    const list = Storage.getQuestions();
    const q = list.find(item => item.id === id);
    if (q) {
      q.active = !q.active;
      Storage.saveQuestions(list);
      refreshList();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      Storage.deleteQuestion(id, teacher.id);
      refreshList();
    }
  };

  const handleAddNew = (type: QuestionType = 'MCQ') => {
    const newQ: Question = {
      id: `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      ownerId: teacher.id,
      type,
      questionText: type === 'MCQ' ? '' : 'Assertion-Reason Question',
      assertion: type === 'ASSERTION_REASON' ? '' : undefined,
      reason: type === 'ASSERTION_REASON' ? '' : undefined,
      options:
        type === 'ASSERTION_REASON'
          ? [...ASSERTION_REASON_OPTIONS]
          : [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
              { id: 'C', text: '' },
              { id: 'D', text: '' },
            ],
      correctAnswer: 'A',
      marks: 1,
      explanation: '',
      subject: 'Physics',
      chapter: '',
      topic: '',
      difficulty: 'medium',
      active: true,
      createdAt: Date.now(),
    };
    setEditingQuestion(newQ);
    setIsEditModalOpen(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    Storage.addQuestion(editingQuestion, teacher.id);
    setIsEditModalOpen(false);
    setEditingQuestion(null);
    refreshList();
  };

  // Google Forms compatible CSV
  const handleExportGoogleFormsCSV = () => {
    const headers = ['Question Title', 'Question Type', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer', 'Points'];
    const rows = questions.map(q => {
      let title = q.questionText;
      if (q.type === 'ASSERTION_REASON') {
        title = `Assertion: ${q.assertion} | Reason: ${q.reason}`;
      }
      const opts = q.options.map(o => `"${(o.text || '').replace(/"/g, '""')}"`);
      return [
        `"${title.replace(/"/g, '""')}"`,
        'Multiple Choice',
        opts[0] || '""',
        opts[1] || '""',
        opts[2] || '""',
        opts[3] || '""',
        q.correctAnswer,
        q.marks.toString(),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TestifyMe_Questions_GoogleForms_Format.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtering
  const subjectsList = Array.from(new Set(questions.map(q => q.subject).filter(Boolean)));

  const filteredQuestions = questions.filter(q => {
    const matchesSearch =
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.assertion && q.assertion.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.subject && q.subject.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSubject = subjectFilter === 'all' || q.subject?.toLowerCase() === subjectFilter.toLowerCase();
    const matchesType = typeFilter === 'all' || q.type === typeFilter;
    const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? q.active : !q.active);

    return matchesSearch && matchesSubject && matchesType && matchesDifficulty && matchesStatus;
  });

  const arTotal = questions.filter(q => q.type === 'ASSERTION_REASON').length;
  const mcqTotal = questions.filter(q => q.type === 'MCQ').length;
  const activeTotal = questions.filter(q => q.active).length;

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-[#332F3A]">
            Question Bank Manager
          </h1>
          <p className="text-xs sm:text-sm text-[#635F69] mt-0.5">
            {questions.length} total questions ({activeTotal} active, {arTotal} Assertion–Reason, {mcqTotal} MCQs)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {questions.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportGoogleFormsCSV}
            >
              Google Forms CSV
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="w-3.5 h-3.5 text-[#7C3AED]" />}
            onClick={() => setIsImportModalOpen(true)}
          >
            Import (PDF / Text / CSV / Excel)
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => handleAddNew('MCQ')}
          >
            Add Question Manually
          </Button>
        </div>
      </div>

      {/* Filter Toolbar (Only when questions exist) */}
      {questions.length > 0 && (
        <Card variant="flat" padding="md" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search by text, subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#635F69]" />}
                className="py-2 text-xs"
              />
            </div>

            <select
              className="w-full bg-white rounded-xl border border-gray-200 text-xs px-3 py-2 text-[#332F3A] min-h-[44px]"
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {subjectsList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="w-full bg-white rounded-xl border border-gray-200 text-xs px-3 py-2 text-[#332F3A] min-h-[44px]"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Question Types</option>
              <option value="MCQ">Standard MCQ</option>
              <option value="ASSERTION_REASON">Assertion–Reason</option>
            </select>

            <select
              className="w-full bg-white rounded-xl border border-gray-200 text-xs px-3 py-2 text-[#332F3A] min-h-[44px]"
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <select
              className="w-full bg-white rounded-xl border border-gray-200 text-xs px-3 py-2 text-[#332F3A] min-h-[44px]"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </Card>
      )}

      {/* Questions List or Real Clean Empty State (Requirement 37) */}
      {questions.length === 0 ? (
        <EmptyState
          icon={<Database className="w-8 h-8" />}
          title="No questions in your bank yet"
          description="Import a PDF question sheet, paste text, upload a CSV/Excel file, or add your first question manually."
          actionText="Import Questions"
          onAction={() => setIsImportModalOpen(true)}
        />
      ) : filteredQuestions.length === 0 ? (
        <Card variant="flat" padding="lg" className="text-center space-y-2">
          <p className="font-heading font-bold text-sm text-[#332F3A]">No questions match current filters</p>
          <p className="text-xs text-[#635F69]">Try clearing your search terms or filter selection.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q, idx) => (
            <Card
              key={q.id}
              variant="flat"
              padding="md"
              className={`space-y-3 border-l-4 transition-colors ${
                q.active ? 'border-l-[#7C3AED]' : 'border-l-gray-300 opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#635F69]">#{idx + 1}</span>
                  <Badge variant={q.type === 'ASSERTION_REASON' ? 'secondary' : 'primary'} size="sm">
                    {q.type === 'ASSERTION_REASON' ? 'Assertion–Reason' : 'MCQ'}
                  </Badge>
                  {q.subject && <Badge variant="neutral" size="sm">{q.subject}</Badge>}
                  <Badge
                    variant={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warning' : 'success'}
                    size="sm"
                  >
                    {q.difficulty}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(q.id)}
                    className={`text-xs px-2.5 py-1 rounded-full font-heading font-bold transition-colors min-h-[32px] ${
                      q.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {q.active ? 'Active' : 'Inactive'}
                  </button>

                  <button
                    onClick={() => {
                      setEditingQuestion({ ...q });
                      setIsEditModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-[#635F69] hover:text-[#7C3AED] hover:bg-purple-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Edit question"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 rounded-lg text-[#635F69] hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {q.type === 'ASSERTION_REASON' ? (
                <div className="text-xs sm:text-sm space-y-1 bg-[#FAF8FE] p-3 rounded-xl border border-purple-100">
                  <p><strong className="text-purple-900">Assertion:</strong> {q.assertion}</p>
                  <p><strong className="text-purple-900">Reason:</strong> {q.reason}</p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm font-medium text-[#332F3A] leading-relaxed">
                  {q.questionText}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map(opt => (
                  <div
                    key={opt.id}
                    className={`p-2 rounded-xl border flex items-center gap-2 ${
                      opt.id === q.correctAnswer
                        ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                        : 'bg-white border-gray-200 text-[#332F3A]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        opt.id === q.correctAnswer ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-[#635F69]'
                      }`}
                    >
                      {opt.id}
                    </span>
                    <span className="truncate">{opt.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Manual Question Editor Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingQuestion?.questionText ? 'Edit Question' : 'Add Question Manually'}
        maxWidth="lg"
      >
        {editingQuestion && (
          <form onSubmit={handleSaveQuestion} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 text-left">
                <label className="font-heading font-bold text-[#332F3A]">Question Type</label>
                <select
                  className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs min-h-[44px]"
                  value={editingQuestion.type}
                  onChange={e => {
                    const newType = e.target.value as QuestionType;
                    setEditingQuestion({
                      ...editingQuestion,
                      type: newType,
                      options: newType === 'ASSERTION_REASON' ? [...ASSERTION_REASON_OPTIONS] : editingQuestion.options,
                    });
                  }}
                >
                  <option value="MCQ">Standard MCQ</option>
                  <option value="ASSERTION_REASON">Assertion–Reason</option>
                </select>
              </div>

              <div className="space-y-1 text-left">
                <label className="font-heading font-bold text-[#332F3A]">Subject</label>
                <input
                  className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs min-h-[44px]"
                  value={editingQuestion.subject || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, subject: e.target.value })}
                  placeholder="e.g. Chemistry, Physics"
                />
              </div>
            </div>

            {editingQuestion.type === 'ASSERTION_REASON' ? (
              <div className="space-y-3">
                <div className="space-y-1 text-left">
                  <label className="font-heading font-bold text-[#332F3A]">Assertion (A)</label>
                  <textarea
                    rows={2}
                    className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs"
                    value={editingQuestion.assertion || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, assertion: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="font-heading font-bold text-[#332F3A]">Reason (R)</label>
                  <textarea
                    rows={2}
                    className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs"
                    value={editingQuestion.reason || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-left">
                <label className="font-heading font-bold text-[#332F3A]">Question Text</label>
                <textarea
                  rows={2}
                  className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs"
                  value={editingQuestion.questionText}
                  onChange={e => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  required
                />
              </div>
            )}

            {/* Options */}
            <div className="space-y-2">
              <label className="font-heading font-bold text-[#332F3A] block text-left">
                Options & Correct Answer
              </label>
              {editingQuestion.options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-6 font-bold text-center text-[#7C3AED]">{opt.id}</span>
                  <input
                    className="flex-1 bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs min-h-[44px]"
                    value={opt.text}
                    onChange={e => {
                      const newOpts = [...editingQuestion.options];
                      newOpts[i].text = e.target.value;
                      setEditingQuestion({ ...editingQuestion, options: newOpts });
                    }}
                    required
                  />
                  <input
                    type="radio"
                    name="correctAnswerRadio"
                    checked={editingQuestion.correctAnswer === opt.id}
                    onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: opt.id })}
                    className="w-5 h-5 text-purple-600 cursor-pointer"
                    title={`Select ${opt.id} as correct answer`}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 text-left">
                <label className="font-heading font-bold text-[#332F3A]">Difficulty</label>
                <select
                  className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs min-h-[44px]"
                  value={editingQuestion.difficulty}
                  onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as DifficultyLevel })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1 text-left">
                <label className="font-heading font-bold text-[#332F3A]">Marks</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs min-h-[44px]"
                  value={editingQuestion.marks}
                  onChange={e => setEditingQuestion({ ...editingQuestion, marks: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save to Bank
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Step 1: Multi-Input Upload Dialog */}
      <QuestionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onQuestionsExtracted={report => {
          setStagingReport(report);
        }}
      />

      {/* Step 2: Mandatory Review & Staging Dialog (Section 12, 13, 14) */}
      <QuestionImportReviewModal
        isOpen={Boolean(stagingReport)}
        onClose={() => setStagingReport(null)}
        report={stagingReport}
        teacherId={teacher.id}
        onPublished={count => {
          alert(`Successfully published ${count} questions to the Question Bank!`);
          setStagingReport(null);
          refreshList();
        }}
      />
    </div>
  );
};
