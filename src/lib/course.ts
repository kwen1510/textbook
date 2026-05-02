import course from "@/generated/course.json";

export type CourseSection = {
  id: string;
  chapterSlug: string;
  title: string;
  slug: string;
  level: number;
  order: number;
  sourcePath: string;
  markdown: string;
  html: string;
  recallPrompt: string;
};

export type CourseChapter = {
  id: string;
  title: string;
  slug: string;
  order: number;
  sourcePath: string;
  description: string;
  sections: CourseSection[];
};

export type Course = {
  source: {
    repository: string;
    commit: string;
    license: string;
    generatedAt: string;
  };
  chapters: CourseChapter[];
};

export const courseData = course as Course;

export function getChapters() {
  return courseData.chapters;
}

export function getChapter(slug: string) {
  return courseData.chapters.find((chapter) => chapter.slug === slug);
}

export function getFirstChapter() {
  return courseData.chapters[0];
}

export function getAllSections() {
  return courseData.chapters.flatMap((chapter) => chapter.sections);
}

export function getSection(sectionId: string) {
  return getAllSections().find((section) => section.id === sectionId);
}

export function getSectionLocation(sectionId: string) {
  const section = getSection(sectionId);
  if (!section) return null;
  const chapter = getChapter(section.chapterSlug);
  if (!chapter) return null;
  return {
    chapter,
    section,
    href: `/course/${chapter.slug}#${section.slug}`,
  };
}
