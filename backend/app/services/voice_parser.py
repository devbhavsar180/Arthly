import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any


# Keyword to Category & English Title dictionary
CATEGORY_MAPPINGS = [
    # INCOME categories
    {
        "category": "Monthly Salary",
        "title": "Monthly Salary",
        "type": "INCOME",
        "keywords": [
            "salary", "pagar", "tankhah", "darmoho", "veytan", "vetan", "salry",
            "પગાર", "સેલેરી", "વેતન", "દરમાહો"
        ],
    },
    {
        "category": "Freelancing",
        "title": "Freelancing Work",
        "type": "INCOME",
        "keywords": [
            "freelance", "freelancing", "client", "project income", "contract work",
            "ફ્રીલાન્સિંગ", "પ્રોજેક્ટ"
        ],
    },
    {
        "category": "Bonus",
        "title": "Bonus",
        "type": "INCOME",
        "keywords": [
            "bonus", "diwali bonus", "incentive", "inam",
            "બોનસ", "ઇનામ"
        ],
    },
    {
        "category": "Business Income",
        "title": "Business Income",
        "type": "INCOME",
        "keywords": [
            "business", "dhandho", "vyapar", "dukan bikri", "profit",
            "બિઝનેસ", "ધંધો", "વેપાર"
        ],
    },
    {
        "category": "Other Income",
        "title": "Other Income",
        "type": "INCOME",
        "keywords": [
            "interest", "vyaj", "cashback", "dividend", "gift income",
            "વ્યાજ", "કેશબેક"
        ],
    },

    # EXPENSE categories
    {
        "category": "Food",
        "title": "Breakfast",
        "type": "EXPENSE",
        "keywords": [
            "nasto", "nastama", "nashto", "nashta", "nashte", "breakfast", "snacks",
            "નાસ્તો", "નાસ્તામાં", "નાસ્તો કર્યો"
        ],
    },
    {
        "category": "Food",
        "title": "Lunch",
        "type": "EXPENSE",
        "keywords": [
            "lunch", "bapor nu javanu", "dopahar ka khana", "thali", "dhabo",
            "બપોરનું જમવાનું", "લંચ"
        ],
    },
    {
        "category": "Food",
        "title": "Dinner",
        "type": "EXPENSE",
        "keywords": [
            "dinner", "saanj nu jamvanu", "raat ka khana",
            "સાંજનું જમવાનું", "ડિનર", "ડિનરમાં"
        ],
    },
    {
        "category": "Food",
        "title": "Tea & Coffee",
        "type": "EXPENSE",
        "keywords": [
            "chai", "chaha", "coffee", "tea", "kitli",
            "ચા", "કોફી"
        ],
    },
    {
        "category": "Food",
        "title": "Restaurant / Food",
        "type": "EXPENSE",
        "keywords": [
            "hotel", "restaurant", "food", "swiggy", "zomato", "pizza", "burger", "dhaba", "khavanu",
            "જમવાનું", "હોટેલ", "રેસ્ટોરન્ટ"
        ],
    },
    {
        "category": "Travel",
        "title": "Auto Rickshaw",
        "type": "EXPENSE",
        "keywords": [
            "riksha", "rikshama", "rickshaw", "auto", "automa", "auto rickshaw",
            "રિક્શા", "રિક્શામાં", "ઓટો", "ઓટોરિક્શા"
        ],
    },
    {
        "category": "Travel",
        "title": "Petrol",
        "type": "EXPENSE",
        "keywords": [
            "petrol", "petrolnu", "diesel", "fuel", "gas", "cng",
            "પેટ્રોલ", "ડીઝલ", "ગેસ"
        ],
    },
    {
        "category": "Travel",
        "title": "Cab / Taxi",
        "type": "EXPENSE",
        "keywords": [
            "uber", "ola", "cab", "taxi",
            "ટેક્સી", "ઓલા", "ઉબર"
        ],
    },
    {
        "category": "Travel",
        "title": "Bus / Train / Metro",
        "type": "EXPENSE",
        "keywords": [
            "bus", "train", "metro", "ticket", "fare", "toll", "fastag", "travel",
            "બસ", "ટ્રેન", "મેટ્રો", "ટિકિટ", "ટોલ"
        ],
    },
    {
        "category": "Rent",
        "title": "House Rent",
        "type": "EXPENSE",
        "keywords": [
            "rent", "bhadu", "room bhadu", "ghar bhadu", "kiraya",
            "ભાડું", "રૂમ ભાડું", "ઘર ભાડું", "કિરાયા"
        ],
    },
    {
        "category": "Groceries",
        "title": "Groceries",
        "type": "EXPENSE",
        "keywords": [
            "groceries", "grocery", "kirana", "ration", "mart", "supermarket",
            "કરીયાણું", "રાશન", "ગ્રોસરી"
        ],
    },
    {
        "category": "Groceries",
        "title": "Milk & Dairy",
        "type": "EXPENSE",
        "keywords": [
            "dudh", "doodh", "milk", "amul", "chhas", "curd", "paneer",
            "દૂધ", "દૂધનું", "છાશ", "પનીર"
        ],
    },
    {
        "category": "Groceries",
        "title": "Vegetables & Fruits",
        "type": "EXPENSE",
        "keywords": [
            "shakbhaji", "shak", "sabzi", "vegetables", "fal", "fruits", "tameta", "bataka",
            "શાકભાજી", "શાક", "ફળ", "ફળો"
        ],
    },
    {
        "category": "Medical",
        "title": "Medicine",
        "type": "EXPENSE",
        "keywords": [
            "dawa", "medicine", "medical", "doctor", "hospital", "clinic", "chemist", "tablet", "pharma",
            "દવા", "દવાઓ", "મેડિકલ", "ડોક્ટર", "હોસ્પિટલ"
        ],
    },
    {
        "category": "Electricity",
        "title": "Electricity Bill",
        "type": "EXPENSE",
        "keywords": [
            "electricity", "light bill", "bijli", "power bill", "torrent", "mgvcl", "ugvcl", "pgvcl", "dgvcl",
            "લાઈટ બિલ", "વીજળી બિલ"
        ],
    },
    {
        "category": "Mobile Recharge",
        "title": "Mobile Recharge",
        "type": "EXPENSE",
        "keywords": [
            "mobile recharge", "recharge", "jio", "airtel", "vi", "vodafone", "phone bill",
            "મોબાઈલ રિચાર્જ", "રિચાર્જ"
        ],
    },
    {
        "category": "Internet",
        "title": "Internet Bill",
        "type": "EXPENSE",
        "keywords": [
            "internet", "wifi", "broadband", "fiber", "router", "gtpl",
            "ઇન્ટરનેટ", "વાઇફાઇ"
        ],
    },
    {
        "category": "Entertainment",
        "title": "Movie & Entertainment",
        "type": "EXPENSE",
        "keywords": [
            "movie", "cinema", "netflix", "theatre", "picnic", "game", "gaming", "outing", "hotstar",
            "મુવી", "સિનેમા", "મૂવી"
        ],
    },
    {
        "category": "Shopping",
        "title": "Shopping",
        "type": "EXPENSE",
        "keywords": [
            "shopping", "kapda", "clothes", "shoes", "dress", "amazon", "flipkart", "myntra", "mall",
            "શોપિંગ", "કપડાં"
        ],
    },
    {
        "category": "Personal",
        "title": "Personal Care",
        "type": "EXPENSE",
        "keywords": [
            "salon", "haircut", "parlour", "barber", "grooming", "gym",
            "સલૂન", "હેરકટ", "જીમ"
        ],
    },
]

# Gujarati / Hindi number words conversion
NUMBER_WORDS = {
    "ek": 1, "be": 2, "do": 2, "tran": 3, "teen": 3, "chaar": 4, "panch": 5, "paanch": 5,
    "chha": 6, "che": 6, "saat": 7, "aath": 8, "nav": 9, "nau": 9, "das": 10,
    "vis": 20, "bees": 20, "tris": 30, "tees": 30, "chalis": 40, "pachas": 50,
    "so": 100, "sau": 100, "ek sau": 100, "be sau": 200, "tran sau": 300, "panch sau": 500,
    "hajar": 1000, "hazaar": 1000, "lakh": 100000,
}

INCOME_ACTION_KEYWORDS = [
    "malya", "malyo", "malyu", "mali", "aavya", "aavyo", "aavu", "aayi", "aaye",
    "received", "credited", "got", "earned", "mila", "mile", "mili",
    "મળ્યા", "મળ્યું", "આવ્યા", "ક્રેડિટ", "મળ્યો"
]

EXPENSE_ACTION_KEYWORDS = [
    "kharchya", "kharchyo", "kharch", "aapya", "aapo", "bharavyu", "bharyu", "bharvu", "chukavyu",
    "spent", "paid", "gave", "bought", "kharcha", "diye", "bhara", "lagaya",
    "ખર્ચ્યા", "આપ્યા", "ભરાવ્યું", "ભર્યું", "ચૂકવ્યું"
]


class VoiceParserService:
    @staticmethod
    def detect_language(text: str) -> str:
        """Detect language: 'gu', 'hi', or 'en'."""
        # Check Gujarati Unicode block (\u0A80 to \u0AFF)
        if re.search(r"[\u0A80-\u0AFF]", text):
            return "gu"
        # Check Devanagari Unicode block (\u0900 to \u097F)
        if re.search(r"[\u0900-\u097F]", text):
            return "hi"

        # Transliterated Gujarati indicators
        gu_translit_tokens = [
            "aaje", "kharchya", "nastama", "rikshama", "bharavyu", "malya", "chukavyu",
            "rupiya", "rupiyanu", "ane", "dudh", "shakbhaji", "pagar", "parva", "kaale"
        ]
        text_lower = text.lower()
        for token in gu_translit_tokens:
            if re.search(r"\b" + token + r"\b", text_lower):
                return "gu"

        # Transliterated Hindi indicators
        hi_translit_tokens = ["aaj", "kharch", "kiya", "diye", "rupaye", "aur", "mila", "paisa"]
        for token in hi_translit_tokens:
            if re.search(r"\b" + token + r"\b", text_lower):
                return "hi"

        return "en"

    @staticmethod
    def extract_date(segment: str, base_date: date | None = None) -> date:
        today = base_date or date.today()
        seg_lower = segment.lower()

        # Yesterday patterns
        if any(w in seg_lower for w in [
            "yesterday", "gai kale", "gaikale", "kal me", "kal spent", "kal ",
            "bite kal", "ગઈ કાલે", "ગઈકાલે"
        ]):
            return today - timedelta(days=1)

        # Day before yesterday patterns
        if any(w in seg_lower for w in [
            "day before yesterday", "parva divse", "parwa", "parso", "પરમ દિવસે"
        ]):
            return today - timedelta(days=2)

        # Today patterns (default)
        return today

    @staticmethod
    def extract_amount(segment: str) -> Decimal | None:
        """Extract monetary amount in INR from text."""
        # Clean commas in numbers like 40,000 -> 40000
        cleaned = re.sub(r"(\d+),(\d+)", r"\1\2", segment)

        # Match direct numeric values, e.g. "150", "40000", "500.50", "150/-", "₹150", "150rs", "150 rupiya"
        # Look for numbers near currency indicators first
        match = re.search(r"(?:₹|rs\.?|inr|rupiya|rupaye|rupees)?\s*(\d+(?:\.\d{1,2})?)\s*(?:/-|rs\.?|inr|rupiya|rupiyanu|rupaye|rupees)?", cleaned, re.IGNORECASE)
        
        # Priority to amount right before or after currency words
        pattern_curr = re.search(r"(\d+(?:\.\d{1,2})?)\s*(?:rupiya|rupiyanu|rupaye|rupees|rs|inr)", cleaned, re.IGNORECASE)
        if pattern_curr:
            try:
                val = Decimal(pattern_curr.group(1))
                if val > 0:
                    return val
            except Exception:
                pass

        pattern_curr_pre = re.search(r"(?:₹|rs\.?|rupiya|rupaye|rupees)\s*(\d+(?:\.\d{1,2})?)", cleaned, re.IGNORECASE)
        if pattern_curr_pre:
            try:
                val = Decimal(pattern_curr_pre.group(1))
                if val > 0:
                    return val
            except Exception:
                pass

        # General number search if not found
        num_matches = re.findall(r"\b\d+(?:\.\d{1,2})?\b", cleaned)
        for num_str in num_matches:
            try:
                val = Decimal(num_str)
                # Filter out years e.g. 2026, 2025 unless realistic
                if val > 0 and val != 2024 and val != 2025 and val != 2026:
                    return val
            except Exception:
                continue

        # Check for word amounts like "40 hajar", "be sau"
        for word, val in NUMBER_WORDS.items():
            if re.search(r"\b" + word + r"\b", cleaned.lower()):
                return Decimal(str(val))

        return None

    @staticmethod
    def split_into_segments(raw_text: str) -> list[str]:
        """Split a compound sentence with multiple expenses into distinct clauses."""
        # Split delimiters: 'ane', 'aur', 'and', 'tatha', 'ne' (when surrounded by spaces), plus commas and semicolons
        # Handle cases like "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya."
        delimiters = [
            r"\s+ane\s+",
            r"\s+અને\s+",
            r"\s+aur\s+",
            r"\s+और\s+",
            r"\s+and\s+",
            r"\s+tatha\s+",
            r"\s+phir\s+",
            r"\s+also\s+",
            r"[;,\n]+",
        ]
        pattern = "|".join(delimiters)
        raw_segments = re.split(pattern, raw_text, flags=re.IGNORECASE)
        
        cleaned_segments = [s.strip() for s in raw_segments if s and len(s.strip()) > 3]
        
        # If no split occurred but text contains multiple amounts with keywords, split by numbers
        if len(cleaned_segments) <= 1:
            # Check if there are 2 or more distinct amounts
            amounts = re.findall(r"\d+\s*(?:rupiya|rupiyanu|rupaye|rupees|rs)", raw_text, re.IGNORECASE)
            if len(amounts) > 1:
                # We can try to split by secondary sentence indicators
                split_words = re.split(r"(?<=[a-zA-Z\u0A80-\u0AFF\u0900-\u097F])\s+(?=\d+\s*(?:rupiya|rupiyanu|rupaye|rupees|rs))", raw_text, flags=re.IGNORECASE)
                if len(split_words) > 1:
                    cleaned_segments = [s.strip() for s in split_words if s.strip()]

        return cleaned_segments if cleaned_segments else [raw_text.strip()]

    @classmethod
    def parse_segment(cls, segment: str, base_today: date | None = None) -> dict[str, Any] | None:
        """Parse a single clause into a structured candidate transaction."""
        today = base_today or date.today()
        amount = cls.extract_amount(segment)
        tx_date = cls.extract_date(segment, base_date=today)
        seg_lower = segment.lower()

        # Determine transaction type (INCOME vs EXPENSE)
        is_income = False
        for inc_kw in INCOME_ACTION_KEYWORDS:
            if re.search(r"\b" + re.escape(inc_kw) + r"\b", seg_lower):
                is_income = True
                break

        # Check matched category mappings
        matched_cat: str | None = None
        matched_title: str | None = None
        matched_type: str | None = None

        for mapping in CATEGORY_MAPPINGS:
            for kw in mapping["keywords"]:
                if re.search(r"\b" + re.escape(kw) + r"\b", seg_lower):
                    matched_cat = mapping["category"]
                    matched_title = mapping["title"]
                    matched_type = mapping["type"]
                    break
            if matched_cat:
                break

        tx_type = matched_type if matched_type else ("INCOME" if is_income else "EXPENSE")
        
        if not matched_cat:
            matched_cat = "Other Income" if tx_type == "INCOME" else "Other"
            # Clean segment to extract reasonable title
            clean_title = re.sub(r"\b(\d+|rupiya|rupiyanu|rupaye|rupees|rs|aaje|kal|spent|paid|kharchya|aapya)\b", "", seg_lower, flags=re.IGNORECASE)
            clean_title = clean_title.strip().capitalize()
            matched_title = clean_title if len(clean_title) >= 3 else ("Voice Income" if tx_type == "INCOME" else "Voice Expense")

        confidence = 0.95 if (amount and matched_cat != "Other") else (0.8 if amount else 0.4)
        warning = None
        if not amount:
            warning = "Amount could not be clearly recognized. Please enter the amount."

        return {
            "title": matched_title,
            "amount": float(amount) if amount else None,
            "category_name": matched_cat,
            "transaction_type": tx_type,
            "transaction_date": tx_date.isoformat(),
            "payment_mode": "Cash",
            "notes": f"Voice entry: '{segment.strip()}'",
            "confidence": confidence,
            "requires_attention": amount is None or amount <= 0,
            "warning": warning,
        }

    @classmethod
    def parse_speech_text(
        cls, text: str, preferred_language: str = "auto"
    ) -> dict[str, Any]:
        """Main entry point: parses transcribed voice text into structured transactions."""
        text = text.strip()
        if not text:
            return {
                "raw_text": "",
                "detected_language": preferred_language,
                "transactions": [],
                "warnings": ["No speech text received."],
            }

        today = date.today()
        detected_lang = cls.detect_language(text) if preferred_language == "auto" else preferred_language
        segments = cls.split_into_segments(text)
        
        # Check global date in speech (e.g. if the user says "Yesterday..." at the very start)
        global_date = cls.extract_date(text, base_date=today)

        parsed_transactions = []
        warnings = []

        for seg in segments:
            candidate = cls.parse_segment(seg, base_today=today)
            if candidate:
                # If segment had no specific date word, inherit global_date if global_date != today
                if global_date != today and candidate["transaction_date"] == today.isoformat():
                    candidate["transaction_date"] = global_date.isoformat()
                if candidate["requires_attention"]:
                    warnings.append(f"In clause '{seg}': {candidate['warning']}")
                parsed_transactions.append(candidate)

        # Fallback if no transactions could be segmented
        if not parsed_transactions:
            amt = cls.extract_amount(text)
            parsed_transactions.append({
                "title": "Expense",
                "amount": float(amt) if amt else None,
                "category_name": "Other",
                "transaction_type": "EXPENSE",
                "transaction_date": global_date.isoformat(),
                "payment_mode": "Cash",
                "notes": f"Voice entry: '{text}'",
                "confidence": 0.5,
                "requires_attention": amt is None,
                "warning": "Could not identify category or amount cleanly. Please edit details.",
            })

        return {
            "raw_text": text,
            "detected_language": detected_lang,
            "preferred_language": preferred_language,
            "transactions": parsed_transactions,
            "warnings": warnings,
        }
