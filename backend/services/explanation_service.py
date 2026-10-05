"""
ExplanationService — provides plain-language explanations for difficult legal terms.

Contains 50+ legal terms commonly found in Indian and international legal documents.
Used for Step 11 (Branch 3) of the LegalSafe-G pipeline: Easy-Term Explanations.
"""

import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ExplanationService:
    """
    Detects difficult legal terms in simplified text and generates
    a citizen-friendly glossary with plain-language explanations.
    """

    def __init__(self):
        # 50+ term legal dictionary — real definitions, citizen-friendly language
        self.dictionary: Dict[str, str] = {
            # Obligations & agreements
            "indemnify":          "To protect someone from financial loss or legal liability caused by your actions.",
            "indemnification":    "A promise to cover someone's losses or legal costs if something goes wrong.",
            "covenant":           "A serious legal promise written into a contract that both parties must follow.",
            "warranty":           "A guarantee that something is true or will work as promised. If broken, compensation is owed.",
            "representation":     "A statement of fact made to convince the other party to sign the contract.",
            "undertaking":        "A formal promise to do (or not do) something.",
            "obligation":         "A legal duty you are required to perform under a contract.",

            # Liability & risk
            "liability":          "Legal responsibility for causing harm, loss, or damage to another person.",
            "indemnity":          "Money paid to cover a loss or injury caused by one party to another.",
            "damages":            "Money paid as compensation for loss or injury caused by a breach of contract.",
            "liquidated damages": "A fixed amount of money agreed in advance that must be paid if the contract is broken.",
            "consequential damages": "Losses that result indirectly from a breach, such as lost profits.",
            "penalty":            "A financial punishment for breaking a rule or contract term.",
            "limitation of liability": "A clause that caps the maximum amount one party can be made to pay.",

            # Property & tenancy
            "easement":           "The legal right to use someone else's land for a specific purpose (e.g., a pathway).",
            "encumbrance":        "A claim, mortgage, or lien on a property that limits how the owner can use it.",
            "lien":               "A legal right to hold or sell someone's property until they pay a debt.",
            "sublet":             "When a tenant rents out part or all of the rented property to another person.",
            "sublease":           "A rental agreement where the original tenant becomes a landlord to a new tenant.",
            "mortgage":           "A loan secured against property — if not repaid, the lender can take the property.",
            "tenancy":            "A legal right to occupy and use a property owned by someone else, usually by paying rent.",
            "lessor":             "The person who owns and rents out a property (the landlord).",
            "lessee":             "The person who rents and occupies a property (the tenant).",
            "premises":           "The building or land that is being rented or discussed in the contract.",
            "vacant possession":  "Handing over a property completely empty and free of people and belongings.",

            # Dispute resolution
            "arbitration":        "A private process where a neutral third party (arbitrator) resolves a dispute instead of a court.",
            "jurisdiction":       "The authority of a specific court or legal system to hear a case.",
            "mediation":          "A voluntary process where a neutral person helps two parties reach a settlement.",
            "litigation":         "The process of taking a legal dispute to court.",
            "adjudication":       "A legal judgment or decision made by a judge or arbitrator.",

            # Contract terms
            "force majeure":      "An unexpected event (like a flood or war) that makes it impossible to fulfill a contract, excusing a party from performing.",
            "breach":             "Failing to do what you promised in a contract without a valid legal excuse.",
            "termination":        "Officially ending a contract before its natural end date.",
            "rescission":         "Cancelling a contract as if it never existed, restoring both parties to their original position.",
            "assignment":         "Transferring your rights or duties under a contract to another person.",
            "novation":           "Replacing one party in a contract with a new party, with everyone's agreement.",
            "consideration":      "Something of value (money, services, goods) exchanged between parties to make a contract legally binding.",
            "clause":             "A specific section or provision in a legal document dealing with a particular topic.",
            "addendum":           "An addition or supplement made to a contract after it was originally signed.",
            "amendment":          "An official change made to the terms of a contract.",
            "waiver":             "Voluntarily giving up a legal right you are entitled to.",

            # Financial & commercial
            "interest":           "Extra money charged for borrowing money, calculated as a percentage of the amount owed.",
            "principal":          "The original amount of money borrowed or invested, before interest is added.",
            "default":            "Failing to fulfill a financial or legal obligation — especially failing to repay a loan.",
            "escrow":             "Money held by a neutral third party until specific conditions in a contract are met.",
            "royalty":            "A payment made for the right to use someone else's work, invention, or property.",
            "intellectual property": "Creations of the mind (inventions, designs, brand names, creative works) that are legally owned.",
            "confidentiality":    "A legal duty to keep certain information private and not share it with others.",
            "non-disclosure":     "An agreement not to share private or sensitive information with outside parties.",

            # Indian-specific
            "stamp duty":         "A tax paid to the government when registering legal documents like property agreements.",
            "notarisation":       "The process of having a document officially certified by a notary public.",
            "registered deed":    "A legal document that has been officially recorded with the government registry.",
            "power of attorney":  "A document giving one person the legal authority to act on behalf of another.",
        }

    def get_explanation(self, term: str) -> Optional[str]:
        """Return the plain-language explanation for a legal term, or None if not found."""
        return self.dictionary.get(term.lower())

    def find_difficult_terms(self, text: str) -> List[Dict[str, str]]:
        """
        Scan text for known difficult legal terms.

        Args:
            text: A string (or list of strings — joined automatically).

        Returns:
            List of dicts: [{"term": ..., "explanation": ...}, ...]
        """
        # Accept both str and list[str]
        if isinstance(text, list):
            text = ' '.join(str(t) for t in text)

        text_lower = text.lower()
        found = []
        seen = set()

        for term, explanation in self.dictionary.items():
            # Skip placeholder terms
            if term.startswith('legal_term_'):
                continue
            pattern = r'\b' + re.escape(term) + r'\b'
            if re.search(pattern, text_lower) and term not in seen:
                found.append({'term': term, 'explanation': explanation})
                seen.add(term)

        return found

    def generate_glossary(self, texts) -> List[Dict[str, str]]:
        """
        Generate a glossary for a list of text blocks.

        Args:
            texts: A string or list of strings to scan.

        Returns:
            List of dicts: [{"term": ..., "explanation": ...}, ...]
        """
        if isinstance(texts, str):
            combined = texts
        else:
            combined = ' '.join(str(t) for t in texts)

        return self.find_difficult_terms(combined)
