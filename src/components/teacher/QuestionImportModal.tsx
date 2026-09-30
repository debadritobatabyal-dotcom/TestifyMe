import React, { useState } from 'react';
import { ParseReport } from '../../types';
import { QuestionParserService } from '../../services/questionParserService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  ClipboardType,
  UploadCloud,
  Download,
  AlertCircle,
} from 'lucide-react';

export interface QuestionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsExtracted: (report: ParseReport) => void;
  teacherId?: string;
}

type ImportMethod = 'pdf' | 'text' | 'csv' | 'excel';

export const QuestionImportModal: React.FC<QuestionImportModalProps> = ({
  isOpen,
  onClose,
  onQuestionsExtracted,
  teacherId,
}) => {
  const [method, setMethod] = useState<ImportMethod>('pdf');
  const [pastedText, setPastedText] = useState<string>('');
  const [subject, setSubject] = useState<string>('General Science');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Initializing PDF parser...');

    try {
      const report = await QuestionParserService.parsePDFFile(
        file,
        status => setProgressStatus(status),
        subject,
        teacherId
      );

      if (report.candidates.length === 0) {
        setErrorMessage('Could not extract recognizable questions from this PDF. Try pasting text or check file format.');
        setIsProcessing(false);
        return;
      }

      onQuestionsExtracted(report);
      onClose();
    } catch (err) {
      console.error('PDF parsing error:', err);
      setErrorMessage('Failed to read or parse PDF file. Ensure the file is not password protected.');
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const report = await QuestionParserService.parseExcelFile(file, subject, teacherId);
      if (report.candidates.length === 0) {
        setErrorMessage('No valid rows found in the uploaded Excel spreadsheet.');
        setIsProcessing(false);
        return;
      }

      onQuestionsExtracted(report);
      onClose();
    } catch (err) {
      console.error('Excel parsing error:', err);
      setErrorMessage('Failed to parse Excel file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const report = QuestionParserService.parseRawText(text, subject, teacherId);
        if (report.candidates.length === 0) {
          setErrorMessage('No recognizable questions found in CSV.');
          setIsProcessing(false);
          return;
        }
        onQuestionsExtracted(report);
        onClose();
      } catch (err) {
        console.error('CSV parse error:', err);
        setErrorMessage('Failed to parse CSV.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleTextParse = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste questions text.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const report = QuestionParserService.parseRawText(pastedText, subject, teacherId);
      if (report.candidates.length === 0) {
        setErrorMessage('Could not detect distinct question blocks. Ensure each question starts with a number or "Question" keyword.');
        setIsProcessing(false);
        return;
      }

      onQuestionsExtracted(report);
      onClose();
    } catch (err) {
      console.error('Text parsing error:', err);
      setErrorMessage('Failed to process pasted text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      'question,type,optionA,optionB,optionC,optionD,correctAnswer,marks,subject,chapter,difficulty,assertion,reason',
      '"What is the SI unit of electrical resistance?",MCQ,"Volt","Ampere","Ohm","Watt",C,1,"Physics","Current Electricity","easy","",""',
      '"Assertion-Reason: Acid Rain",ASSERTION_REASON,"","","","",A,1,"Chemistry","Environmental","medium","Acid rain causes corrosion of marble.","Sulphuric acid reacts with calcium carbonate.",""',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TestifyMe_Question_Import_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Question Bank"
      description="Select an input method to extract and parse questions into the review staging area."
      maxWidth="lg"
    >
      <div className="space-y-4 py-2">
        {/* Method Selector Tabs (Section 8: PDF, Text, CSV, Excel) */}
        <div className="grid grid-cols-4 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-heading font-bold">
          <button
            onClick={() => { setMethod('pdf'); setErrorMessage(null); }}
            className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[38px] ${
              method === 'pdf' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>PDF</span>
          </button>

          <button
            onClick={() => { setMethod('text'); setErrorMessage(null); }}
            className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[38px] ${
              method === 'text' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
            }`}
          >
            <ClipboardType className="w-4 h-4 shrink-0" />
            <span>Paste Text</span>
          </button>

          <button
            onClick={() => { setMethod('csv'); setErrorMessage(null); }}
            className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[38px] ${
              method === 'csv' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
            }`}
          >
            <FileCode className="w-4 h-4 shrink-0" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => { setMethod('excel'); setErrorMessage(null); }}
            className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[38px] ${
              method === 'excel' ? 'bg-white text-[#7C3AED] shadow-xs' : 'text-[#635F69]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Excel</span>
          </button>
        </div>

        {/* Subject tag input */}
        <Input
          label="Default Subject / Course Tag"
          placeholder="e.g. Physics, Chemistry, Biology, Mathematics"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Active Tab View */}
        {method === 'pdf' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-purple-300 rounded-3xl p-6 sm:p-8 text-center bg-white hover:border-purple-500 transition-colors">
              <input
                type="file"
                accept=".pdf,application/pdf"
                id="pdf-upload-input"
                onChange={handlePDFUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <label htmlFor="pdf-upload-input" className="cursor-pointer block space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#7C3AED] flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-heading font-extrabold text-sm sm:text-base text-[#332F3A]">
                    Click or drag & drop PDF question sheet
                  </p>
                  <p className="text-xs text-[#635F69] mt-0.5">
                    Selectable text extracted directly. Scanned pages automatically processed with OCR.
                  </p>
                </div>
                <Button variant="primary" size="sm" type="button" className="pointer-events-none mt-2">
                  Select PDF File
                </Button>
              </label>
            </div>

            {isProcessing && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center space-y-2">
                <div className="w-5 h-5 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-heading font-bold text-purple-900">{progressStatus || 'Processing PDF...'}</p>
              </div>
            )}
          </div>
        )}

        {method === 'text' && (
          <div className="space-y-3">
            <div className="space-y-1 text-left">
              <label className="text-xs font-heading font-bold text-[#332F3A]">
                Paste Unstructured or Structured Questions
              </label>
              <textarea
                rows={7}
                className="w-full bg-white text-[#332F3A] rounded-[16px] border border-gray-300 p-3 text-xs font-mono focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-100 placeholder:text-gray-400"
                placeholder={`Example:
1. What is the acceleration due to gravity on Earth?
A. 9.8 m/s²
B. 8.9 m/s²
C. 11.2 km/s
D. 0 m/s²
Answer: A

Assertion: Acid rain corrodes limestone.
Reason: Nitric and sulphuric acid dissolve calcium carbonate.
Answer: A`}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              fullWidth
              size="md"
              isLoading={isProcessing}
              onClick={handleTextParse}
            >
              Parse Questions into Review
            </Button>
          </div>
        )}

        {method === 'csv' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-purple-50/60 p-3 rounded-2xl border border-purple-100 text-xs">
              <span className="text-purple-900 font-medium">Standard CSV Template</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadTemplate}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-3xl p-6 text-center bg-white hover:border-purple-500">
              <input
                type="file"
                accept=".csv,text/csv"
                id="csv-file-input"
                onChange={handleCSVUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-8 h-8 text-[#7C3AED] mx-auto" />
                <p className="font-heading font-bold text-sm text-[#332F3A]">Click to select CSV File</p>
                <span className="text-xs text-[#635F69]">Supports UTF-8 CSV</span>
              </label>
            </div>
          </div>
        )}

        {method === 'excel' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-300 rounded-3xl p-6 text-center bg-white hover:border-purple-500">
              <input
                type="file"
                accept=".xlsx,.xls"
                id="excel-file-input"
                onChange={handleExcelUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <label htmlFor="excel-file-input" className="cursor-pointer block space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-heading font-bold text-sm text-[#332F3A]">Click to select Excel Spreadsheet (.xlsx)</p>
                <span className="text-xs text-[#635F69]">Reads first sheet columns: question, options, answer</span>
              </label>
            </div>
          </div>
        )}

        {/* Modal footer */}
        <div className="pt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
