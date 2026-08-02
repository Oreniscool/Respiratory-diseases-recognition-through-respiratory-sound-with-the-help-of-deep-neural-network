# Security and privacy policy

## Supported scope

This repository is a research prototype. Report security or privacy issues
privately to the repository owner rather than including sensitive details in a
public issue. The owner should add a monitored contact before public release.

## Deployment baseline

- Require model metadata with `RESPINET_REQUIRE_METADATA=1`.
- Run behind TLS and a production WSGI server.
- Restrict CORS to known origins.
- Add authentication, authorization, rate limiting, request IDs, and audit
  logging at the deployment layer.
- Keep upload and decoded-duration limits enabled.
- Store neither uploads nor patient context unless a reviewed retention policy
  requires it.
- Never expose the Flask development server directly to the internet.

## External LLM

The API requires explicit consent and allowlists structured fields before an
external LLM request. Direct identifiers and free-text fields are removed.
Deployers must still review provider retention, residency, contractual terms,
prompt-injection risk, generated clinical language, and deletion procedures.

## Artifact safety

Only load model files produced by a trusted pipeline and verified against their
metadata hash. Python pickle files can execute code during deserialization; the
unused `scaler.pkl` must not be loaded unless its provenance is verified, and
should otherwise be removed.
