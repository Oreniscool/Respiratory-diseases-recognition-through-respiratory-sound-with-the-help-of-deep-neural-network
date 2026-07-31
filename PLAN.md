# RespiNet Frontend Revamp Plan

Status: in progress  
Canonical frontend: `frontend-react`  
Selected visual target: generated option 3, **Respiratory Atlas**

## Outcome

Rebuild the existing React application as a coherent, responsive research-and-learning product for respiratory researchers, clinicians reviewing research, educators, and students. The interface must make respiratory-audio analysis understandable without presenting model output as diagnosis or medical advice.

## Delivery sequence

1. **Foundation**
   - Freeze the selected visual reference and document the design system.
   - Replace the neon/glass theme with the Respiratory Atlas token system.
   - Simplify navigation to Analyze, Evidence, and Learn while preserving legacy URLs with redirects.
2. **Analyze**
   - Make recording review, upload/sample selection, analysis, and evidence reading one clear journey.
   - Preserve real backend prediction, microphone recording, server readiness, report generation, and explainability hand-off.
   - Show honest loading, empty, error, and result states; remove simulated pipeline delays and diagnostic language.
3. **Evidence**
   - Present the model method, ICBHI dataset facts, historical benchmark caveats, provenance, and responsible-use boundaries.
   - Use direct labels, tables, and citations instead of decorative dashboard metrics.
4. **Learn**
   - Publish a cited, plain-language respiratory reference covering the eight project labels and the difference between sounds and diseases.
   - Remove treatment recommendations, severity scoring, and one-to-one sound/disease claims.
5. **Result details**
   - Restyle report and explainability views to match the same tokens, hierarchy, and safety language.
6. **Quality gate**
   - Run TypeScript and production builds.
   - Run the app, test primary interactions and responsive layouts, capture the implementation, and compare it with the selected reference.
   - Save `design-qa.md`; fix all P0/P1/P2 issues before handoff.
7. **Handoff**
   - Update `CHANGELOG.md` with completed work and verification evidence.
   - Keep a verified local preview running.

## Acceptance criteria

- All primary navigation and legacy entry URLs work.
- Upload, demo-sample analysis, microphone capture, result reading, report generation consent, and explainability routes remain functional.
- The model is never described as diagnosing, screening, clinically validating, or ruling out disease.
- Percentages are consistently described as uncalibrated model scores.
- Clinical/reference content is linked to authoritative sources.
- Desktop, tablet, and mobile layouts remain usable with visible focus and reduced-motion support.
- Production build passes and `design-qa.md` ends with `final result: passed`.

## Deferred engineering work

The architecture report documents deeper model/data-contract issues outside this visual revamp. The frontend will surface those limitations honestly, but this plan does not retrain the model, repair dataset labels, or change backend contracts.
