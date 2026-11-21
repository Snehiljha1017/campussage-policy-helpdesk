# CampusSage

CampusSage is a student-built prototype that prepares policy-grounded prompts from public policy text. It is a demonstration, not an official university service.

Live demo: https://snehiljha1017.github.io/campussage-policy-helpdesk/

## Try it

Open the [policy workbench](./prototype/). Add a public policy source and fictional question. Review the matching clause, copy the generated prompt into a model, and inspect the answer before use. The prototype does not connect to a model or send input to a server.

## Included

- Three prompt iterations and one final prompt candidate
- Local clause retrieval with ambiguity and abstention handling
- Ten selectable normal, edge, and instruction-injection evaluation cases
- Prompt generation, manual model-response entry, and structured JSON run export
- Twelve local functional checks; these are not LLM evaluation runs
- Dated policy source notes

## Limits

The bundled policy fixture paraphrases the 2024-25 Examination Manual and may be out of date. It is not verbatim policy text and does not establish current rules. Do not enter personal information or use this prototype to decide an individual student's eligibility. The prototype makes no model call. No model evaluation outputs have been recorded yet; the twelve checks are local code checks only.

## Deployment

GitHub Pages is enabled from the `main` branch and `/ (root)`. The live demo link above opens the hosted site.
