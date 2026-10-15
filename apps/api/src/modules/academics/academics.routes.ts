import { PERMISSIONS } from '@asra/types';
import {
  academicLevelCreateSchema,
  academicLevelUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  streamCreateSchema,
  streamUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from '@asra/validation';
import { Router } from 'express';
import { registerCatalogueRoutes } from '../shared/catalogue-routes.js';
import {
  academicLevelService,
  classService,
  streamService,
  subjectService,
} from './academics.service.js';

/** `/api/v1/admin/{academic-levels,classes,streams,subjects}` — `academic_structure.manage`. */
export const academicsAdminRouter = Router();
const permission = PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE;

registerCatalogueRoutes(academicsAdminRouter, '/academic-levels', {
  service: academicLevelService,
  label: 'Academic level',
  permission,
  createSchema: academicLevelCreateSchema,
  updateSchema: academicLevelUpdateSchema,
});
registerCatalogueRoutes(academicsAdminRouter, '/classes', {
  service: classService,
  label: 'Class',
  permission,
  createSchema: classCreateSchema,
  updateSchema: classUpdateSchema,
});
registerCatalogueRoutes(academicsAdminRouter, '/streams', {
  service: streamService,
  label: 'Stream',
  permission,
  createSchema: streamCreateSchema,
  updateSchema: streamUpdateSchema,
});
registerCatalogueRoutes(academicsAdminRouter, '/subjects', {
  service: subjectService,
  label: 'Subject',
  permission,
  createSchema: subjectCreateSchema,
  updateSchema: subjectUpdateSchema,
});
