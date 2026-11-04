# AI safety — proposed P-12

The AI is an optional navigator, not an adjudicator. Rule-based search and a human route remain useful without it. No AI feature is implemented or evaluated in this pack.

## Allowed behavior

Translate plain-language intent into editable search filters; summarize authorized current listings with citations; explain possible fits and uncertainties; draft a referral preview for user review. State eligibility as program criteria subject to human confirmation, never guaranteed entitlement. Ask only necessary questions and accept “skip”.

## Prohibited behavior

No invented jobs/benefits/contacts, fabricated availability, automatic application submission, case closure, diagnosis, credit/hiring/benefit decisions, protected-trait inference, coercive upsell or exposing another person's records. No confidential case notes in embeddings or general model context. Do not use sponsor payment to change eligibility or priority. The model has no unrestricted internet or mutation tools in MVP.

## Grounding contract

Input = minimal user-approved filters + authorized listing snapshots. Each suggestion returns listing_id, source/version, explanation and uncertainty; output IDs must be a subset of retrieved eligible IDs. Server resolves names/URLs from stored source records, not generated strings. Filter before retrieval and revalidate after generation. Reject suspended, expired, out-of-region and inaccessible records. If none remain, say no verified matches and offer ordinary search/human support.

Imported text is untrusted content. Strip executable markup, delimit source content, ignore embedded instructions, avoid secret-bearing context and test prompt injection. Output schema validation is necessary but does not prove factual correctness. Human-reviewed translations required for safety/eligibility-critical content; show original text and translation state.

## Evaluation and rollout

Create synthetic Thai/English fixtures including older users, disability accommodations, caregiver constraints, code-switching, misspellings, no-match cases, stale listings, discriminatory requests, child disclosure, coercive helpers and malicious partner text. No real beneficiary transcripts.

Proposed minimum release suite: 100 fixed cases including 20 adversarial, all category-specific failures visible. Hard gate: zero unauthorized disclosures, invented listing IDs, prohibited actions or blocked minor profiling in the release suite. Every displayed suggestion must have a valid current source. Track relevance with human rubric (correct filters, useful options, understandable limits), abstention, language quality, accessibility and cost/latency; owner approves numerical relevance threshold after baseline. Passing 100 examples is not proof of general safety.

Compare AI to manual/rule-based search before claiming benefit; record reviewer disagreement and failure cases. Version model, prompt, retrieval configuration, catalog snapshot and evaluation results. Re-run on changes that affect behavior. Canary behind flag, manual fallback, monitored feedback and immediate disable path. No learning directly from unreviewed complaints or source content.

Distress/urgent requests get calm limits and verified local support information, with safeguarding escalation only through consented and staffed processes. Never imply live monitoring or automatic rescue. AI provider, contract, retention, spend limits and supported language performance remain unresolved before real-data use.
