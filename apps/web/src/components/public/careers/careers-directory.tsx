'use client';

import type { PublicJobListItemDto } from '@asra/types';
import {
  Briefcase,
  Calendar,
  ExternalLink,
  GraduationCap,
  IndianRupee,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, controlClasses } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CareersDirectoryProps {
  initialJobs: PublicJobListItemDto[];
  initialCategory?: string;
  serverTime?: string;
}

export function CareersDirectory({
  initialJobs,
  initialCategory,
  serverTime,
}: CareersDirectoryProps) {
  // Extract unique filter options
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    initialJobs.forEach((j) => {
      if (j.department) set.add(j.department);
    });
    return Array.from(set).sort();
  }, [initialJobs]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    initialJobs.forEach((j) => {
      if (j.category) set.add(j.category);
    });
    return Array.from(set).sort();
  }, [initialJobs]);

  const resolveCategoryMatch = React.useCallback(
    (input?: string): string => {
      if (!input || input.trim() === '' || input.toUpperCase() === 'ALL') {
        return 'ALL';
      }
      const raw = input.trim().toLowerCase();
      // 1. Direct case-insensitive match
      const exact = categories.find((c) => c.toLowerCase() === raw);
      if (exact) return exact;

      // 2. Slug / underscore normalization (e.g. 'teaching_faculty' or 'teaching-faculty' -> 'Teaching Faculty')
      const normalizedTarget = raw.replace(/[\s_-]+/g, '');
      const slugMatch = categories.find(
        (c) => c.toLowerCase().replace(/[\s_-]+/g, '') === normalizedTarget,
      );
      if (slugMatch) return slugMatch;

      // 3. Substring match (e.g. 'faculty' in 'Teaching Faculty')
      const subMatch = categories.find((c) => c.toLowerCase().includes(raw));
      if (subMatch) return subMatch;

      // If no category matches directly, keep raw so custom filters work if matching
      return input;
    },
    [categories],
  );

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDepartment, setSelectedDepartment] = React.useState('ALL');
  const [userCategory, setUserCategory] = React.useState<string | null>(null);
  const [prevInitialCategory, setPrevInitialCategory] = React.useState(initialCategory);

  if (prevInitialCategory !== initialCategory) {
    setPrevInitialCategory(initialCategory);
    setUserCategory(null);
  }

  const selectedCategory = userCategory ?? resolveCategoryMatch(initialCategory);
  const setSelectedCategory = React.useCallback((cat: string) => {
    setUserCategory(cat);
  }, []);

  const [selectedType, setSelectedType] = React.useState('ALL');
  const [selectedArrangement, setSelectedArrangement] = React.useState('ALL');

  const referenceTimeMs = React.useMemo(() => {
    return serverTime ? new Date(serverTime).getTime() : null;
  }, [serverTime]);

  const employmentTypes = React.useMemo(() => {
    const set = new Set<string>();
    initialJobs.forEach((j) => {
      if (j.employmentType) set.add(j.employmentType);
    });
    return Array.from(set).sort();
  }, [initialJobs]);

  const filteredJobs = React.useMemo(() => {
    return initialJobs.filter((job) => {
      // Search text matches title, department, category, or location
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesDept = job.department.toLowerCase().includes(q);
        const matchesCat = job.category.toLowerCase().includes(q);
        const matchesLoc = job.workLocation.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDept && !matchesCat && !matchesLoc) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartment !== 'ALL' && job.department !== selectedDepartment) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const target = selectedCategory.toLowerCase().trim();
        const cat = job.category.toLowerCase().trim();
        const matchesCategory =
          cat === target ||
          cat.replace(/[\s_-]+/g, '') === target.replace(/[\s_-]+/g, '') ||
          cat.includes(target);
        if (!matchesCategory) {
          return false;
        }
      }

      // Employment type filter
      if (selectedType !== 'ALL' && job.employmentType !== selectedType) {
        return false;
      }

      // Work arrangement filter
      if (selectedArrangement !== 'ALL' && job.workArrangement !== selectedArrangement) {
        return false;
      }

      return true;
    });
  }, [
    initialJobs,
    searchQuery,
    selectedDepartment,
    selectedCategory,
    selectedType,
    selectedArrangement,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedDepartment !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedArrangement !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('ALL');
    setSelectedCategory('ALL');
    setSelectedType('ALL');
    setSelectedArrangement('ALL');
  };

  const formatEmploymentType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatSalary = (job: PublicJobListItemDto) => {
    if (!job.isSalaryPublic || (!job.salaryMin && !job.salaryMax)) return null;
    const curr = job.currency || 'INR';
    if (job.salaryMin && job.salaryMax) {
      return `${curr} ${job.salaryMin.toLocaleString('en-IN')} – ${job.salaryMax.toLocaleString('en-IN')}`;
    }
    if (job.salaryMin) return `From ${curr} ${job.salaryMin.toLocaleString('en-IN')}`;
    if (job.salaryMax) return `Up to ${curr} ${job.salaryMax.toLocaleString('en-IN')}`;
    return null;
  };

  return (
    <div id="openings" className="scroll-mt-16 py-12 sm:py-16">
      <Container>
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="type-title-md font-bold text-foreground">Open Positions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find your next career opportunity and help educate the next generation.
            </p>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span> of{' '}
            {initialJobs.length} {initialJobs.length === 1 ? 'position' : 'positions'}
          </div>
        </div>

        {/* Filters bar */}
        <div className="mb-8 space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title, department, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Department */}
            <div>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                aria-label="Filter by department"
                className={cn(controlClasses, 'cursor-pointer')}
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by category"
                className={cn(controlClasses, 'cursor-pointer')}
              >
                <option value="ALL">All Categories</option>
                {selectedCategory !== 'ALL' && !categories.includes(selectedCategory) && (
                  <option value={selectedCategory}>{selectedCategory}</option>
                )}
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Employment Type */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                aria-label="Filter by employment type"
                className={cn(controlClasses, 'cursor-pointer')}
              >
                <option value="ALL">All Types</option>
                {employmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatEmploymentType(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filters badge row */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
              <span className="font-medium text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 py-1">
                  Query: {searchQuery}
                  <button onClick={() => setSearchQuery('')} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedDepartment !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 py-1">
                  Dept: {selectedDepartment}
                  <button
                    onClick={() => setSelectedDepartment('ALL')}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 py-1">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedType !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 py-1">
                  Type: {formatEmploymentType(selectedType)}
                  <button onClick={() => setSelectedType('ALL')} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset all
              </Button>
            </div>
          )}
        </div>

        {/* Job Listings Grid */}
        {filteredJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Briefcase className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No open positions found</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'We could not find any positions matching your search filters. Try clearing filters or searching for another keyword.'
                : 'There are currently no active job vacancies available. Please check back later or subscribe to our newsletter for future opportunities.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job) => {
              const salaryString = formatSalary(job);
              const closingTime = job.closingDate ? new Date(job.closingDate).getTime() : null;
              const isClosingSoon = Boolean(
                referenceTimeMs &&
                closingTime &&
                closingTime - referenceTimeMs < 7 * 24 * 60 * 60 * 1000 &&
                closingTime > referenceTimeMs,
              );

              return (
                <Card
                  key={job.id}
                  className="hover:border-asra-gold-400 overflow-hidden border transition-all duration-200 hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1 space-y-3">
                        {/* Tags / Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="dark:bg-asra-gold-950 dark:text-asra-gold-300 rounded bg-asra-gold-50 px-2 py-0.5 font-mono text-xs font-semibold text-asra-gold-700">
                            {job.jobId}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {job.department}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {job.category}
                          </Badge>
                          <Badge variant="outline" className="bg-muted/40 text-xs">
                            {formatEmploymentType(job.employmentType)}
                          </Badge>
                          {job.workArrangement && (
                            <Badge variant="outline" className="text-xs">
                              {job.workArrangement.replace('_', ' ')}
                            </Badge>
                          )}
                          {isClosingSoon && (
                            <Badge variant="destructive" className="animate-pulse text-xs">
                              Closing Soon
                            </Badge>
                          )}
                        </div>

                        {/* Title & Short description */}
                        <div>
                          <Link
                            href={`/careers/${job.jobId}`}
                            className="inline-block text-lg font-bold text-foreground transition-colors hover:text-primary sm:text-xl"
                          >
                            {job.title}
                          </Link>
                          {job.shortDescription && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                              {job.shortDescription}
                            </p>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-foreground/70" />
                            {job.workLocation}
                          </span>
                          {job.experienceRequired && (
                            <span className="flex items-center gap-1.5">
                              <GraduationCap className="h-3.5 w-3.5 text-foreground/70" />
                              {job.experienceRequired}
                            </span>
                          )}
                          {salaryString && (
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                              {salaryString}
                            </span>
                          )}
                          {job.closingDate && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-foreground/70" />
                              Apply by{' '}
                              {new Date(job.closingDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-3 border-t pt-4 sm:flex-row lg:flex-col lg:border-t-0 lg:pt-0">
                        <Button asChild size="default" className="w-full sm:w-auto">
                          <Link href={`/careers/${job.jobId}/apply`}>Apply Now</Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="default"
                          className="w-full sm:w-auto"
                        >
                          <Link href={`/careers/${job.jobId}`}>
                            View Details <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
