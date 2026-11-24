"""Which office to suggest when the policy documents don't answer a question.

Office names are deliberately generic. Replace them with the exact office names
and contact points from Bennett University's student handbook before deployment.
"""
from __future__ import annotations

import re

OFFICES = [
    (r"attend|condon|medical|leave|credit|register|registration|semester drop|break|grade|promot|degree|course|exchange|transfer",
     "Academic Office"),
    (r"exam|re-?evaluat|admit card|result|make-?up|unfair means|marks",
     "Examination Cell"),
    (r"fee|refund|payment|pay|scholarship|dues|demand draft|late fee",
     "Accounts Office"),
    (r"hostel|warden|room|mess|guest|visitor|night-?out|in-?time",
     "Hostel Office (Warden)"),
    (r"library|book",
     "Library"),
]
DEFAULT_OFFICE = "Student Welfare Office"


def suggest_office(question: str, category_hint: str | None = None) -> str:
    q = question.lower()
    for pattern, office in OFFICES:
        if re.search(pattern, q):
            return office
    if category_hint:
        for pattern, office in OFFICES:
            if re.search(pattern, category_hint.lower()):
                return office
    return DEFAULT_OFFICE
