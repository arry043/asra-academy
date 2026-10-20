import type {
  AssignmentCreateInput,
  AssignmentSettingsInput,
  FacultyAssignmentListQuery,
  FacultyCourseListQuery,
  FacultyLessonListQuery,
  FacultyProfileUpdateInput,
  FacultyStudentListQuery,
  GradeSubmissionInput,
  LiveClassCreateInput,
  LiveClassListQuery,
  LiveClassRecordingInput,
  LiveClassUpdateInput,
  SubmissionListQuery,
} from '@asra/validation';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { assignmentService, submissionService } from '../assignments/assignments.service.js';
import { createdMessage } from '../live-classes/live-classes.routes.js';
import { liveClassService } from '../live-classes/live-classes.service.js';
import { facultyService } from './faculty.service.js';

/**
 * HTTP in/out only. `req.auth` is guaranteed by `authenticate` + `requireRole('FACULTY')`;
 * params, queries and bodies were validated by `validateRequest`. Course access is checked in
 * the services — no handler trusts a course id from the request.
 */
const auth = (req: Request) => req.auth!;
const id = (req: Request) => String(req.params.id);
const query = <T>(req: Request) => req.query as unknown as T;
const body = <T>(req: Request) => req.body as T;

export const facultyController = {
  async dashboard(req: Request, res: Response) {
    sendSuccess(res, await facultyService.dashboard(auth(req)));
  },
  features(_req: Request, res: Response) {
    sendSuccess(res, facultyService.features());
  },

  async courses(req: Request, res: Response) {
    sendSuccess(res, await facultyService.courses(auth(req), query<FacultyCourseListQuery>(req)));
  },
  async course(req: Request, res: Response) {
    sendSuccess(res, await facultyService.course(auth(req), id(req)));
  },
  async performance(req: Request, res: Response) {
    sendSuccess(res, await facultyService.performance(auth(req), id(req)));
  },
  async students(req: Request, res: Response) {
    sendSuccess(res, await facultyService.students(auth(req), query<FacultyStudentListQuery>(req)));
  },
  async lessons(req: Request, res: Response) {
    sendSuccess(
      res,
      await facultyService.lessonsByType(auth(req), query<FacultyLessonListQuery>(req)),
    );
  },

  async assignments(req: Request, res: Response) {
    sendSuccess(
      res,
      await assignmentService.list(auth(req), query<FacultyAssignmentListQuery>(req)),
    );
  },
  async assignment(req: Request, res: Response) {
    sendSuccess(res, await assignmentService.detail(auth(req), id(req)));
  },
  async createAssignment(req: Request, res: Response) {
    const data = await assignmentService.create(
      auth(req),
      id(req),
      body<AssignmentCreateInput>(req),
    );
    sendSuccess(res, data, 'Assignment created', 201);
  },
  async saveAssignmentSettings(req: Request, res: Response) {
    const data = await assignmentService.saveSettings(
      auth(req),
      id(req),
      body<AssignmentSettingsInput>(req),
    );
    sendSuccess(res, data, 'Assignment settings saved');
  },

  async submissions(req: Request, res: Response) {
    sendSuccess(res, await submissionService.list(auth(req), query<SubmissionListQuery>(req)));
  },
  async submission(req: Request, res: Response) {
    sendSuccess(res, await submissionService.detail(auth(req), id(req)));
  },
  async grade(req: Request, res: Response) {
    const data = await submissionService.grade(auth(req), id(req), body<GradeSubmissionInput>(req));
    sendSuccess(res, data, 'Marks and feedback saved');
  },
  async release(req: Request, res: Response) {
    const { released, submission } = await submissionService.release(auth(req), id(req));
    sendSuccess(res, submission, released ? 'Result released' : 'Result was already released');
  },

  async liveClasses(req: Request, res: Response) {
    sendSuccess(res, await liveClassService.list(auth(req), query<LiveClassListQuery>(req)));
  },
  async createLiveClass(req: Request, res: Response) {
    const result = await liveClassService.create(
      auth(req),
      id(req),
      body<LiveClassCreateInput>(req),
    );
    sendSuccess(res, result.liveClass, createdMessage(result), 201);
  },
  async completeLiveClass(req: Request, res: Response) {
    const { completed, liveClass } = await liveClassService.complete(auth(req), id(req));
    sendSuccess(
      res,
      liveClass,
      completed ? 'Live class marked as completed' : 'Live class was already completed',
    );
  },
  async requestMeeting(req: Request, res: Response) {
    const { created, liveClass } = await liveClassService.requestMeeting(auth(req), id(req));
    sendSuccess(
      res,
      liveClass,
      created ? 'Google Meet link created' : 'Google Meet link already exists',
    );
  },
  async setRecording(req: Request, res: Response) {
    const input = body<LiveClassRecordingInput>(req);
    const data = await liveClassService.setRecording(auth(req), id(req), input);
    sendSuccess(res, data, input.recordingUrl ? 'Recording link saved' : 'Recording link removed');
  },
  liveClassSettings(_req: Request, res: Response) {
    sendSuccess(res, liveClassService.settings());
  },
  async updateLiveClass(req: Request, res: Response) {
    const data = await liveClassService.update(auth(req), id(req), body<LiveClassUpdateInput>(req));
    sendSuccess(res, data, 'Live class updated');
  },
  async cancelLiveClass(req: Request, res: Response) {
    const { cancelled, liveClass } = await liveClassService.cancel(auth(req), id(req));
    sendSuccess(
      res,
      liveClass,
      cancelled ? 'Live class cancelled' : 'Live class was already cancelled',
    );
  },

  async profile(req: Request, res: Response) {
    sendSuccess(res, await facultyService.profile(auth(req)));
  },
  async updateProfile(req: Request, res: Response) {
    sendSuccess(
      res,
      await facultyService.updateProfile(auth(req), body<FacultyProfileUpdateInput>(req)),
      'Profile updated',
    );
  },
};
