'use client';

import * as React from 'react';

/**
 * API prefix used by the curriculum editor and lesson dialog: `/admin` (content.manage) or
 * `/faculty` (content.manage_assigned, PHASE 08). Both prefixes reach the SAME curriculum service;
 * the API decides which courses the caller may edit.
 */
export const CurriculumApiBase = React.createContext<'/admin' | '/faculty'>('/admin');

export function useCurriculumBase() {
  return React.useContext(CurriculumApiBase);
}
