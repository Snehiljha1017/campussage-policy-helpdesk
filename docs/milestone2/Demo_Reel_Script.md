# Demonstration reel script (target 130 s; allowed 90–150 s)

Record the **deployed app with the LLM key set**. The guidelines give 0 for the demo part if it shows mock-up screens.
The parts follow the order the guidelines require. Voice-over or captions; faces optional.
Upload to Drive ("anyone with the link") or unlisted YouTube, then write down the exact length in seconds for Q14.

| Time | Part | On screen | Voice-over / caption |
|---|---|---|---|
| 0:00–0:12 | **1. Problem** | Landing page hero, scroll to the categories | "Bennett students hunt through long PDFs and notices for rules on attendance, exams, fees and hostel, and ask seniors who give different answers. CampusSage answers from the official documents only, and quotes the clause." |
| 0:12–0:50 | **2. Prompt experiment** | Prompt Lab → Compare. Question T10: *"How much is the late fee if I pay my semester fee after the due date?"* Run V1 and V3 | "Same question, same retrieved excerpts. Our Milestone 1 prompt, V1, [describe what V1 actually did, e.g. picked one amount and had no status]. V3 adds an exact-quote rule, a contradiction rule and a self-check. It now reports Conflicting Evidence and quotes both clauses." Then cut to the Evaluation chart: "Across all 14 tests, citation accuracy went from __% to __% and hallucination from __% to __%." |
| 0:50–1:50 | **3. Working demo** | Chat: (a) T01 attendance → open the evidence and the 10-step trace; (b) T06 *"What is the deadline?"* → clarifying question → reply "fee payment" → answer; (c) T08 exchange programmes → Not Covered + office; (d) Policy Library: upload a PDF, watch it reach "indexed", open its clauses | "Every answer shows the exact clause, the section and a confidence that can never be higher than the evidence. Vague questions get one clarifying question. When the policies are silent, it says so and points to the right office. New policy PDFs are split into clauses and searchable in seconds." |
| 1:50–2:10 | **4. Progress and next steps** | Evaluation page: run the suite live, then filter Edge; show the failed holdout row H05 | "Done: full RAG app, three prompt versions, 14 tests plus an 8-question holdout, all run for real. One holdout Hinglish question still fails. For Milestone 3 we'll add query rewriting for Hinglish, load Bennett's public handbook and add OCR." |

Tips: zoom the browser to 110–125 % so the text is readable on a phone. Hide the bookmarks bar. Do the run once before
recording so the backend is warm (the Render free tier sleeps after inactivity).
