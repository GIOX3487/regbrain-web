# Gap analysis: verified evidence and atomic completion

This change replaces the v20 assessment evaluator with v21. It does not certify the legal completeness of the requirements catalogue.

## Behavior

- A quote is accepted only in the named, unique uploaded document. Every omission segment is checked in order, including short segments; unknown or duplicate filenames cannot establish coverage.
- A declared applicable condition cannot be overridden by an AI exclusion. Exclusions need supported applicability; missing role answers remain unknown.
- Normative links require the exact regulation and article in a structured source heading (and paragraph if specified). Body cross-references, ambiguous compound references and national implementing acts are left unlinked until an exact mapping is available.
- Catalogue and source queries are paginated. Missing source text no longer removes catalogue obligations from the denominator. This does not imply that the catalogue itself is complete.
- Cache identity includes the requirement definitions, organisation size and model. Previous v20 cache entries are not reused. A catalogue/profile change during a run requires a fresh assessment.
- AI errors and invalid responses produce `to_verify`, with no inferred documentary gap; these degraded results are not cached.
- Checkpoint results and progress are saved together. Final gaps, action plans, completion status and staging cleanup are committed in one database transaction. An error rolls all of them back.
- A service-only lease prevents concurrent analysis workers. Expired workers cannot commit checkpoints or final results; the lease expires after ten minutes if a process dies.
- Null compliance scores display as N/D in the assessment list and PDF, rather than 0%.
- The assessment document generator loads persisted document text server-side, independent of embeddings or analysis cache hits. Its prompt still has a 40,000-character budget distributed across files; truncation is explicitly indicated in the context.

## Release sequence

1. Run the regression suite and the SQL transaction tests in CI.
2. Apply `20260916215104_gap_analysis_atomic_results.sql` to a staging database and verify a complete assessment, a resumed assessment, an AI failure and document generation. The local SQL suite uses an isolated PostgreSQL WASM runtime and the repository table definitions; it is not a hosted Supabase test.
3. Apply the migration to the target database **before merging/deploying the new Edge Function**. The current deployment workflow deploys functions but does not apply database migrations. Existing functions do not depend on the new objects, so the migration can precede the code release.
4. Allow in-flight v20 assessments to finish before deploying. A v20 run still in progress after deployment must be started again as a new assessment; completed historical assessments remain readable.
5. Verify the same flows on the target after release. This PR itself does not change production.

Rollback: restore the previous code while keeping the additive schema objects. Do not remove the migration objects while new workers are active. Investigate failed analyses using staged checks before starting a replacement assessment.

## Tests

`npm run test:backend` includes evidence/application rules, exact normative-source matching, pagination, cache identity and null-score formatting, plus a PostgreSQL integration suite. That suite injects checkpoint and action-plan failures, checks rollback and expired-worker fencing, and denies access to anonymous/authenticated roles.

Remaining product work: validate catalogue content and effective dates against normative sources, make exclusions and unresolved applicability reviewable by a human, retain page/offset evidence provenance, handle full long-document/OCR coverage, and close/reopen gaps with versioned new evidence. The current regex applicability mapping remains a heuristic; a versioned explicit applicability model is still needed.
