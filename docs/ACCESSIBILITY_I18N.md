# Accessibility and multilingual design — proposed

Thai and English pilot; architecture supports additional locales and right-to-left layouts later. A translated interface is not evidence that local services or support exist in that language. Display each program's service language and actual country coverage.

Target WCAG 2.2 AA as an engineering goal, verified against the applicable standard during implementation; no conformance claim is made by this pack. Use semantic landmarks, correct headings and form labels, visible focus, keyboard operation, skip links, screen-reader status announcements, sufficient contrast and non-color-only meaning. Support zoom/reflow, reduced motion, readable text sizes and touch targets. Avoid time-limited consent; allow extensions for necessary session expiry with safe draft handling.

Use short sentences, one task per step, clear error recovery, icons with text and “read original” for translations. AI chat is optional; every critical action has a structured form. Do not require voice, camera, drag gestures, captcha puzzles or precise typing as the sole route. Provide accessible human assistance appropriate to funded support hours.

All user-facing text uses message catalogs, including errors, notices, emails, empty states and consent. Use locale-aware plurals, dates/numbers/currency and safe text direction. Store UTC timestamps, display timezone explicitly when deadlines matter, distinguish Buddhist/Gregorian year presentation if supported, and show original program deadline timezone. Preserve names without Western first/last-name assumptions. Avoid concatenated translated sentences.

Safety, consent and eligibility translations need a competent human reviewer; record source version and invalidate translations when source changes. Never label machine translation as verified. Missing translation shows labeled original plus assistance, not silent invented text. Thai segmentation/search and mixed-language query handling require fixtures; do not rely on English tokenization.

Low-bandwidth design: text-first listings, compressed optional images, paginated results, server filtering, no autoplay and usable loading/retry states. Do not cache sensitive cases or prompts in a service worker. Public read-only caching may be considered later, with clear freshness and online revalidation before referrals. Shared-device logout clears local sensitive state; notifications default to neutral wording.

Manual QA before pilot: keyboard-only complete referral, screen reader in Thai/English, zoom/reflow on small mobile, reduced motion, contrast, form errors, language switching, timezones and a constrained-network test. Include paid/compensated usability review with representative disabled and older participants under an approved research protocol; do not collect medical details merely to recruit testers.
