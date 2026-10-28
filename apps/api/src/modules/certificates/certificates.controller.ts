import type {
  AdminCertificateQuery,
  AdminRevokeCertificateInput,
  CertificateVerifyParams,
  PaginationQuery,
} from '@asra/validation';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { certificatesService } from './certificates.service.js';

const auth = (req: Request) => req.auth!;
const idParam = (req: Request) => String(req.params.id);
const courseIdParam = (req: Request) => String(req.params.courseId ?? req.params.id);
const query = <T>(req: Request) => req.query as unknown as T;
const body = <T>(req: Request) => req.body as T;

export const certificatesController = {
  // --- Student Endpoints ---

  async getStudentCertificates(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.getStudentCertificates(
      auth(req),
      query<PaginationQuery>(req),
    );
    sendSuccess(res, result);
  },

  async getStudentCertificate(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.getStudentCertificateById(auth(req), idParam(req));
    sendSuccess(res, result);
  },

  async checkCourseEligibility(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.checkEligibility(auth(req), courseIdParam(req));
    sendSuccess(res, result);
  },

  async claimCertificate(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.issueCertificate(auth(req), courseIdParam(req));
    sendSuccess(res, result, 'Certificate issued', 201);
  },

  async downloadStudentCertificate(req: Request, res: Response): Promise<void> {
    const { buffer, filename } = await certificatesService.getCertificatePdf(
      idParam(req),
      auth(req),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    // Personal document (often a minor's name): never kept in any cache, browser included.
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  },

  // --- Public Verification ---

  async verifyCertificate(req: Request, res: Response): Promise<void> {
    const params = req.params as unknown as CertificateVerifyParams;
    const result = await certificatesService.verifyPublicCertificate(params.certificateNumber);
    sendSuccess(res, result);
  },

  // --- Admin Endpoints ---

  async listAdminCertificates(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.listAdminCertificates(
      query<AdminCertificateQuery>(req),
    );
    sendSuccess(res, result);
  },

  async getAdminCertificate(req: Request, res: Response): Promise<void> {
    const result = await certificatesService.getAdminCertificateById(idParam(req));
    sendSuccess(res, result);
  },

  async revokeCertificate(req: Request, res: Response): Promise<void> {
    const { reason } = body<AdminRevokeCertificateInput>(req);
    const result = await certificatesService.revokeCertificate(auth(req), idParam(req), reason);
    sendSuccess(res, result);
  },

  async downloadAdminCertificate(req: Request, res: Response): Promise<void> {
    const { buffer, filename } = await certificatesService.getCertificatePdf(
      idParam(req),
      auth(req),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  },
};
