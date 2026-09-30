import { ImportedQuestionCandidate, ParseReport, QuestionType } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import { Storage } from './storage';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

export const ASSERTION_REASON_OPTIONS = [
  { id: 'A', text: 'Both Assertion and Reason are true, and Reason is the correct explanation of Assertion.' },
  { id: 'B', text: 'Both Assertion and Reason are true, but Reason is not the correct explanation of Assertion.' },
  { id: 'C', text: 'Assertion is true, but Reason is false.' },
  { id: 'D', text: 'Assertion is false, but Reason is true.' },
];

export const QuestionParserService = {
  // 1. Parse from Raw Text (Pasted Text or Extracted from PDF)
  parseRawText(rawText: string, defaultSubject: string = 'General'): ParseReport {
    const candidates: ImportedQuestionCandidate[] = [];

    // Check for answer key block at end of text (e.g., "Answer Key: 1-A 2-B 3-C" or "1. A, 2. B")
    const { cleanText, answerKeyMap } = extractAnswerKeySection(rawText);

    // Split text into question blocks based on common question headers
    const blocks = splitIntoQuestionBlocks(cleanText);

    const existingQuestions = Storage.getQuestions();
    const existingTexts = new Set(existingQuestions.map(q => q.questionText.trim().toLowerCase()));
    let duplicateCount = 0;

    blocks.forEach((block, index) => {
      const candidate = parseSingleQuestionBlock(block, index + 1, answerKeyMap, defaultSubject);
      if (candidate) {
        const norm = (candidate.questionText || candidate.assertion || '').trim().toLowerCase();
        if (existingTexts.has(norm)) {
          duplicateCount++;
          candidate.isValid = false;
          candidate.validationMessage = 'Duplicate: Question already exists in Question Bank.';
        }
        candidates.push(candidate);
      }
    });

    const validCount = candidates.filter(c => c.isValid).length;
    const needsReviewCount = candidates.length - validCount;

    return {
      importedCount: candidates.length,
      validCount,
      needsReviewCount,
      duplicateCount,
      candidates,
    };
  },

  // 2. Parse from PDF File (Extract selectable text + OCR fallback for scanned pages)
  async parsePDFFile(
    file: File,
    onProgress?: (status: string) => void,
    defaultSubject: string = 'General'
  ): Promise<ParseReport> {
    onProgress?.('Reading PDF file structure...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      onProgress?.(`Extracting text from page ${pageNum} of ${numPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();

      fullText += `\n${pageText}`;
    }

    // Check if normal selectable text extraction yielded sufficient content (Section 10: OCR Support)
    const isScannedOrLowText = fullText.replace(/\s+/g, '').length < 60;

    if (isScannedOrLowText) {
      onProgress?.('Scanned PDF detected. Running optical character recognition (OCR)...');
      try {
        const worker = await createWorker('eng');
        const ocrTextResults: string[] = [];

        for (let pageNum = 1; pageNum <= Math.min(numPages, 5); pageNum++) {
          onProgress?.(`Running OCR on page ${pageNum}...`);
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;
            const ret = await worker.recognize(canvas);
            ocrTextResults.push(ret.data.text);
          }
        }
        await worker.terminate();
        fullText = ocrTextResults.join('\n');
      } catch (ocrErr) {
        console.warn('OCR processing fallback encountered issue:', ocrErr);
      }
    }

    onProgress?.('Parsing and structuring question blocks...');
    return this.parseRawText(fullText, defaultSubject);
  },

  // 3. Parse from Excel File (.xlsx/.xls)
  async parseExcelFile(file: File, defaultSubject: string = 'General'): Promise<ParseReport> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (json.length < 2) {
      return {
        importedCount: 0,
        validCount: 0,
        needsReviewCount: 0,
        duplicateCount: 0,
        candidates: [],
      };
    }

    const headers = (json[0] as string[]).map(h => (h || '').toString().toLowerCase().trim());
    const candidates: ImportedQuestionCandidate[] = [];
    const existingQuestions = Storage.getQuestions();
    const existingTexts = new Set(existingQuestions.map(q => q.questionText.trim().toLowerCase()));
    let duplicateCount = 0;

    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.length === 0) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = row[idx] ? row[idx].toString().trim() : '';
      });

      const questionText = rowMap['question'] || rowMap['question text'] || rowMap['text'] || row[0] || '';
      const rawType = (rowMap['type'] || '').toUpperCase();
      const type: QuestionType = rawType.includes('ASSERTION') ? 'ASSERTION_REASON' : 'MCQ';

      const optA = rowMap['option a'] || rowMap['optiona'] || rowMap['a'] || row[1] || '';
      const optB = rowMap['option b'] || rowMap['optionb'] || rowMap['b'] || row[2] || '';
      const optC = rowMap['option c'] || rowMap['optionc'] || rowMap['c'] || row[3] || '';
      const optD = rowMap['option d'] || rowMap['optiond'] || rowMap['d'] || row[4] || '';

      const rawAnswer = (rowMap['correct answer'] || rowMap['answer'] || rowMap['correct'] || row[5] || '')
        .toString()
        .trim()
        .toUpperCase();
      const correctAnswer = ['A', 'B', 'C', 'D'].includes(rawAnswer) ? rawAnswer : '';

      const assertion = rowMap['assertion'] || '';
      const reason = rowMap['reason'] || '';
      const marks = parseFloat(rowMap['marks'] || '1') || 1;
      const subject = rowMap['subject'] || defaultSubject;
      const chapter = rowMap['chapter'] || '';

      const options =
        type === 'ASSERTION_REASON'
          ? [...ASSERTION_REASON_OPTIONS]
          : [
              { id: 'A', text: optA },
              { id: 'B', text: optB },
              { id: 'C', text: optC },
              { id: 'D', text: optD },
            ];

      let isValid = true;
      let validationMessage = '';

      if (!questionText && !assertion) {
        isValid = false;
        validationMessage = 'Missing question text.';
      } else if (!correctAnswer) {
        isValid = false;
        validationMessage = 'Correct answer required (specify A, B, C, or D).';
      } else if (type === 'MCQ' && (!optA || !optB || !optC || !optD)) {
        isValid = false;
        validationMessage = 'Incomplete options: all 4 choices (A, B, C, D) required.';
      }

      const norm = (questionText || assertion).trim().toLowerCase();
      if (existingTexts.has(norm)) {
        duplicateCount++;
        isValid = false;
        validationMessage = 'Duplicate: Question already exists in Question Bank.';
      }

      candidates.push({
        id: `cand-${Date.now().toString(36)}-${candidates.length + 1}`,
        questionText: questionText || `Assertion-Reason: ${assertion.substring(0, 40)}...`,
        type,
        assertion: type === 'ASSERTION_REASON' ? assertion : undefined,
        reason: type === 'ASSERTION_REASON' ? reason : undefined,
        options,
        correctAnswer,
        marks,
        subject,
        chapter,
        difficulty: 'medium',
        isValid,
        validationMessage,
      });
    }

    return {
      importedCount: candidates.length,
      validCount: candidates.filter(c => c.isValid).length,
      needsReviewCount: candidates.filter(c => !c.isValid).length,
      duplicateCount,
      candidates,
    };
  }
};

// HELPER: Extract Answer Key block if present (e.g., "Answer Key: 1. A, 2. B, 3. C" or "1-A 2-C")
function extractAnswerKeySection(text: string): { cleanText: string; answerKeyMap: Map<number, string> } {
  const answerKeyMap = new Map<number, string>();
  const match = text.match(/(?:Answer\s*Key|Answers|Solutions)\s*[:\n]([\s\S]+)$/i);

  let cleanText = text;
  if (match) {
    cleanText = text.substring(0, match.index).trim();
    const keySection = match[1];

    // Match patterns like "1-A", "1. B", "1: C", "Q1: D", "1) A"
    const keyRegex = /(?:Q|Question)?\s*(\d+)\s*[-.:)]\s*([A-Da-d])/g;
    let m;
    while ((m = keyRegex.exec(keySection)) !== null) {
      const qNum = parseInt(m[1], 10);
      const ansLetter = m[2].toUpperCase();
      answerKeyMap.set(qNum, ansLetter);
    }
  }

  return { cleanText, answerKeyMap };
}

// HELPER: Split text into individual question chunks
function splitIntoQuestionBlocks(text: string): string[] {
  // Look for patterns like: "Question 1", "Q1.", "1.", "1)", "1 -"
  const pattern = /(?:^|\n)(?=(?:Question|Q\.?|Ques)\s*\d+[\s.:)]|\d{1,3}[\s.:)]\s+[A-Za-z])/gi;
  const rawBlocks = text.split(pattern).map(b => b.trim()).filter(b => b.length > 10);

  if (rawBlocks.length <= 1) {
    // Fallback: split by double newlines
    const doubleLineBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 15);
    if (doubleLineBlocks.length > 1) {
      return doubleLineBlocks;
    }
  }
  return rawBlocks;
}

// HELPER: Parse a single block into candidate Question
function parseSingleQuestionBlock(
  block: string,
  blockNumber: number,
  answerKeyMap: Map<number, string>,
  defaultSubject: string
): ImportedQuestionCandidate | null {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return null;

  // Check for Assertion & Reason format (Requirement 15)
  const isAssertionReason =
    /assertion\s*[:(]/i.test(block) && /reason\s*[:(]/i.test(block);

  let type: QuestionType = isAssertionReason ? 'ASSERTION_REASON' : 'MCQ';
  let assertion = '';
  let reason = '';
  let questionText = '';
  const optionsMap: Record<string, string> = { A: '', B: '', C: '', D: '' };
  let detectedAnswer = answerKeyMap.get(blockNumber) || '';

  // Extract inline Answer if declared inside block (e.g. "Answer: B" or "Ans. C")
  const ansMatch = block.match(/(?:Answer|Ans|Correct\s*Option)\s*[:.-]?\s*([A-Da-d])/i);
  if (ansMatch) {
    detectedAnswer = ansMatch[1].toUpperCase();
  }

  if (isAssertionReason) {
    const aMatch = block.match(/Assertion\s*[:(]([\s\S]+?)(?=Reason\s*[:(]|$)/i);
    const rMatch = block.match(/Reason\s*[:(]([\s\S]+?)(?=(?:Option|Answer|Ans|\n\s*[A-D][.)])|$)/i);
    assertion = aMatch ? aMatch[1].trim() : '';
    reason = rMatch ? rMatch[1].trim() : '';
    questionText = `Assertion-Reason Question`;
  }

  // Parse Options A, B, C, D
  let currentOption: string | null = null;
  const questionLines: string[] = [];

  for (const line of lines) {
    // Check if line starts an option: "A. ...", "(A) ...", "A) ..."
    const optMatch = line.match(/^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*)(.*)$/);
    if (optMatch) {
      currentOption = optMatch[1].toUpperCase();
      optionsMap[currentOption] = optMatch[2].trim();
      continue;
    }

    if (currentOption && !line.toLowerCase().startsWith('ans')) {
      optionsMap[currentOption] += ` ${line}`;
    } else if (!isAssertionReason && !line.toLowerCase().startsWith('ans')) {
      questionLines.push(line);
    }
  }

  if (!isAssertionReason) {
    // Strip leading question numbers like "1. ", "Question 1: "
    questionText = questionLines.join(' ').replace(/^(?:Question|Q\.?|Ques)?\s*\d+\s*[-.:)]\s*/i, '').trim();
  }

  const options =
    type === 'ASSERTION_REASON'
      ? [...ASSERTION_REASON_OPTIONS]
      : [
          { id: 'A', text: optionsMap.A || '' },
          { id: 'B', text: optionsMap.B || '' },
          { id: 'C', text: optionsMap.C || '' },
          { id: 'D', text: optionsMap.D || '' },
        ];

  // Validation rules (Requirements 13 & 14)
  let isValid = true;
  let validationMessage = '';

  if (type === 'MCQ') {
    if (!questionText) {
      isValid = false;
      validationMessage = 'Missing question text.';
    } else if (!optionsMap.A || !optionsMap.B) {
      isValid = false;
      validationMessage = 'Insufficient options detected (minimum Options A and B required).';
    }
  } else {
    if (!assertion || !reason) {
      isValid = false;
      validationMessage = 'Assertion or Reason text incomplete.';
    }
  }

  // Section 14: Answer key handling - if missing, require teacher to review, NEVER invent answers!
  if (!detectedAnswer) {
    isValid = false;
    validationMessage = validationMessage
      ? `${validationMessage} Correct answer required.`
      : 'Correct answer required (no answer key found in source).';
  }

  return {
    id: `cand-${Date.now().toString(36)}-${blockNumber}`,
    questionText: questionText || 'Untitled Question',
    type,
    assertion: type === 'ASSERTION_REASON' ? assertion : undefined,
    reason: type === 'ASSERTION_REASON' ? reason : undefined,
    options,
    correctAnswer: detectedAnswer,
    marks: 1,
    subject: defaultSubject,
    chapter: '',
    difficulty: 'medium',
    isValid,
    validationMessage,
    sourceRaw: block,
  };
}
