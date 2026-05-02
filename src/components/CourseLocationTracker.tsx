"use client";

import { useEffect } from "react";
import { LAST_COURSE_HREF_KEY } from "./ReadNavLink";

export function CourseLocationTracker({ chapterSlug }: { chapterSlug: string }) {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]"));
    if (!sections.length) {
      window.localStorage.setItem(LAST_COURSE_HREF_KEY, `/course/${chapterSlug}`);
      return;
    }

    function saveHref(sectionId: string) {
      const href = `/course/${chapterSlug}#${sectionId}`;
      window.localStorage.setItem(LAST_COURSE_HREF_KEY, href);
      window.dispatchEvent(new Event("course-location-change"));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id;
        if (id) saveHref(id);
      },
      { rootMargin: "-18% 0px -52% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));

    const hash = window.location.hash.replace("#", "");
    if (hash) saveHref(hash);
    else saveHref(sections[0].id);

    return () => observer.disconnect();
  }, [chapterSlug]);

  return null;
}
