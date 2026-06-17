/* =========================================================
   personalised reading experience — landing script
   minimal js: intersection-observer reveals + hero on load.
   ========================================================= */

(function () {
  "use strict";

  /* hero items reveal immediately on load */
  const heroReveals = document.querySelectorAll(".hero .reveal");
  requestAnimationFrame(() => {
    heroReveals.forEach((el) => el.classList.add("in"));
  });

  /* everything else reveals when scrolled into view */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  /* mark sections below the hero with reveal class on key elements */
  const selectorsToReveal = [
    ".manifesto-label",
    ".manifesto-text",
    ".section-head",
    ".step",
    ".feature",
    ".tech-item",
    ".cta-eyebrow",
    ".cta-title",
    ".cta-sub",
    ".cta-actions",
    ".footer-inner",
  ];

  selectorsToReveal.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add("reveal");
      /* stagger items in a group */
      el.style.transitionDelay = `${i * 0.08}s`;
      observer.observe(el);
    });
  });

  /* subtle parallax shift on the hero radial glow */
  let ticking = false;
  const hero = document.querySelector(".hero");
  if (hero) {
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          hero.style.setProperty("--scroll", `${y * 0.25}px`);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
})();
