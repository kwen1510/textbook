export const readingNotesActiveEvent = "reading-notes-active-section";
export const readingNotesAddHighlightEvent = "reading-notes-add-highlight";
export const readingNotesProgressEvent = "reading-notes-progress";

export type ReadingNotesActiveDetail = {
  sectionId: string;
};

export type ReadingNotesAddHighlightDetail = {
  sectionId: string;
  sectionTitle: string;
  text: string;
};

export type ReadingNotesProgressDetail = {
  sectionId: string;
  state: "unread" | "reading" | "completed" | "needs_review";
};
