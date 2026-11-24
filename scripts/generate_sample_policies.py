"""Generate clearly labelled SAMPLE policy PDFs for demonstrating CampusSage.

These are NOT official Bennett University documents. They exist only so the
RAG pipeline, prompt lab and test suite can be demonstrated end to end.
Replace them with genuine, publicly available university documents by
uploading those through the Policy Library page.

Usage:  python scripts/generate_sample_policies.py
Output: sample-documents/*.pdf
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parent.parent / "sample-documents"
BANNER = "SAMPLE DOCUMENT FOR DEMONSTRATION ONLY - NOT AN OFFICIAL BENNETT UNIVERSITY POLICY"

# Each document: (filename, title, category, [(heading, [(clause_no, text), ...]), ...])
DOCUMENTS = [
    (
        "SAMPLE_Attendance_Policy.pdf",
        "Attendance Policy (Sample)",
        "Attendance Policy",
        [
            ("1 Scope", [
                ("1.1", "This policy applies to all undergraduate and postgraduate students enrolled in full-time programmes."),
            ]),
            ("2 Attendance Requirements", [
                ("2.1", "Minimum Attendance. A student must maintain a minimum of 75% attendance in each course, counting lectures, tutorials and laboratory sessions together, to be eligible to appear in the end-semester examination of that course."),
                ("2.2", "Attendance is calculated from the first day of instruction to the last day of instruction of the semester."),
                ("2.3", "Late Arrival. A student arriving more than 10 minutes after the start of a class may be marked absent at the discretion of the instructor."),
            ]),
            ("3 Condonation of Shortfall", [
                ("3.1", "Medical Condonation. The Dean of Academics may condone a shortfall of up to 10% (that is, down to 65% attendance) on medical grounds, if a medical certificate is submitted to the Academic Office within 7 days of resuming classes."),
                ("3.2", "Official Duty Leave. Absence due to participation in university-approved sports, cultural or NCC events is treated as official duty leave if it is approved in advance by the Head of Department."),
                ("3.3", "Condonation is not a right and is granted at the discretion of the Dean of Academics."),
            ]),
            ("4 Consequences of Shortfall", [
                ("4.1", "A student whose attendance remains below the requirement after condonation will be debarred from the end-semester examination of that course and will receive the grade DB (Debarred)."),
                ("4.2", "A debarred student must re-register for the course in a subsequent semester."),
            ]),
            ("5 Monitoring", [
                ("5.1", "Attendance is published on the student portal every week. Students are responsible for checking their own attendance regularly."),
            ]),
        ],
    ),
    (
        "SAMPLE_Examination_Policy.pdf",
        "Examination Policy (Sample)",
        "Examination Policy",
        [
            ("1 Eligibility", [
                ("1.1", "To be eligible for the end-semester examination of a course, a student must (a) meet the attendance requirement of the Attendance Policy, (b) have no outstanding fee dues, and (c) be registered for the course."),
                ("1.2", "Students must carry a valid admit card and university identity card to every examination."),
            ]),
            ("2 Conduct of Examinations", [
                ("2.1", "Reporting Time. Students must report to the examination hall at least 15 minutes before the start of the examination. No student will be admitted more than 30 minutes after the examination has started."),
                ("2.2", "Mobile phones, smart watches and other electronic devices are not permitted inside the examination hall."),
                ("2.3", "Any use of unfair means will be referred to the Unfair Means Committee."),
            ]),
            ("3 Re-evaluation", [
                ("3.1", "A student may apply for re-evaluation of an end-semester answer script within 7 days of the declaration of results, on payment of a re-evaluation fee of Rs. 1,000 per course."),
            ]),
            ("4 Make-up Examination", [
                ("4.1", "A student who misses an end-semester examination because of hospitalisation may apply for a make-up examination within 5 days of the missed examination, with supporting medical documents."),
            ]),
        ],
    ),
    (
        "SAMPLE_Fee_Regulations.pdf",
        "Fee Regulations (Sample)",
        "Fee Regulations",
        [
            ("1 Payment Schedule", [
                ("1.1", "Semester fees are payable in advance at the start of each semester."),
                ("1.2", "Due Dates. The last date for paying the odd-semester fee without a late fee is 31 July. The last date for paying the even-semester fee without a late fee is 31 December."),
            ]),
            ("2 Late Payment", [
                ("2.1", "Late Fee. Fees paid after the due date attract a late fee of Rs. 500 per week of delay, subject to a maximum of Rs. 5,000."),
                ("2.2", "Students whose fee dues remain outstanding more than 30 days after the due date will not be permitted to appear in examinations."),
            ]),
            ("3 Refunds", [
                ("3.1", "A student who withdraws within 15 days of the start of the semester is eligible for a refund of the tuition fee minus a processing charge of Rs. 10,000. No tuition fee is refunded after 15 days."),
            ]),
            ("4 Modes of Payment", [
                ("4.1", "Fees can be paid online through the student portal or by demand draft at the Accounts Office."),
            ]),
        ],
    ),
    (
        "SAMPLE_Hostel_Policy.pdf",
        "Hostel Policy (Sample)",
        "Hostel Policy",
        [
            ("1 Allotment", [
                ("1.1", "Hostel rooms are allotted for one academic year at a time, subject to availability."),
            ]),
            ("2 Entry and Exit", [
                ("2.1", "In-Time. Hostel residents must return to the hostel by 10:00 PM. Late entry requires prior permission from the Warden."),
                ("2.2", "Night-out. Staying out overnight requires written permission from the Warden and consent from a parent or guardian."),
            ]),
            ("3 Visitors", [
                ("3.1", "Visitors are permitted in the visitor lounge between 9:00 AM and 7:00 PM. Visitors are not permitted inside residents' rooms."),
                ("3.2", "Overnight stay of guests in the hostel is not permitted."),
            ]),
            ("4 Conduct", [
                ("4.1", "Possession or consumption of alcohol, tobacco or narcotic substances in the hostel is strictly prohibited."),
                ("4.2", "Cooking appliances such as induction stoves and electric kettles are not permitted in rooms."),
            ]),
            ("5 Hostel Fee", [
                ("5.1", "The hostel fee is charged per semester and must be paid along with the semester fee."),
            ]),
        ],
    ),
    (
        "SAMPLE_Academic_Regulations.pdf",
        "Academic Regulations (Sample)",
        "Academic Regulations",
        [
            ("1 Registration", [
                ("1.1", "Students must register for courses at the start of every semester within the registration window announced by the Academic Office."),
                ("1.2", "Credit Limits. A student may register for a minimum of 16 credits and a maximum of 26 credits in a regular semester."),
            ]),
            ("2 Progression", [
                ("2.1", "To be promoted to the next academic year, a student must have earned at least 50% of the credits registered for in the previous academic year."),
            ]),
            ("3 Semester Drop", [
                ("3.1", "A student may apply for a semester drop (break in studies) for a maximum of two semesters during the programme, with the approval of the Dean of Academics."),
            ]),
            ("4 Grading", [
                ("4.1", "The minimum passing grade in a course is D. A student who receives grade F must re-register for the course or appear in the supplementary examination."),
            ]),
            ("5 Maximum Duration", [
                ("5.1", "A student must complete all programme requirements within the normal programme duration plus two years."),
            ]),
        ],
    ),
    (
        "SAMPLE_General_Notice_GN-2026-014.pdf",
        "General Notice GN/2026/014 (Sample)",
        "General Notices",
        [
            ("1 Revised Late Fee", [
                ("1.1", "With effect from the odd semester of 2026, fees paid after the due date will attract a late fee of Rs. 1,000 per week of delay."),
            ]),
            ("2 Library Hours During Examinations", [
                ("2.1", "During end-semester examination weeks the central library will remain open until 11:00 PM."),
            ]),
        ],
    ),
]


def build(filename: str, title: str, category: str, sections) -> Path:
    styles = getSampleStyleSheet()
    banner = ParagraphStyle("banner", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#B42318"), alignment=1)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#0B1F3A"))
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#475467"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor("#0B1F3A"), spaceBefore=8)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=10.5, leading=14, spaceAfter=4)

    path = OUT / filename
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm, title=title,
                            author="CampusSage demo (Agentic Minds)", subject=BANNER)
    story = [Paragraph(BANNER, banner), Spacer(1, 4), Paragraph(title, h1),
             Paragraph(f"Category: {category} &nbsp;|&nbsp; Demo University &nbsp;|&nbsp; Version: sample-1.0", meta),
             Spacer(1, 8)]
    for heading, clauses in sections:
        story.append(Paragraph(heading, h2))
        for no, text in clauses:
            story.append(Paragraph(f"{no} {text}", body))

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#B42318"))
        canvas.drawCentredString(A4[0] / 2, 10 * mm, BANNER)
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, title, category, sections in DOCUMENTS:
        print("wrote", build(filename, title, category, sections).relative_to(OUT.parent))


if __name__ == "__main__":
    main()
