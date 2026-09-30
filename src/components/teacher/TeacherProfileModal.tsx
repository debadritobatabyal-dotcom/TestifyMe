import React, { useState } from 'react';
import { User } from '../../types';
import { Storage } from '../../services/storage';
import { AuthService } from '../../services/authService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { UserCheck, Mail, Calendar, Key, School, BookOpen, Check } from 'lucide-react';

export interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User;
  onProfileUpdated?: (updated: User) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onProfileUpdated,
}) => {
  const [name, setName] = useState<string>(teacher.name);
  const [schoolName, setSchoolName] = useState<string>(teacher.schoolName || '');
  const [department, setDepartment] = useState<string>(teacher.department || '');
  const [title, setTitle] = useState<string>(teacher.title || '');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Scoped stats for this teacher
  const teacherTests = Storage.getTests(teacher.id);
  const teacherQuestions = Storage.getQuestions(teacher.id);
  const mySubmissions = Storage.getAttempts(undefined, teacher.id).filter(a => a.status === 'submitted');
  const participatingStudents = new Set(mySubmissions.map(a => a.studentId)).size;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = AuthService.updateTeacherProfile({
      name,
      schoolName: schoolName || undefined,
      department: department || undefined,
      title: title || undefined,
    });

    if (updated) {
      onProfileUpdated?.(updated);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 900);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Faculty Educator Profile"
      description="View and update your private instructor workspace profile."
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4 py-1 text-xs sm:text-sm">
        {/* Workspace Identity Banner */}
        <div className="p-3.5 bg-purple-50/70 border border-purple-200/60 rounded-2xl flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] text-white flex items-center justify-center font-heading font-black text-xl shadow-xs">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-sm text-[#332F3A] truncate">{name}</h3>
            <p className="text-xs text-[#635F69] truncate">{teacher.email}</p>
          </div>
        </div>

        {/* Scoped Stats Overview (Requirement 7) */}
        <div className="grid grid-cols-3 gap-2">
          <Card variant="flat" padding="sm" className="text-center">
            <span className="text-[10px] font-heading font-bold text-[#635F69] uppercase">Tests</span>
            <div className="text-lg font-heading font-black text-[#7C3AED]">{teacherTests.length}</div>
          </Card>
          <Card variant="flat" padding="sm" className="text-center">
            <span className="text-[10px] font-heading font-bold text-[#635F69] uppercase">Questions</span>
            <div className="text-lg font-heading font-black text-[#332F3A]">{teacherQuestions.length}</div>
          </Card>
          <Card variant="flat" padding="sm" className="text-center">
            <span className="text-[10px] font-heading font-bold text-[#635F69] uppercase">Students</span>
            <div className="text-lg font-heading font-black text-emerald-600">{participatingStudents}</div>
          </Card>
        </div>

        {/* Form Fields */}
        <Input
          label="Full Name"
          value={name}
          onChange={e => setName(e.target.value)}
          leftIcon={<UserCheck className="w-4 h-4" />}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Institution / School"
            placeholder="e.g. Oxford Academy"
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            leftIcon={<School className="w-4 h-4" />}
          />

          <Input
            label="Department / Subject"
            placeholder="e.g. Science & Physics"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            leftIcon={<BookOpen className="w-4 h-4" />}
          />
        </div>

        <Input
          label="Academic Title / Designation"
          placeholder="e.g. Senior Faculty Instructor"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* Read-Only Account Details */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-2 text-xs text-[#635F69]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Mail className="w-3.5 h-3.5 text-[#7C3AED]" />
              Account Email:
            </span>
            <strong className="text-[#332F3A]">{teacher.email}</strong>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Key className="w-3.5 h-3.5 text-purple-600" />
              Teacher UID:
            </span>
            <span className="font-mono text-[11px] text-[#332F3A] bg-gray-200/70 px-2 py-0.5 rounded-lg">
              {teacher.id}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Member Since:
            </span>
            <span className="text-[#332F3A]">
              {new Date(teacher.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={isSaved ? <Check className="w-4 h-4" /> : undefined}
          >
            {isSaved ? 'Saved Profile!' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
