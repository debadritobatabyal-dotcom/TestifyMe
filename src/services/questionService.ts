import { Question, QuestionType, DifficultyLevel, ImportValidationResult } from '../types';
import { Storage } from './storage';
import { ASSERTION_REASON_OPTIONS } from './demoData';

export const QuestionService = {
  getAllQuestions(teacherId?: string): Question[] {
    return Storage.getQuestions(teacherId);
  },

  getActiveQuestions(teacherId?: string): Question[] {
    return Storage.getQuestions(teacherId).filter(q => q.active);
  },

  getQuestionById(id: string): Question | undefined {
    return Storage.getQuestions().find(q => q.id === id);
  },

  saveQuestion(question: Question, teacherId?: string): Question {
    return Storage.addQuestion(question, teacherId);
  },

  toggleActive(id: string, teacherId?: string): Question | undefined {
    const questions = Storage.getQuestions(teacherId);
    const q = questions.find(item => item.id === id);
    if (q) {
      q.active = !q.active;
      Storage.saveQuestions(Storage.getQuestions());
    }
    return q;
  },

  deleteQuestion(id: string, teacherId?: string): void {
    Storage.deleteQuestion(id, teacherId);
  },

  resetToDefault(): Question[] {
    return Storage.resetQuestionsToDefault();
  },

  // Helper to generate a blank question with ownerId
  createBlankQuestion(type: QuestionType = 'MCQ', ownerId: string = ''): Question {
    const id = `q-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    if (type === 'ASSERTION_REASON') {
      return {
        id,
        ownerId,
        type: 'ASSERTION_REASON',
        questionText: 'Assertion-Reason Question',
        assertion: '',
        reason: '',
        options: [...ASSERTION_REASON_OPTIONS],
        correctAnswer: 'A',
        marks: 1,
        explanation: '',
        subject: 'General Science',
        chapter: 'Core Topics',
        difficulty: 'medium',
        active: true,
        createdAt: Date.now(),
      };
    }

    return {
      id,
      ownerId,
      type: 'MCQ',
      questionText: '',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correctAnswer: 'A',
      marks: 1,
      explanation: '',
      subject: 'Chemistry',
      chapter: 'General',
      difficulty: 'medium',
      active: true,
      createdAt: Date.now(),
    };
  },

  // Parse and validate CSV data
  parseAndValidateCSV(csvText: string, ownerId: string = ''): ImportValidationResult {
    const lines = csvText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < 2) {
      return {
        totalRows: 0,
        validQuestions: [],
        invalidRows: [{ rowNumber: 1, reason: 'CSV is empty or missing data rows', raw: '' }],
        duplicateCount: 0,
        missingAnswersCount: 0,
      };
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const existingQuestions = Storage.getQuestions();
    const existingTexts = new Set(existingQuestions.map(q => q.questionText.trim().toLowerCase()));
    const seenIncomingTexts = new Set<string>();

    const validQuestions: Question[] = [];
    const invalidRows: { rowNumber: number; reason: string; raw: any }[] = [];
    let duplicateCount = 0;
    let missingAnswersCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });

      const questionText = row['question'] || row['questiontext'] || row['title'] || '';
      const rawType = (row['type'] || 'MCQ').toUpperCase();
      const type: QuestionType = rawType.includes('ASSERTION') ? 'ASSERTION_REASON' : 'MCQ';

      const optA = row['optiona'] || row['a'] || '';
      const optB = row['optionb'] || row['b'] || '';
      const optC = row['optionc'] || row['c'] || '';
      const optD = row['optiond'] || row['d'] || '';

      const correctAnswerRaw = (row['correctanswer'] || row['answer'] || row['correct'] || '').toUpperCase().trim();
      const correctAnswer = ['A', 'B', 'C', 'D'].includes(correctAnswerRaw) ? correctAnswerRaw : '';

      const assertion = row['assertion'] || '';
      const reason = row['reason'] || '';
      const marks = parseFloat(row['marks'] || '1') || 1;
      const subject = row['subject'] || 'General';
      const chapter = row['chapter'] || 'Topic 1';
      const difficulty = (['easy', 'medium', 'hard'].includes(row['difficulty']?.toLowerCase())
        ? row['difficulty'].toLowerCase()
        : 'medium') as DifficultyLevel;
      const explanation = row['explanation'] || '';

      // Validation checks
      if (!questionText && !assertion) {
        invalidRows.push({ rowNumber, reason: 'Missing question text or assertion statement', raw: row });
        continue;
      }

      if (!correctAnswer) {
        missingAnswersCount++;
        invalidRows.push({ rowNumber, reason: 'Missing or invalid correct answer (must be A, B, C, or D)', raw: row });
        continue;
      }

      if (type === 'MCQ' && (!optA || !optB || !optC || !optD)) {
        invalidRows.push({ rowNumber, reason: 'MCQ must have all 4 options (A, B, C, D) filled', raw: row });
        continue;
      }

      const normalizedText = (questionText || assertion).trim().toLowerCase();
      if (existingTexts.has(normalizedText) || seenIncomingTexts.has(normalizedText)) {
        duplicateCount++;
        invalidRows.push({ rowNumber, reason: 'Duplicate question text already exists in database or CSV', raw: row });
        continue;
      }
      seenIncomingTexts.add(normalizedText);

      const options =
        type === 'ASSERTION_REASON'
          ? [...ASSERTION_REASON_OPTIONS]
          : [
              { id: 'A', text: optA },
              { id: 'B', text: optB },
              { id: 'C', text: optC },
              { id: 'D', text: optD },
            ];

      const newQ: Question = {
        id: `q-csv-${Date.now().toString(36)}-${validQuestions.length + 1}`,
        ownerId,
        type,
        questionText: questionText || `Assertion-Reason: ${assertion.substring(0, 40)}...`,
        assertion: type === 'ASSERTION_REASON' ? assertion : undefined,
        reason: type === 'ASSERTION_REASON' ? reason : undefined,
        options,
        correctAnswer,
        marks,
        subject,
        chapter,
        difficulty,
        explanation,
        active: true,
        createdAt: Date.now(),
      };

      validQuestions.push(newQ);
    }

    return {
      totalRows: lines.length - 1,
      validQuestions,
      invalidRows,
      duplicateCount,
      missingAnswersCount,
    };
  },

  // Generates sample CSV template for download
  generateSampleCSVTemplate(): string {
    const headers = [
      'question',
      'type',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctAnswer',
      'marks',
      'subject',
      'chapter',
      'difficulty',
      'assertion',
      'reason',
      'explanation',
    ];

    const sampleRows = [
      [
        '"What is the SI unit of electric resistance?"',
        'MCQ',
        '"Volt"',
        '"Ampere"',
        '"Ohm"',
        '"Watt"',
        'C',
        '1',
        'Physics',
        'Current Electricity',
        'easy',
        '""',
        '""',
        '"Ohm is defined as volt per ampere."',
      ],
      [
        '"Assertion-Reason: Rusting of Iron"',
        'ASSERTION_REASON',
        '""',
        '""',
        '""',
        '""',
        'A',
        '1',
        'Chemistry',
        'Corrosion',
        'medium',
        '"Iron nails rust faster in salty sea water than in distilled freshwater."',
        '"Dissolved sodium chloride increases the electrical conductivity of water, accelerating electrochemical rust formation."',
        '"Both are true and Reason accurately explains why saline accelerates corrosion."',
      ],
      [
        '"Which organelle contains hydrolytic digestive enzymes?"',
        'MCQ',
        '"Mitochondria"',
        '"Lysosome"',
        '"Ribosome"',
        '"Chloroplast"',
        'B',
        '1',
        'Biology',
        'Cell Biology',
        'easy',
        '""',
        '""',
        '"Lysosomes contain acid hydrolases capable of breaking down biomolecules."',
      ],
    ];

    return [headers.join(','), ...sampleRows.map(row => row.join(','))].join('\n');
  },

  // Section 25: Google Forms Compatible CSV format
  generateGoogleFormsCompatibleCSV(): string {
    const questions = Storage.getQuestions();
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

    return [headers.join(','), ...rows].join('\n');
  }
};

// Robust CSV parser supporting quotes and commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
