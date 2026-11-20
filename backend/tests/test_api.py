import io
import os
from datetime import date

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(TEST_ENGINE, "connect")
def _enable_fk(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield


@pytest.fixture
def client():
    def _override_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _register_user(client: TestClient, email="dev@example.com", password="StrongPassword123", name="Dev User"):
    res = client.post(
        "/api/v1/auth/register",
        json={"full_name": name, "email": email, "password": password},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return data, headers


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_auth_lifecycle_and_password_reset(client: TestClient):
    reg, headers = _register_user(client)
    assert reg["user"]["settings"]["currency_code"] == "INR"
    assert reg["user"]["settings"]["currency_symbol"] == "₹"

    # Me endpoint
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "dev@example.com"

    # Refresh token
    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": reg["refresh_token"]})
    assert ref.status_code == 200
    assert "access_token" in ref.json()

    # Logout invalidates existing access token
    out = client.post("/api/v1/auth/logout", headers=headers)
    assert out.status_code == 200
    me_after = client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401

    # Forgot + Reset password flow
    fp = client.post("/api/v1/auth/forgot-password", json={"email": "dev@example.com"})
    assert fp.status_code == 200
    token = fp.json()["reset_token"]
    assert token

    rp = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewSecurePassword456"},
    )
    assert rp.status_code == 200

    # Login with new password succeeds; old fails
    bad = client.post("/api/v1/auth/login", json={"email": "dev@example.com", "password": "StrongPassword123"})
    assert bad.status_code == 401
    good = client.post("/api/v1/auth/login", json={"email": "dev@example.com", "password": "NewSecurePassword456"})
    assert good.status_code == 200


def test_predefined_and_custom_categories(client: TestClient):
    _, headers = _register_user(client)
    cats = client.get("/api/v1/categories", headers=headers).json()
    expense_names = {c["name"] for c in cats if c["type"] == "EXPENSE"}
    income_names = {c["name"] for c in cats if c["type"] == "INCOME"}

    expected_exp = {
        "Food", "Travel", "Rent", "Shopping", "Groceries", "Medical",
        "Electricity", "Mobile Recharge", "Internet", "Entertainment", "Personal", "Other",
    }
    expected_inc = {"Monthly Salary", "Freelancing", "Business Income", "Bonus", "Other Income"}
    assert expected_exp.issubset(expense_names)
    assert expected_inc.issubset(income_names)

    # Create custom category
    created = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Gym & Fitness", "type": "EXPENSE", "color": "#16A34A", "icon": "dumbbell"},
    )
    assert created.status_code == 201
    cat_id = created.json()["id"]

    # Edit custom category
    updated = client.put(
        f"/api/v1/categories/{cat_id}",
        headers=headers,
        json={"name": "Fitness", "color": "#059669"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Fitness"

    # Delete custom category
    deleted = client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    assert deleted.status_code == 200


def test_transactions_dashboard_calculations_and_user_isolation(client: TestClient):
    _, headers_a = _register_user(client, email="alice@example.com", name="Alice")
    _, headers_b = _register_user(client, email="bob@example.com", name="Bob")

    cats_a = client.get("/api/v1/categories", headers=headers_a).json()
    food_id = next(c["id"] for c in cats_a if c["name"] == "Food" and c["type"] == "EXPENSE")
    rent_id = next(c["id"] for c in cats_a if c["name"] == "Rent" and c["type"] == "EXPENSE")
    salary_id = next(c["id"] for c in cats_a if c["name"] == "Monthly Salary" and c["type"] == "INCOME")

    # Add manual salary income
    r_inc = client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={
            "transaction_type": "INCOME",
            "title": "October Salary",
            "amount": 80000.00,
            "category_id": salary_id,
            "transaction_date": "2026-10-31",
            "notes": "Credited end of month",
        },
    )
    assert r_inc.status_code == 201

    # Add expenses in Oct and Sep
    r_e1 = client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={
            "transaction_type": "EXPENSE",
            "title": "House Rent",
            "amount": 18000.00,
            "category_id": rent_id,
            "payment_mode": "UPI",
            "transaction_date": "2026-10-05",
        },
    )
    assert r_e1.status_code == 201

    r_e2 = client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={
            "transaction_type": "EXPENSE",
            "title": "Dinner Out",
            "amount": 2000.00,
            "category_id": food_id,
            "payment_mode": "Credit Card",
            "transaction_date": "2026-10-12",
        },
    )
    assert r_e2.status_code == 201

    r_prev = client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={
            "transaction_type": "EXPENSE",
            "title": "September Groceries",
            "amount": 5000.00,
            "category_id": food_id,
            "payment_mode": "Cash",
            "transaction_date": "2026-09-18",
        },
    )
    assert r_prev.status_code == 201

    # Verify dashboard calculations for October 2026
    dash = client.get("/api/v1/dashboard?month=10&year=2026", headers=headers_a).json()
    assert dash["cards"]["total_income"] == 80000.0
    assert dash["cards"]["total_expenses"] == 20000.0
    assert dash["cards"]["remaining_balance"] == 60000.0
    assert dash["cards"]["total_savings"] == 60000.0
    assert dash["cards"]["this_month_expenses"] == 20000.0
    assert dash["cards"]["previous_month_expenses"] == 5000.0

    ms = dash["monthly_summary"]
    assert ms["highest_expense_category"] == "Rent"
    assert ms["highest_expense_category_amount"] == 18000.0
    assert ms["highest_single_transaction"]["title"] == "House Rent"
    assert ms["average_daily_expense"] == round(20000.0 / 31, 2)

    # Expense percentages: Rent 90%, Food 10%
    pct_map = {item["category_name"]: item["percentage"] for item in dash["expense_breakdown"]}
    assert pct_map["Rent"] == 90.0
    assert pct_map["Food"] == 10.0

    # Filtering & sorting on transactions
    filtered = client.get(
        "/api/v1/transactions?search=Rent&payment_mode=UPI&transaction_type=EXPENSE&sort_by=amount&sort_order=desc",
        headers=headers_a,
    ).json()
    assert filtered["total_count"] == 1
    assert filtered["items"][0]["title"] == "House Rent"

    # Multi-user isolation: Bob cannot see or edit Alice's transactions
    bob_list = client.get("/api/v1/transactions", headers=headers_b).json()
    assert bob_list["total_count"] == 0
    bob_get = client.get(f"/api/v1/transactions/{r_e1.json()['id']}", headers=headers_b)
    assert bob_get.status_code == 404


def test_reports_pdf_excel_csv(client: TestClient):
    _, headers = _register_user(client)
    cats = client.get("/api/v1/categories", headers=headers).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")
    salary_id = next(c["id"] for c in cats if c["name"] == "Monthly Salary")

    today = date.today()
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "INCOME",
            "title": "Salary",
            "amount": 50000,
            "category_id": salary_id,
            "transaction_date": today.isoformat(),
        },
    )
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "EXPENSE",
            "title": "Lunch",
            "amount": 450.50,
            "category_id": food_id,
            "payment_mode": "UPI",
            "transaction_date": today.isoformat(),
        },
    )

    params = f"?month={today.month}&year={today.year}"
    for ep in ["/api/v1/reports/pdf/summary", "/api/v1/reports/pdf/expense", "/api/v1/reports/pdf/income"]:
        r = client.get(ep + params, headers=headers)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    r_xlsx = client.get("/api/v1/reports/excel" + params, headers=headers)
    assert r_xlsx.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(r_xlsx.content))
    assert set(wb.sheetnames) == {"Financial Summary", "Category Breakdown", "Transactions"}

    r_csv = client.get("/api/v1/reports/csv" + params, headers=headers)
    assert r_csv.status_code == 200
    assert "Lunch" in r_csv.content.decode("utf-8-sig")


def test_settings_backup_restore_and_delete_account(client: TestClient):
    _, headers = _register_user(client)
    cats = client.get("/api/v1/categories", headers=headers).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")

    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "EXPENSE",
            "title": "Coffee",
            "amount": 180,
            "category_id": food_id,
            "payment_mode": "UPI",
            "transaction_date": "2026-11-10",
        },
    )

    # Update profile & currency
    p = client.put("/api/v1/settings/profile", headers=headers, json={"full_name": "Dev Updated", "email": "dev@example.com"})
    assert p.status_code == 200
    assert p.json()["full_name"] == "Dev Updated"

    cur = client.put("/api/v1/settings/currency", headers=headers, json={"currency_code": "INR", "currency_symbol": "₹"})
    assert cur.status_code == 200

    # Export & Restore backup
    exp = client.get("/api/v1/settings/export", headers=headers)
    assert exp.status_code == 200
    backup = exp.json()
    assert len(backup["transactions"]) == 1

    res = client.post(
        "/api/v1/settings/restore",
        headers=headers,
        json={**backup, "replace_existing": True},
    )
    assert res.status_code == 200
    assert res.json()["transactions_restored"] == 1

    # Delete account permanently
    del_res = client.request(
        "DELETE",
        "/api/v1/settings/account",
        headers=headers,
        json={"password": "StrongPassword123", "confirmation": "DELETE"},
    )
    assert del_res.status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_voice_multilingual_expense_and_income_parsing(client: TestClient):
    _, headers = _register_user(client, email="voice@example.com", name="Voice User")

    # Example 1: Gujarati compound sentence
    # "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya."
    r1 = client.post(
        "/api/v1/voice/parse",
        headers=headers,
        json={"text": "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya.", "language": "gu"},
    )
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    assert d1["detected_language"] == "gu"
    assert len(d1["transactions"]) == 2
    assert d1["transactions"][0]["title"] == "Breakfast"
    assert float(d1["transactions"][0]["amount"]) == 150.0
    assert d1["transactions"][0]["category_name"] == "Food"
    assert d1["transactions"][0]["transaction_type"] == "EXPENSE"

    assert d1["transactions"][1]["title"] == "Auto Rickshaw"
    assert float(d1["transactions"][1]["amount"]) == 80.0
    assert d1["transactions"][1]["category_name"] == "Travel"
    assert d1["transactions"][1]["transaction_type"] == "EXPENSE"

    # Example 2: Gujarati single expense
    # "Aaje 500 rupiyanu petrol bharavyu."
    r2 = client.post(
        "/api/v1/voice/parse",
        headers=headers,
        json={"text": "Aaje 500 rupiyanu petrol bharavyu.", "language": "auto"},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert len(d2["transactions"]) == 1
    assert d2["transactions"][0]["title"] == "Petrol"
    assert float(d2["transactions"][0]["amount"]) == 500.0
    assert d2["transactions"][0]["category_name"] == "Travel"

    # Example 3: English expense
    # "Yesterday I spent 300 rupees on groceries."
    r3 = client.post(
        "/api/v1/voice/parse",
        headers=headers,
        json={"text": "Yesterday I spent 300 rupees on groceries.", "language": "en"},
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert len(d3["transactions"]) == 1
    assert d3["transactions"][0]["title"] == "Groceries"
    assert float(d3["transactions"][0]["amount"]) == 300.0
    assert d3["transactions"][0]["category_name"] == "Groceries"

    # Example 4: Gujarati salary income
    # "Aaje salary na 40000 rupiya malya."
    r4 = client.post(
        "/api/v1/voice/parse",
        headers=headers,
        json={"text": "Aaje salary na 40000 rupiya malya.", "language": "gu"},
    )
    assert r4.status_code == 200
    d4 = r4.json()
    assert len(d4["transactions"]) == 1
    assert d4["transactions"][0]["title"] == "Monthly Salary"
    assert float(d4["transactions"][0]["amount"]) == 40000.0
    assert d4["transactions"][0]["category_name"] == "Monthly Salary"
    assert d4["transactions"][0]["transaction_type"] == "INCOME"


def test_voice_confirm_and_history(client: TestClient):
    _, headers = _register_user(client, email="voice_confirm@example.com", name="Voice Tester")

    # Confirm transactions
    confirm_payload = {
        "raw_text": "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya.",
        "language": "gu",
        "transactions": [
            {
                "title": "Breakfast",
                "amount": 150.0,
                "category_name": "Food",
                "transaction_type": "EXPENSE",
                "transaction_date": "2026-11-19",
                "payment_mode": "UPI",
                "notes": "Voice entry",
            },
            {
                "title": "Auto Rickshaw",
                "amount": 80.0,
                "category_name": "Travel",
                "transaction_type": "EXPENSE",
                "transaction_date": "2026-11-19",
                "payment_mode": "Cash",
                "notes": "Voice entry",
            },
        ],
    }

    res = client.post("/api/v1/voice/confirm", headers=headers, json=confirm_payload)
    assert res.status_code == 201, res.text
    assert res.json()["created_count"] == 2

    # Check transactions are in database
    tx_res = client.get("/api/v1/transactions", headers=headers)
    assert tx_res.status_code == 200
    assert tx_res.json()["total_count"] == 2

    # Check voice history
    hist = client.get("/api/v1/voice/history", headers=headers)
    assert hist.status_code == 200
    assert len(hist.json()) == 1
    assert hist.json()[0]["language"] == "gu"


def test_bank_statement_csv_reconciliation(client: TestClient):
    _, headers = _register_user(client, email="recon@example.com", name="Recon Tester")
    cats = client.get("/api/v1/categories", headers=headers).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")
    salary_id = next(c["id"] for c in cats if c["name"] == "Monthly Salary")

    # 1. Add app transactions for November 2026
    # Exact match for salary
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "INCOME",
            "title": "Monthly Salary",
            "amount": 50000.0,
            "category_id": salary_id,
            "transaction_date": "2026-11-01",
        },
    )
    # Exact match for restaurant lunch
    res_lunch = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "EXPENSE",
            "title": "Lunch at Cafe",
            "amount": 450.0,
            "category_id": food_id,
            "payment_mode": "UPI",
            "transaction_date": "2026-11-10",
        },
    )
    assert res_lunch.status_code == 201
    # Extra app transaction not in bank statement
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "EXPENSE",
            "title": "Cash vegetable purchase",
            "amount": 120.0,
            "category_id": food_id,
            "payment_mode": "Cash",
            "transaction_date": "2026-11-15",
        },
    )

    # 2. Prepare sample CSV bank statement
    # Contains:
    # Row 1: Salary 50000 credit (MATCHED)
    # Row 2: Lunch at Cafe 450 debit (MATCHED)
    # Row 3: Electricity Torrent Power 1250 debit (MISSING IN APP)
    csv_content = """Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Balance
01/11/2026,SALARY CREDIT NOV 2026,REF10001,,50000.00,50000.00
10/11/2026,UPI-CAFE-PAYMENT-450,REF10002,450.00,,49550.00
14/11/2026,TORRENT POWER LIGHT BILL,REF10003,1250.00,,48300.00
"""

    files = {"file": ("bank_statement_nov2026.csv", csv_content.encode("utf-8"), "text/csv")}
    data = {"month": 11, "year": 2026, "date_tolerance_days": 3}

    up_res = client.post("/api/v1/reconciliation/upload", headers=headers, files=files, data=data)
    assert up_res.status_code == 201, up_res.text
    session_data = up_res.json()

    assert session_data["month"] == 11
    assert session_data["year"] == 2026
    stats = session_data["summary_stats"]
    assert stats["total_bank_transactions"] == 3
    assert stats["matched_count"] == 2
    assert stats["missing_in_app_count"] == 1
    assert stats["not_found_in_bank_count"] == 1

    # Find the MISSING_IN_APP match and execute CREATED_EXPENSE action
    missing_match = next(m for m in session_data["matches"] if m["status"] == "MISSING_IN_APP")
    match_id = missing_match["id"]

    act_res = client.post(
        f"/api/v1/reconciliation/matches/{match_id}/action",
        headers=headers,
        json={"action": "CREATED_EXPENSE", "notes": "Created bill directly from statement"},
    )
    assert act_res.status_code == 200
    assert act_res.json()["status"] == "MATCHED"
    assert float(act_res.json()["app_transaction"]["amount"]) == 1250.0

    # 3. Test reports download (PDF, Excel, CSV)
    s_id = session_data["id"]
    r_pdf = client.get(f"/api/v1/reconciliation/sessions/{s_id}/report/pdf", headers=headers)
    assert r_pdf.status_code == 200
    assert r_pdf.content[:4] == b"%PDF"

    r_xlsx = client.get(f"/api/v1/reconciliation/sessions/{s_id}/report/excel", headers=headers)
    assert r_xlsx.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(r_xlsx.content))
    assert "Reconciliation" in wb.sheetnames

    r_csv = client.get(f"/api/v1/reconciliation/sessions/{s_id}/report/csv", headers=headers)
    assert r_csv.status_code == 200
    assert "TORRENT POWER" in r_csv.content.decode("utf-8-sig")

    # 4. Test delete reconciliation session
    del_s = client.delete(f"/api/v1/reconciliation/sessions/{s_id}", headers=headers)
    assert del_s.status_code == 200
