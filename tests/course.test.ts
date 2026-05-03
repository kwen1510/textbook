import { describe, expect, it } from "vitest";
import { courseData, getAllSections, getChapter } from "../src/lib/course";
import { getReviewCards } from "../src/lib/review-cards";
import { slugify } from "../src/lib/slug";

describe("course ingestion output", () => {
  it("generates a valid course shell", () => {
    expect(courseData.source.repository.length).toBeGreaterThan(0);
    expect(courseData.source.commit.length).toBeGreaterThan(0);
    expect(courseData.chapters.length).toBeGreaterThanOrEqual(1);
    expect(getAllSections().length).toBeGreaterThanOrEqual(1);
  });

  it("keeps stable chapter and section ids for note anchoring", () => {
    const firstChapter = courseData.chapters[0];
    expect(getChapter(firstChapter.slug)?.id).toBe(firstChapter.id);
    expect(slugify("Availability vs consistency")).toBe("availability-vs-consistency");
  });

  it("uses plain text for chapter descriptions", () => {
    for (const chapter of courseData.chapters) {
      expect(chapter.description).not.toMatch(/<[^>]+>|href=/);
    }
  });

  it("generates unique section ids", () => {
    const sectionIds = getAllSections().map((section) => section.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it("does not emit insecure remote image URLs", () => {
    const html = getAllSections().map((section) => section.html).join("\n");
    expect(html).not.toMatch(/<img[^>]+src="http:\/\//);
  });

  it("opens external course links in a new tab", () => {
    const html = getAllSections().map((section) => section.html).join("\n");
    const externalLinks = [...html.matchAll(/<a\b[^>]*href="https?:\/\/[^\"]+"[^>]*>/g)].map(([link]) => link);
    expect(externalLinks.every((link) => link.includes('target="_blank"') && link.includes('rel="noopener noreferrer"'))).toBe(true);
  });

  it("does not leave cross-page course anchors as dead same-page links", () => {
    for (const section of getAllSections()) {
      const ids = new Set([...section.html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
      const deadHashes = [...section.html.matchAll(/<a\b[^>]*href="#([^"]+)"/g)]
        .map((match) => match[1])
        .filter((hash) => !ids.has(hash));

      expect(deadHashes).toEqual([]);
    }
  });

  it("generates one review card per section", () => {
    const cards = getReviewCards();
    const sections = getAllSections();
    expect(cards).toHaveLength(sections.length);
    expect(new Set(cards.map((card) => card.sectionId)).size).toBe(sections.length);
    for (const card of cards) {
      expect(card.question.length).toBeGreaterThan(20);
      expect(card.suggestedAnswer.length).toBeGreaterThan(20);
      expect(card.href).toContain("/course/");
      if (card.mode === "mcq") {
        expect(card.choices?.length).toBe(4);
        expect(card.choices?.some((choice) => choice.id === card.correctChoiceId)).toBe(true);
      }
    }
  });
});
