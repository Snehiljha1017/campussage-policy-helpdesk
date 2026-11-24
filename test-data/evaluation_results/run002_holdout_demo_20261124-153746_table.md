# Evaluation run 2 - suite: holdout - mode: demo

Started 2026-11-24T10:07:46+00:00, finished 2026-11-24T10:07:46+00:00. Repeats: 1.

> DEMO MODE: no LLM was called. Answers were produced by the extractive demo answerer. Re-run with an API key for the Milestone 2 table.

## Config `system`: 7/8 passed

| Metric | Value |
|---|---|
| Pass Rate | 88% |
| Status Accuracy | 88% |
| Factual Correctness | 80% |
| Citation Accuracy | 80% |
| Hallucination Rate | 0% |
| Policy Grounding | 100% |
| Format Compliance | 100% |
| Consistency | n/a |

| Test no. | Input (short) | Type | Expected output | Actual output (short) | Pass / Fail |
|---|---|---|---|---|---|
| H01 | If I get an F grade in a course, what are my options? | Normal | Answered: re-register or take the supplementary exam; Academic Regulations 4.1 | Answered: As per Academic Regulations (Sample), Section 4.1: The minimum passing grade in a course is D. A student who r | Pass |
| H02 | Are electric kettles allowed in hostel rooms? | Normal | Answered: not permitted; Hostel Policy 4.2 | Answered: As per Hostel Policy (Sample), Section 4.2: Cooking appliances such as induction stoves and electric kettles a | Pass |
| H03 | How long do I have to submit a medical certificate for atten | Normal | Answered: within 7 days of resuming classes; Attendance Policy 3.1 | Answered: As per Attendance Policy (Sample), Section 3.1: Medical Condonation. The Dean of Academics may condone a short | Pass |
| H04 | Can I get a refund if I withdraw after one month? | Edge | Answered: no tuition refund after 15 days; Fee Regulations 3.1 | Answered: As per Fee Regulations (Sample), Section 3.1: A student who withdraws within 15 days of the start of the semes | Pass |
| H05 | hostel mein raat ko kitne baje tak aana hai? | Edge | Answered: by 10:00 PM; Hostel Policy 2.1 | Not Covered: The provided policy documents do not cover this question. Please contact the Hostel Office (Warden). | Fail (status 'Not Covered', expected Answered; expected clause not among verified citations; missing fact: 10:00 PM / 10 PM / 10:00 pm) |
| H06 | What is the fee? | Edge | Needs Clarification: which fee | Needs Clarification: Which fee do you mean? For example: Payment Schedule (Fee Regulations); Refunds (Fee Regulations); Hostel Fee  | Pass |
| H07 | What is the WiFi password for the library? | Invalid | Not Covered | Not Covered: The provided policy documents do not cover this question. Please contact the Library. | Pass |
| H08 | Is there a dress code for students on campus? | Edge | Not Covered: documents do not mention a dress code | Not Covered: This question is outside the university policy documents CampusSage has. I can help with attendance, examinati | Pass |

