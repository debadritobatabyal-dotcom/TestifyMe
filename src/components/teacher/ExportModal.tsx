import React, { useState } from 'react';
import { Test } from '../../types';
import { ExportService, GoogleSheetsService } from '../../services/exportService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileSpreadsheet, FileText, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, test }) => {
  const [googleStatus, setGoogleStatus] = useState<{
    isLoading: boolean;
    message?: string;
    isError?: boolean;
  }>({ isLoading: false });

  const handleExportCSV = () => {
    ExportService.exportClassSummaryCSV(test.id);
  };

  const handleExportQuestionsCSV = () => {
    ExportService.exportQuestionAnalysisCSV(test.id);
  };

  const handleExportExcel = () => {
    ExportService.exportCompleteExcel(test.id);
  };

  const handleGoogleSheetsExport = async () => {
    setGoogleStatus({ isLoading: true });
    try {
      const res = await GoogleSheetsService.exportTestResults(test.id);
      if (res.success) {
        setGoogleStatus({ isLoading: false, message: res.message, isError: false });
      } else {
        setGoogleStatus({ isLoading: false, message: res.message, isError: true });
      }
    } catch {
      setGoogleStatus({
        isLoading: false,
        message: 'Could not connect to Google Sheets API.',
        isError: true,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Class Examination Results"
      description={`Download complete class results and analysis for ${test.name}.`}
      maxWidth="md"
    >
      <div className="space-y-4 py-2">
        {/* Excel 4-Sheet Workbook Option */}
        <div className="border border-purple-500/20 rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#FAF8FE] to-white space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-sm text-[#332F3A]">
                Full Excel Workbook (.xlsx)
              </h4>
              <p className="text-xs text-[#635F69] mt-0.5">
                Includes 4 organized sheets: <span className="font-medium text-[#332F3A]">Class Summary</span>, <span className="font-medium text-[#332F3A]">Student Responses</span>, <span className="font-medium text-[#332F3A]">Question Analysis</span>, and <span className="font-medium text-[#332F3A]">Test Information</span>.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            size="md"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={handleExportExcel}
          >
            Download Complete Excel (.xlsx)
          </Button>
        </div>

        {/* CSV Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#7C3AED]" />
              <h5 className="font-heading font-bold text-xs text-[#332F3A]">
                Class Summary (.csv)
              </h5>
            </div>
            <p className="text-[11px] text-[#635F69]">
              Student scores, percentages, correct, wrong, and timestamps.
            </p>
            <Button variant="secondary" size="sm" fullWidth onClick={handleExportCSV}>
              Export Summary CSV
            </Button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#7C3AED]" />
              <h5 className="font-heading font-bold text-xs text-[#332F3A]">
                Question Accuracy (.csv)
              </h5>
            </div>
            <p className="text-[11px] text-[#635F69]">
              Question-by-question attempts and accuracy percentages.
            </p>
            <Button variant="secondary" size="sm" fullWidth onClick={handleExportQuestionsCSV}>
              Export Question CSV
            </Button>
          </div>
        </div>

        {/* Google Sheets Integration (Section 24) */}
        <div className="border border-sky-200 rounded-2xl p-4 bg-sky-50/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-heading font-extrabold text-sm text-[#332F3A]">
                Direct Google Sheets Sync
              </h4>
              <p className="text-xs text-[#635F69]">
                Export directly to your Google Drive account using Google OAuth credentials.
              </p>
            </div>
          </div>

          {googleStatus.message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                googleStatus.isError
                  ? 'bg-amber-100/70 border border-amber-300 text-amber-900'
                  : 'bg-emerald-100 border border-emerald-300 text-emerald-900'
              }`}
            >
              {googleStatus.isError ? (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span>{googleStatus.message}</span>
            </div>
          )}

          <Button
            variant="secondary"
            fullWidth
            size="sm"
            isLoading={googleStatus.isLoading}
            onClick={handleGoogleSheetsExport}
          >
            Export to Google Sheets
          </Button>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
