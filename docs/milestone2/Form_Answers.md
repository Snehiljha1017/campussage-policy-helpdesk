# Milestone 2 form: answers that must match the PDF

Final answers, updated 24 Nov 2026 after the live Claude run (run 3) and the reel. The team leader copies them into the
form in one sitting. Only the two enrollment numbers (marked `[S24CSEU____]`) still have to be typed in by the team.

| Q | Question | Answer |
|---|---|---|
| 1 | Team ID | PE-B01-18 |
| 2 | Team name | Agentic Minds |
| 3 | Project title | CampusSage — AI-Powered University Policy & Student Helpdesk |
| 4–5 | Team leader + enrollment | Snehil Jha, [S24CSEU____] |
| 6 | Group (batch) | B01 - B12 |
| 7 | Enrollment numbers (one per line) | [S24CSEU____] (Snehil Jha) / [S24CSEU____] (Tanya Sinha) |
| 8 | Project type (max 2) | **App with code** (only this one: CampusSage is a React + FastAPI app; the prompt workflow runs inside it) |
| 9 | Main AI tool and model | **Claude (via claude.ai) in our CampusSage React web app with an in-browser RAG pipeline** (the model behind the reported V1/V2/V3 results, run 3) |
| 10 | Number of prompts | **1** (P1 Policy Answer, the only LLM call in the final solution; one prompt sheet in Section 2) |
| 11 | Prototype link | https://snehiljha1017.github.io/campussage-policy-helpdesk/ (opens for anyone, no login) |
| 12 | Repository link | https://github.com/Snehiljha1017/campussage-policy-helpdesk |
| 13 | Reel link | https://snehiljha1017.github.io/campussage-policy-helpdesk/docs/demo/ (plays in the browser; the file is `docs/demo/CampusSage_M2_reel.mp4`) |
| 14 | Reel length (s) | **126** |
| 15 | Supporting document type | Technical report |
| 16 | Upload | AgenticMinds_TechnicalReport.pdf |
| 17 | Number of test inputs | **22** (rows in the Section 4 test table: T01–T14 + holdout H01–H08) |
| 18 | Number of prompt versions | **3** (v1, v2, v3; v3 is the final version) |
| 19 | Prototype status | **All modules working** (every row of the Section 3 status table says Working: the live Claude run and both deployments were verified on 24 Nov 2026) |
| 20 | Working modules (one per line, same names as the status table) | Document ingestion / Retrieval and reranking / Question guards / Answer generation (LLM) / Citation validation and confidence / Chat interface / Prompt lab / Evaluation dashboard / Deployment |
| 21 | Upload Milestone 2 PDF | M2_PE-B01-18_CampusSage.pdf |
| 22 | Main task of each member | [S24CSEU____] – Snehil Jha – team leader: built the full CampusSage app, prompt versions V1–V3, the test suite and the live Claude comparison; M2 documents and reel / [S24CSEU____] – Tanya Sinha – first public prototype and test plan, retrieval fix, Pages demo and functional checks, policy sources (matches Section 7) |
| 23 | Anything the evaluator should know | "The public prototype runs the whole pipeline in the browser. A public page cannot hold an API key, so its answers come from the labelled extractive fallback (demo mode), and its Evaluation page shows our recorded live Claude run (run 3: V1 9/14, V2 13/14, V3 14/14). The Claude-powered copy is https://claude.ai/artifact/WTt2vSvfwz1VMsun82qr21 (needs a claude.ai sign-in and the owner's share). The bundled policies are labelled samples, not official policy. Source and run instructions are in the README." |
| 24 | Confirmation | Tick only after both members agree on Section 7 (contribution set to 50 / 50) |
