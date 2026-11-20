import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import openpyxl
from pypdf import PdfReader


def _clean_amount(val: Any) -> Decimal:
    """Clean monetary string or number into Decimal."""
    if val is None or val == "":
        return Decimal("0.00")
    if isinstance(val, (int, float, Decimal)):
        return Decimal(str(round(val, 2)))
    
    val_str = str(val).strip()
    # Remove currency symbols, commas, spaces
    val_str = re.sub(r"[₹Rs\$,\s]", "", val_str, flags=re.IGNORECASE)
    # Check for trailing Dr/Cr
    val_str = re.sub(r"\((?:Dr|Cr)\)|(?:Dr|Cr)$", "", val_str, flags=re.IGNORECASE)
    
    match = re.search(r"-?\d+(?:\.\d{1,2})?", val_str)
    if match:
        try:
            return Decimal(match.group(0))
        except Exception:
            return Decimal("0.00")
    return Decimal("0.00")


def _parse_date(val: Any) -> date | None:
    """Attempt to parse date from various bank string formats."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val

    s = str(val).strip()
    # Strip time if present e.g. "2026-11-15 00:00:00"
    if " " in s:
        s = s.split(" ")[0]

    formats = [
        "%d/%m/%Y", "%d-%m-%Y",
        "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d", "%Y/%m/%d",
        "%d %b %Y", "%d-%b-%Y", "%d/%b/%Y",
        "%d %B %Y", "%d-%B-%Y",
        "%b %d, %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


class BankStatementParser:
    @classmethod
    def parse_file(cls, filename: str, content: bytes) -> dict[str, Any]:
        """Auto-detect format and parse statement bytes into transactions."""
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext == "pdf":
            return cls.parse_pdf(content)
        elif ext in ["xlsx", "xls"]:
            return cls.parse_excel(content)
        elif ext == "csv" or ext == "txt":
            return cls.parse_csv(content)
        else:
            # Fallback attempt CSV then PDF
            try:
                return cls.parse_csv(content)
            except Exception:
                return cls.parse_pdf(content)

    @classmethod
    def parse_csv(cls, content: bytes) -> dict[str, Any]:
        """Parse CSV bank statement."""
        text = content.decode("utf-8", errors="replace")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return {"transactions": [], "opening_balance": None, "closing_balance": None}

        # Sniff delimiter
        sample = "\n".join(lines[:10])
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","

        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)

        header_idx = -1
        col_map = {}

        # Look for header row
        for i, row in enumerate(rows[:25]):
            row_lower = [str(c).strip().lower() for c in row]
            has_date = any("date" in c for c in row_lower)
            has_desc = any(any(k in c for k in ["description", "narration", "particulars", "remarks", "details"]) for c in row_lower)
            has_amount = any(any(k in c for k in ["amount", "debit", "withdrawal", "credit", "deposit", "dr", "cr"]) for c in row_lower)

            if has_date and (has_desc or has_amount):
                header_idx = i
                for col_i, col_name in enumerate(row_lower):
                    if "date" in col_name and "value" not in col_name:
                        col_map["date"] = col_i
                    elif any(k in col_name for k in ["description", "narration", "particulars", "remarks"]):
                        col_map["desc"] = col_i
                    elif any(k in col_name for k in ["debit", "withdrawal", "dr"]):
                        col_map["debit"] = col_i
                    elif any(k in col_name for k in ["credit", "deposit", "cr"]):
                        col_map["credit"] = col_i
                    elif "amount" in col_name:
                        col_map["amount"] = col_i
                    elif any(k in col_name for k in ["ref", "chq", "cheque", "utr", "txn id"]):
                        col_map["ref"] = col_i
                    elif "balance" in col_name:
                        col_map["balance"] = col_i
                break

        transactions = []
        start_row = header_idx + 1 if header_idx >= 0 else 0

        for row in rows[start_row:]:
            if not row or len(row) < 2:
                continue

            date_val = None
            if "date" in col_map and col_map["date"] < len(row):
                date_val = _parse_date(row[col_map["date"]])
            else:
                for cell in row:
                    date_val = _parse_date(cell)
                    if date_val:
                        break

            if not date_val:
                continue

            desc = ""
            if "desc" in col_map and col_map["desc"] < len(row):
                desc = str(row[col_map["desc"]]).strip()
            else:
                desc = " ".join(str(c).strip() for c in row if len(str(c).strip()) > 3)

            debit = Decimal("0.00")
            credit = Decimal("0.00")

            if "debit" in col_map and col_map["debit"] < len(row):
                debit = _clean_amount(row[col_map["debit"]])
            if "credit" in col_map and col_map["credit"] < len(row):
                credit = _clean_amount(row[col_map["credit"]])

            if debit == 0 and credit == 0 and "amount" in col_map and col_map["amount"] < len(row):
                amt = _clean_amount(row[col_map["amount"]])
                cell_raw = str(row[col_map["amount"]]).lower()
                if "cr" in cell_raw or "+" in cell_raw:
                    credit = abs(amt)
                elif "dr" in cell_raw or "-" in cell_raw or amt < 0:
                    debit = abs(amt)
                else:
                    debit = abs(amt)

            ref_no = str(row[col_map["ref"]]).strip() if ("ref" in col_map and col_map["ref"] < len(row)) else None
            bal = _clean_amount(row[col_map["balance"]]) if ("balance" in col_map and col_map["balance"] < len(row)) else None

            raw_type = "DEBIT" if debit > 0 else "CREDIT"
            if debit > 0 or credit > 0:
                transactions.append({
                    "transaction_date": date_val,
                    "description": desc or "Bank Transaction",
                    "reference_no": ref_no,
                    "debit_amount": debit,
                    "credit_amount": credit,
                    "raw_type": raw_type,
                    "balance": bal,
                })

        return {
            "transactions": transactions,
            "opening_balance": transactions[0]["balance"] if transactions and transactions[0]["balance"] else None,
            "closing_balance": transactions[-1]["balance"] if transactions and transactions[-1]["balance"] else None,
        }

    @classmethod
    def parse_excel(cls, content: bytes) -> dict[str, Any]:
        """Parse Excel (.xlsx/.xls) bank statement."""
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return {"transactions": [], "opening_balance": None, "closing_balance": None}

        header_idx = -1
        col_map = {}

        for i, row in enumerate(rows[:25]):
            if not row:
                continue
            row_lower = [str(c).strip().lower() for c in row if c is not None]
            has_date = any("date" in c for c in row_lower)
            has_desc = any(any(k in c for k in ["description", "narration", "particulars", "remarks"]) for c in row_lower)
            has_amount = any(any(k in c for k in ["amount", "debit", "withdrawal", "credit", "deposit", "dr", "cr"]) for c in row_lower)

            if has_date and (has_desc or has_amount):
                header_idx = i
                for col_i, cell in enumerate(row):
                    if cell is None:
                        continue
                    col_name = str(cell).strip().lower()
                    if "date" in col_name and "value" not in col_name:
                        col_map["date"] = col_i
                    elif any(k in col_name for k in ["description", "narration", "particulars", "remarks"]):
                        col_map["desc"] = col_i
                    elif any(k in col_name for k in ["debit", "withdrawal", "dr"]):
                        col_map["debit"] = col_i
                    elif any(k in col_name for k in ["credit", "deposit", "cr"]):
                        col_map["credit"] = col_i
                    elif "amount" in col_name:
                        col_map["amount"] = col_i
                    elif any(k in col_name for k in ["ref", "chq", "cheque", "utr", "txn id"]):
                        col_map["ref"] = col_i
                    elif "balance" in col_name:
                        col_map["balance"] = col_i
                break

        transactions = []
        start_row = header_idx + 1 if header_idx >= 0 else 0

        for row in rows[start_row:]:
            if not row or len(row) < 2:
                continue

            date_val = None
            if "date" in col_map and col_map["date"] < len(row):
                date_val = _parse_date(row[col_map["date"]])
            else:
                for cell in row:
                    date_val = _parse_date(cell)
                    if date_val:
                        break

            if not date_val:
                continue

            desc = ""
            if "desc" in col_map and col_map["desc"] < len(row):
                desc = str(row[col_map["desc"]]).strip() if row[col_map["desc"]] is not None else ""
            else:
                desc = " ".join(str(c).strip() for c in row if c is not None and len(str(c).strip()) > 3)

            debit = Decimal("0.00")
            credit = Decimal("0.00")

            if "debit" in col_map and col_map["debit"] < len(row):
                debit = _clean_amount(row[col_map["debit"]])
            if "credit" in col_map and col_map["credit"] < len(row):
                credit = _clean_amount(row[col_map["credit"]])

            if debit == 0 and credit == 0 and "amount" in col_map and col_map["amount"] < len(row):
                amt = _clean_amount(row[col_map["amount"]])
                cell_raw = str(row[col_map["amount"]]).lower() if row[col_map["amount"]] is not None else ""
                if "cr" in cell_raw or "+" in cell_raw:
                    credit = abs(amt)
                elif "dr" in cell_raw or "-" in cell_raw or amt < 0:
                    debit = abs(amt)
                else:
                    debit = abs(amt)

            ref_no = str(row[col_map["ref"]]).strip() if ("ref" in col_map and col_map["ref"] < len(row) and row[col_map["ref"]] is not None) else None
            bal = _clean_amount(row[col_map["balance"]]) if ("balance" in col_map and col_map["balance"] < len(row) and row[col_map["balance"]] is not None) else None

            raw_type = "DEBIT" if debit > 0 else "CREDIT"
            if debit > 0 or credit > 0:
                transactions.append({
                    "transaction_date": date_val,
                    "description": desc or "Bank Transaction",
                    "reference_no": ref_no,
                    "debit_amount": debit,
                    "credit_amount": credit,
                    "raw_type": raw_type,
                    "balance": bal,
                })

        return {
            "transactions": transactions,
            "opening_balance": transactions[0]["balance"] if transactions and transactions[0]["balance"] else None,
            "closing_balance": transactions[-1]["balance"] if transactions and transactions[-1]["balance"] else None,
        }

    @classmethod
    def parse_pdf(cls, content: bytes) -> dict[str, Any]:
        """Parse text-based PDF bank statement."""
        reader = PdfReader(io.BytesIO(content))
        all_lines = []
        for page in reader.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                line_str = line.strip()
                if line_str:
                    all_lines.append(line_str)

        # Regex for transaction line: starts or contains date like 05/11/2026 or 15-Nov-2026
        date_pattern = re.compile(r"(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b)")
        amount_pattern = re.compile(r"(\b\d+(?:,\d+)*(?:\.\d{2})\b)")

        transactions = []
        for line in all_lines:
            d_match = date_pattern.search(line)
            if not d_match:
                continue

            date_val = _parse_date(d_match.group(1))
            if not date_val:
                continue

            # Find all currency amounts in this line
            amounts = amount_pattern.findall(line)
            if not amounts:
                continue

            # Remove date string from line to isolate description and amounts
            remainder = line.replace(d_match.group(1), "").strip()

            debit = Decimal("0.00")
            credit = Decimal("0.00")
            balance = None

            # Detect DR / CR indicators
            line_upper = line.upper()
            is_dr = "DR" in line_upper or "DEBIT" in line_upper or "WITHDRAWAL" in line_upper
            is_cr = "CR" in line_upper or "CREDIT" in line_upper or "DEPOSIT" in line_upper

            clean_amts = [_clean_amount(a) for a in amounts if _clean_amount(a) > 0]
            if not clean_amts:
                continue

            if len(clean_amts) == 1:
                amt = clean_amts[0]
                if is_cr and not is_dr:
                    credit = amt
                else:
                    debit = amt
            elif len(clean_amts) == 2:
                # Often amount and balance, or debit and credit
                if is_cr and not is_dr:
                    credit = clean_amts[0]
                    balance = clean_amts[1]
                else:
                    debit = clean_amts[0]
                    balance = clean_amts[1]
            else:
                # 3+ amounts: Debit, Credit, Balance
                debit = clean_amts[0]
                credit = clean_amts[1]
                balance = clean_amts[2]

            # Clean description
            desc = remainder
            for amt_str in amounts:
                desc = desc.replace(amt_str, "")
            desc = re.sub(r"\b(DR|CR|CHQ|REF|UTR)\b", "", desc, flags=re.IGNORECASE)
            desc = re.sub(r"\s+", " ", desc).strip()

            raw_type = "DEBIT" if debit > 0 else "CREDIT"
            if debit > 0 or credit > 0:
                transactions.append({
                    "transaction_date": date_val,
                    "description": desc or "Bank Transaction",
                    "reference_no": None,
                    "debit_amount": debit,
                    "credit_amount": credit,
                    "raw_type": raw_type,
                    "balance": balance,
                })

        return {
            "transactions": transactions,
            "opening_balance": transactions[0]["balance"] if transactions and transactions[0]["balance"] else None,
            "closing_balance": transactions[-1]["balance"] if transactions and transactions[-1]["balance"] else None,
        }
