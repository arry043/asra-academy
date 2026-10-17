import type {
  AnswerGradeInput,
  AnswerSaveInput,
  AssessmentTransitionInput,
  AttemptListQuery,
  ExamCreateInput,
  ExamUpdateInput,
  FacultyExamListQuery,
  FacultyQuizListQuery,
  PaginationQuery,
  QuestionInput,
  QuestionOrderInput,
  QuizCreateInput,
  QuizSettingsInput,
  StudentExamListQuery,
} from '@asra/validation';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { facultyAttemptService, studentAttemptService } from './attempts.service.js';
import { facultyExamService, studentExamService } from './exams.service.js';
import { questionAuthoring } from './questions.service.js';
import { facultyQuizService, studentQuizService } from './quizzes.service.js';

/**
 * HTTP in/out for the assessment engine (PHASE 09). Inputs were validated by `validateRequest`;
 * every access decision is made in the services from database state.
 */
const auth = (req: Request) => req.auth!;
const id = (req: Request) => String(req.params.id);
const query = <T>(req: Request) => req.query as unknown as T;
const body = <T>(req: Request) => req.body as T;

export const facultyAssessmentController = {
  // Quizzes (addressed by their QUIZ lesson id)
  async quizzes(req: Request, res: Response) {
    sendSuccess(res, await facultyQuizService.list(auth(req), query<FacultyQuizListQuery>(req)));
  },
  async quiz(req: Request, res: Response) {
    sendSuccess(res, await facultyQuizService.detail(auth(req), id(req)));
  },
  async createQuiz(req: Request, res: Response) {
    const data = await facultyQuizService.create(auth(req), id(req), body<QuizCreateInput>(req));
    sendSuccess(res, data, 'Quiz created', 201);
  },
  async saveQuizSettings(req: Request, res: Response) {
    const data = await facultyQuizService.saveSettings(
      auth(req),
      id(req),
      body<QuizSettingsInput>(req),
    );
    sendSuccess(res, data, 'Quiz settings saved');
  },
  async addQuizQuestion(req: Request, res: Response) {
    const data = await facultyQuizService.addQuestion(auth(req), id(req), body<QuestionInput>(req));
    sendSuccess(res, data, 'Question added', 201);
  },
  async reorderQuizQuestions(req: Request, res: Response) {
    const data = await facultyQuizService.reorderQuestions(
      auth(req),
      id(req),
      body<QuestionOrderInput>(req),
    );
    sendSuccess(res, data, 'Questions reordered');
  },
  async quizTransition(req: Request, res: Response) {
    const { action } = body<AssessmentTransitionInput>(req);
    sendSuccess(
      res,
      await facultyQuizService.transition(auth(req), id(req), action),
      'Quiz status updated',
    );
  },
  async publishQuizResults(req: Request, res: Response) {
    const { published, quiz } = await facultyQuizService.publishResults(auth(req), id(req));
    sendSuccess(res, quiz, published ? 'Results published' : 'Results were already published');
  },
  async quizAttempts(req: Request, res: Response) {
    const quizId = await facultyQuizService.quizIdForGrading(auth(req), id(req));
    sendSuccess(res, await facultyAttemptService.list({ quizId }, query<AttemptListQuery>(req)));
  },

  // Examinations
  async exams(req: Request, res: Response) {
    sendSuccess(res, await facultyExamService.list(auth(req), query<FacultyExamListQuery>(req)));
  },
  async exam(req: Request, res: Response) {
    sendSuccess(res, await facultyExamService.detail(auth(req), id(req)));
  },
  async createExam(req: Request, res: Response) {
    const data = await facultyExamService.create(auth(req), id(req), body<ExamCreateInput>(req));
    sendSuccess(res, data, 'Exam created', 201);
  },
  async updateExam(req: Request, res: Response) {
    const data = await facultyExamService.update(auth(req), id(req), body<ExamUpdateInput>(req));
    sendSuccess(res, data, 'Exam updated');
  },
  async deleteExam(req: Request, res: Response) {
    await facultyExamService.remove(auth(req), id(req));
    sendSuccess(res, null, 'Exam deleted');
  },
  async addExamQuestion(req: Request, res: Response) {
    const data = await facultyExamService.addQuestion(auth(req), id(req), body<QuestionInput>(req));
    sendSuccess(res, data, 'Question added', 201);
  },
  async reorderExamQuestions(req: Request, res: Response) {
    const data = await facultyExamService.reorderQuestions(
      auth(req),
      id(req),
      body<QuestionOrderInput>(req),
    );
    sendSuccess(res, data, 'Questions reordered');
  },
  async examTransition(req: Request, res: Response) {
    const { action } = body<AssessmentTransitionInput>(req);
    sendSuccess(
      res,
      await facultyExamService.transition(auth(req), id(req), action),
      'Exam status updated',
    );
  },
  async publishExamResults(req: Request, res: Response) {
    const { published, exam } = await facultyExamService.publishResults(auth(req), id(req));
    sendSuccess(res, exam, published ? 'Results published' : 'Results were already published');
  },
  async processExpired(req: Request, res: Response) {
    sendSuccess(res, await facultyExamService.processExpired(auth(req), id(req)));
  },
  async examAttempts(req: Request, res: Response) {
    const examinationId = await facultyExamService.examIdForGrading(auth(req), id(req));
    sendSuccess(
      res,
      await facultyAttemptService.list({ examinationId }, query<AttemptListQuery>(req)),
    );
  },

  // Questions (either kind)
  async updateQuestion(req: Request, res: Response) {
    const data = await questionAuthoring.update(auth(req), id(req), body<QuestionInput>(req));
    sendSuccess(res, data, 'Question saved');
  },
  async deleteQuestion(req: Request, res: Response) {
    await questionAuthoring.remove(auth(req), id(req));
    sendSuccess(res, null, 'Question removed');
  },

  // Attempts
  async attempt(req: Request, res: Response) {
    sendSuccess(res, await facultyAttemptService.detail(auth(req), id(req)));
  },
  async gradeAnswer(req: Request, res: Response) {
    const data = await facultyAttemptService.gradeAnswer(
      auth(req),
      id(req),
      body<AnswerGradeInput>(req),
    );
    sendSuccess(res, data, 'Marks saved');
  },
};

export const studentAssessmentController = {
  async quiz(req: Request, res: Response) {
    sendSuccess(res, await studentQuizService.get(auth(req), id(req)));
  },
  async startQuiz(req: Request, res: Response) {
    const data = await studentQuizService.start(auth(req), id(req));
    sendSuccess(
      res,
      data,
      data.resumed ? 'Attempt resumed' : 'Attempt started',
      data.resumed ? 200 : 201,
    );
  },
  async exams(req: Request, res: Response) {
    sendSuccess(res, await studentExamService.list(auth(req), query<StudentExamListQuery>(req)));
  },
  async exam(req: Request, res: Response) {
    sendSuccess(res, await studentExamService.detail(auth(req), id(req)));
  },
  async startExam(req: Request, res: Response) {
    const data = await studentExamService.start(auth(req), id(req));
    sendSuccess(
      res,
      data,
      data.resumed ? 'Attempt resumed' : 'Attempt started',
      data.resumed ? 200 : 201,
    );
  },
  async attempt(req: Request, res: Response) {
    sendSuccess(res, await studentAttemptService.get(auth(req), id(req)));
  },
  async saveAnswer(req: Request, res: Response) {
    const data = await studentAttemptService.saveAnswer(
      auth(req),
      id(req),
      String(req.params.questionId),
      body<AnswerSaveInput>(req),
    );
    sendSuccess(res, data, data.applied ? 'Answer saved' : 'A newer answer was already saved');
  },
  async submit(req: Request, res: Response) {
    const { outcome, attempt } = await studentAttemptService.submit(auth(req), id(req));
    const messages = {
      submitted: 'Attempt submitted',
      expired: 'Time was up — your answers saved before the deadline were submitted',
      already_final: 'This attempt was already submitted',
    } as const;
    sendSuccess(res, attempt, messages[outcome]);
  },
  async results(req: Request, res: Response) {
    sendSuccess(res, await studentAttemptService.results(auth(req), query<PaginationQuery>(req)));
  },
};
