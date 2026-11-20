import calendar
import csv
import io
import os
import tempfile
from datetime import date
from decimal import Decimal
from typing import Literal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session, joinedload

from app.models.reconciliation import (
    BankStatement,
    BankStatementTransaction,
    ReconciliationMatch,
    ReconciliationSession,
)
from app.models.transaction import Transaction
from app.models.user import User, UserSettings

ReportKind = Literal["summary", "expense", "income"]

_FONT_REGISTERED = False
_FONT_REGULAR = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_SUPPORTS_RUPEE = False


def _get_matplotlib():
    os.environ.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "met_mpl"))
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    return matplotlib, plt


def _ensure_pdf_fonts() -> tuple[str, str, bool]:
    global _FONT_REGISTERED, _FONT_REGULAR, _FONT_BOLD, _SUPPORTS_RUPEE
    if _FONT_REGISTERED:
        return _FONT_REGULAR, _FONT_BOLD, _SUPPORTS_RUPEE

    matplotlib, _ = _get_matplotlib()
    mpl_data = matplotlib.get_data_path()
    regular_path = os.path.join(mpl_data, "fonts", "ttf", "DejaVuSans.ttf")
    bold_path = os.path.join(mpl_data, "fonts", "ttf", "DejaVuSans-Bold.ttf")

    if os.path.exists(regular_path) and os.path.exists(bold_path):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", regular_path))
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold_path))
            _FONT_REGULAR = "DejaVuSans"
            _FONT_BOLD = "DejaVuSans-Bold"
            _SUPPORTS_RUPEE = True
        except Exception:
            pass

    _FONT_REGISTERED = True
    return _FONT_REGULAR, _FONT_BOLD, _SUPPORTS_RUPEE


def format_indian_currency(amount: float | Decimal, symbol: str = "₹", safe_ascii: bool = False) -> str:
    val = float(amount)
    negative = val < 0
    abs_val = abs(val)
    integer_part, dec_part = f"{abs_val:.2f}".split(".")
    if len(integer_part) > 3:
        last_three = integer_part[-3:]
        rest = integer_part[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted_int = ",".join(groups) + "," + last_three
    else:
        formatted_int = integer_part

    prefix = f"{symbol}" if not safe_ascii else "INR "
    sign = "-" if negative else ""
    return f"{sign}{prefix}{formatted_int}.{dec_part}"


def _fetch_report_data(
    db: Session,
    user: User,
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: str | None = None,
    payment_mode: str | None = None,
    tx_type_filter: str | None = None,
) -> dict:
    today = date.today()
    sel_year = year or today.year
    sel_month = month or today.month

    if start_date or end_date:
        d_start = start_date or date(sel_year, sel_month, 1)
        d_end = end_date or today
        period_label = f"{d_start.strftime('%d %b %Y')} - {d_end.strftime('%d %b %Y')}"
    else:
        last_day = calendar.monthrange(sel_year, sel_month)[1]
        d_start = date(sel_year, sel_month, 1)
        d_end = date(sel_year, sel_month, last_day)
        period_label = f"{calendar.month_name[sel_month]} {sel_year}"

    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    currency_code = settings.currency_code if settings else "INR"
    currency_symbol = settings.currency_symbol if settings else "₹"

    q = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(
            Transaction.user_id == user.id,
            Transaction.transaction_date >= d_start,
            Transaction.transaction_date <= d_end,
        )
    )
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if payment_mode:
        q = q.filter(Transaction.payment_mode == payment_mode)
    if tx_type_filter in ("INCOME", "EXPENSE"):
        q = q.filter(Transaction.transaction_type == tx_type_filter)

    transactions = q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).all()

    total_income = sum(
        (Decimal(t.amount) for t in transactions if t.transaction_type == "INCOME"),
        Decimal("0.00"),
    )
    total_expenses = sum(
        (Decimal(t.amount) for t in transactions if t.transaction_type == "EXPENSE"),
        Decimal("0.00"),
    )
    remaining_balance = total_income - total_expenses

    expense_by_cat: dict[str, dict] = {}
    income_by_cat: dict[str, dict] = {}
    for tx in transactions:
        cname = tx.category.name if tx.category else "Other"
        color = tx.category.color if tx.category else "#2563EB"
        target = expense_by_cat if tx.transaction_type == "EXPENSE" else income_by_cat
        if cname not in target:
            target[cname] = {"name": cname, "color": color, "amount": Decimal("0.00"), "count": 0}
        target[cname]["amount"] += Decimal(tx.amount)
        target[cname]["count"] += 1

    def _finalize_breakdown(mapping: dict[str, dict], total_ref: Decimal) -> list[dict]:
        tot = float(total_ref)
        rows = []
        for item in sorted(mapping.values(), key=lambda x: x["amount"], reverse=True):
            amt = float(item["amount"])
            pct = round((amt / tot) * 100, 2) if tot > 0 else 0.0
            rows.append(
                {
                    "name": item["name"],
                    "color": item["color"],
                    "amount": round(amt, 2),
                    "percentage": pct,
                    "count": item["count"],
                }
            )
        return rows

    return {
        "period_label": period_label,
        "start_date": d_start,
        "end_date": d_end,
        "month": sel_month,
        "year": sel_year,
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
        "transactions": transactions,
        "total_income": round(float(total_income), 2),
        "total_expenses": round(float(total_expenses), 2),
        "remaining_balance": round(float(remaining_balance), 2),
        "expense_breakdown": _finalize_breakdown(expense_by_cat, total_expenses),
        "income_breakdown": _finalize_breakdown(income_by_cat, total_income),
    }


def _render_chart_image(
    report_kind: ReportKind,
    data: dict,
) -> io.BytesIO | None:
    _, plt = _get_matplotlib()
    symbol = data["currency_symbol"]
    if report_kind == "summary":
        exp_bd = data["expense_breakdown"]
        has_inc_exp = data["total_income"] > 0 or data["total_expenses"] > 0
        if not has_inc_exp:
            return None

        fig, axes = plt.subplots(1, 2, figsize=(8.2, 3.1), dpi=160)
        fig.patch.set_facecolor("#FFFFFF")

        # Left: Income vs Expense vs Savings Bar
        ax1 = axes[0]
        labels = ["Income", "Expenses", "Balance"]
        values = [data["total_income"], data["total_expenses"], max(0.0, data["remaining_balance"])]
        bar_colors = ["#059669", "#2563EB", "#0EA5E9"]
        bars = ax1.bar(labels, values, color=bar_colors, width=0.52)
        ax1.set_title("Income vs Expenses", fontsize=10, fontweight="bold", color="#0F172A", pad=10)
        ax1.spines["top"].set_visible(False)
        ax1.spines["right"].set_visible(False)
        ax1.spines["left"].set_color("#E2E8F0")
        ax1.spines["bottom"].set_color("#E2E8F0")
        ax1.tick_params(colors="#475569", labelsize=8)
        ax1.grid(axis="y", linestyle="--", alpha=0.4, color="#CBD5E1")
        ax1.set_axisbelow(True)
        for bar, val in zip(bars, values):
            ax1.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height(),
                f"{symbol}{val:,.0f}",
                ha="center",
                va="bottom",
                fontsize=7.5,
                color="#1E293B",
            )

        # Right: Expense Donut
        ax2 = axes[1]
        if exp_bd:
            top = exp_bd[:6]
            other_amt = sum(x["amount"] for x in exp_bd[6:])
            pie_labels = [x["name"] for x in top] + (["Other"] if other_amt > 0 else [])
            pie_vals = [x["amount"] for x in top] + ([other_amt] if other_amt > 0 else [])
            pie_cols = [x["color"] for x in top] + (["#94A3B8"] if other_amt > 0 else [])
            wedges, _ = ax2.pie(
                pie_vals,
                colors=pie_cols,
                startangle=140,
                wedgeprops={"width": 0.45, "edgecolor": "#FFFFFF", "linewidth": 1.5},
            )
            ax2.legend(
                wedges,
                [f"{l} ({v / sum(pie_vals) * 100:.0f}%)" for l, v in zip(pie_labels, pie_vals)],
                loc="center left",
                bbox_to_anchor=(0.95, 0.5),
                fontsize=7,
                frameon=False,
            )
            ax2.set_title("Expense Breakdown", fontsize=10, fontweight="bold", color="#0F172A", pad=10)
        else:
            ax2.text(0.5, 0.5, "No expenses in period", ha="center", va="center", color="#64748B", fontsize=9)
            ax2.axis("off")

        plt.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=160)
        plt.close(fig)
        buf.seek(0)
        return buf

    breakdown = data["expense_breakdown"] if report_kind == "expense" else data["income_breakdown"]
    if not breakdown:
        return None

    fig, ax = plt.subplots(figsize=(7.2, 2.9), dpi=160)
    fig.patch.set_facecolor("#FFFFFF")
    top = breakdown[:8]
    names = [x["name"] for x in top][::-1]
    amounts = [x["amount"] for x in top][::-1]
    cols = [x["color"] for x in top][::-1]

    bars = ax.barh(names, amounts, color=cols, height=0.58)
    title_txt = "Category-wise Expense Breakdown" if report_kind == "expense" else "Income Sources Breakdown"
    ax.set_title(title_txt, fontsize=10.5, fontweight="bold", color="#0F172A", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#E2E8F0")
    ax.spines["bottom"].set_color("#E2E8F0")
    ax.tick_params(colors="#334155", labelsize=8)
    ax.grid(axis="x", linestyle="--", alpha=0.4, color="#CBD5E1")
    ax.set_axisbelow(True)
    for bar, val in zip(bars, amounts):
        ax.text(
            val,
            bar.get_y() + bar.get_height() / 2,
            f"  {symbol}{val:,.0f}",
            va="center",
            ha="left",
            fontsize=7.5,
            color="#1E293B",
        )

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=160)
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_pdf_report(
    db: Session,
    user: User,
    report_kind: ReportKind = "summary",
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: str | None = None,
    payment_mode: str | None = None,
) -> tuple[bytes, str]:
    font_reg, font_bold, supports_rupee = _ensure_pdf_fonts()
    tx_filter = "EXPENSE" if report_kind == "expense" else ("INCOME" if report_kind == "income" else None)

    data = _fetch_report_data(
        db=db,
        user=user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
        tx_type_filter=tx_filter,
    )

    sym = data["currency_symbol"]
    safe_ascii = (sym == "₹") and (not supports_rupee)

    def fmt(val: float) -> str:
        return format_indian_currency(val, sym, safe_ascii=safe_ascii)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=17,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSub",
        parent=styles["Normal"],
        fontName=font_reg,
        fontSize=9.5,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=11.5,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=12,
        spaceAfter=6,
    )
    cell_style = ParagraphStyle(
        "CellText",
        parent=styles["Normal"],
        fontName=font_reg,
        fontSize=8.2,
        textColor=colors.HexColor("#1E293B"),
        leading=10.5,
    )

    title_map = {
        "summary": "Complete Monthly Financial Summary",
        "expense": "Monthly Expense Report",
        "income": "Monthly Income Report",
    }

    story = [
        Paragraph(title_map[report_kind], title_style),
        Paragraph(
            f"Prepared for <b>{user.full_name}</b> ({user.email}) &bull; Period: <b>{data['period_label']}</b> &bull; Currency: {data['currency_code']}",
            subtitle_style,
        ),
    ]

    # Summary KPI Banner Table
    if report_kind == "summary":
        kpi_data = [
            ["Total Income", "Total Expenses", "Remaining Balance", "Total Savings"],
            [
                fmt(data["total_income"]),
                fmt(data["total_expenses"]),
                fmt(data["remaining_balance"]),
                fmt(data["remaining_balance"]),
            ],
        ]
        col_widths = [44 * mm, 44 * mm, 45 * mm, 45 * mm]
    elif report_kind == "expense":
        top_cat = data["expense_breakdown"][0]["name"] if data["expense_breakdown"] else "N/A"
        kpi_data = [
            ["Total Expenses", "Transactions", "Highest Category"],
            [fmt(data["total_expenses"]), str(len(data["transactions"])), top_cat],
        ]
        col_widths = [60 * mm, 50 * mm, 68 * mm]
    else:
        top_src = data["income_breakdown"][0]["name"] if data["income_breakdown"] else "N/A"
        kpi_data = [
            ["Total Income", "Entries", "Primary Source"],
            [fmt(data["total_income"]), str(len(data["transactions"])), top_src],
        ]
        col_widths = [60 * mm, 50 * mm, 68 * mm]

    kpi_table = Table(kpi_data, colWidths=col_widths)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
                ("FONTNAME", (0, 0), (-1, 0), font_bold),
                ("FONTSIZE", (0, 0), (-1, 0), 8.5),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#FAF9F6")),
                ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 1), (-1, 1), font_bold),
                ("FONTSIZE", (0, 1), (-1, 1), 11),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#BFDBFE")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DBEAFE")),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # Chart Image
    chart_buf = _render_chart_image(report_kind, data)
    if chart_buf:
        story.append(RLImage(chart_buf, width=176 * mm, height=68 * mm))
        story.append(Spacer(1, 6))

    # Category Breakdown Section
    breakdown = data["income_breakdown"] if report_kind == "income" else data["expense_breakdown"]
    if breakdown:
        section_title = "Income Category Breakdown" if report_kind == "income" else "Category-wise Expense Breakdown"
        story.append(Paragraph(section_title, section_style))
        bd_rows = [["Category", "Transactions", "Amount", "Share (%)"]]
        for item in breakdown:
            bd_rows.append(
                [
                    item["name"],
                    str(item["count"]),
                    fmt(item["amount"]),
                    f"{item['percentage']:.1f}%",
                ]
            )
        bd_table = Table(bd_rows, colWidths=[68 * mm, 32 * mm, 48 * mm, 30 * mm])
        bd_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), font_bold),
                    ("FONTNAME", (0, 1), (-1, -1), font_reg),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(bd_table)

    # Detailed Transactions Table
    story.append(Paragraph("Transaction Details", section_style))
    txs = data["transactions"]
    if txs:
        tx_rows = [["Date", "Title", "Category", "Type", "Mode", "Amount"]]
        for tx in txs:
            tx_rows.append(
                [
                    tx.transaction_date.strftime("%d %b %Y"),
                    Paragraph(tx.title, cell_style),
                    tx.category.name if tx.category else "Other",
                    tx.transaction_type.title(),
                    tx.payment_mode or "-",
                    fmt(float(tx.amount)),
                ]
            )
        tx_table = Table(tx_rows, colWidths=[23 * mm, 52 * mm, 30 * mm, 18 * mm, 22 * mm, 33 * mm], repeatRows=1)
        tx_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), font_bold),
                    ("FONTNAME", (0, 1), (-1, -1), font_reg),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ALIGN", (5, 0), (5, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF9F6")]),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2E8F0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
                ]
            )
        )
        story.append(tx_table)
    else:
        story.append(Paragraph("No transactions recorded for the selected filters.", subtitle_style))

    doc.build(story)
    buf.seek(0)
    slug = data["period_label"].lower().replace(" ", "_")
    filename = f"{report_kind}_report_{slug}.pdf"
    return buf.read(), filename


def generate_excel_report(
    db: Session,
    user: User,
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: str | None = None,
    payment_mode: str | None = None,
) -> tuple[bytes, str]:
    data = _fetch_report_data(
        db=db,
        user=user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )

    wb = Workbook()
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sub_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    title_font = Font(bold=True, color="0F172A", size=14)
    bold_font = Font(bold=True, color="0F172A", size=10)
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    sym = data["currency_symbol"]
    curr_fmt = f'"{sym}"#,##0.00'

    # Sheet 1: Summary
    ws_sum = wb.active
    ws_sum.title = "Financial Summary"
    ws_sum["A1"] = "Personal Expense & Income Tracker — Financial Report"
    ws_sum["A1"].font = title_font
    ws_sum["A2"] = f"Account: {user.full_name} ({user.email})"
    ws_sum["A3"] = f"Period: {data['period_label']}"

    summary_rows = [
        ("Metric", "Value"),
        ("Total Income", data["total_income"]),
        ("Total Expenses", data["total_expenses"]),
        ("Remaining Balance", data["remaining_balance"]),
        ("Total Savings", data["remaining_balance"]),
        ("Total Transactions", len(data["transactions"])),
    ]
    for idx, (label, val) in enumerate(summary_rows, start=5):
        c1 = ws_sum.cell(row=idx, column=1, value=label)
        c2 = ws_sum.cell(row=idx, column=2, value=val)
        c1.border = thin_border
        c2.border = thin_border
        if idx == 5:
            c1.fill = header_fill
            c2.fill = header_fill
            c1.font = header_font
            c2.font = header_font
        else:
            c1.font = bold_font
            if isinstance(val, float):
                c2.number_format = curr_fmt
            c2.alignment = Alignment(horizontal="right")

    ws_sum.column_dimensions["A"].width = 28
    ws_sum.column_dimensions["B"].width = 22

    # Sheet 2: Category Breakdown
    ws_cat = wb.create_sheet("Category Breakdown")
    headers_cat = ["Category", "Type", "Transactions", "Amount", "Percentage (%)"]
    for col_idx, h in enumerate(headers_cat, start=1):
        cell = ws_cat.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.border = thin_border

    row_cursor = 2
    for item in data["expense_breakdown"]:
        vals = [item["name"], "EXPENSE", item["count"], item["amount"], item["percentage"] / 100.0]
        for col_idx, v in enumerate(vals, start=1):
            cell = ws_cat.cell(row=row_cursor, column=col_idx, value=v)
            cell.border = thin_border
            if col_idx == 4:
                cell.number_format = curr_fmt
            elif col_idx == 5:
                cell.number_format = "0.00%"
        row_cursor += 1

    for item in data["income_breakdown"]:
        vals = [item["name"], "INCOME", item["count"], item["amount"], item["percentage"] / 100.0]
        for col_idx, v in enumerate(vals, start=1):
            cell = ws_cat.cell(row=row_cursor, column=col_idx, value=v)
            cell.fill = sub_fill
            cell.border = thin_border
            if col_idx == 4:
                cell.number_format = curr_fmt
            elif col_idx == 5:
                cell.number_format = "0.00%"
        row_cursor += 1

    for i, width in enumerate([24, 14, 16, 18, 16], start=1):
        ws_cat.column_dimensions[get_column_letter(i)].width = width

    # Sheet 3: Transactions
    ws_tx = wb.create_sheet("Transactions")
    headers_tx = ["Date", "Type", "Title", "Category", "Payment Mode", "Amount", "Notes"]
    for col_idx, h in enumerate(headers_tx, start=1):
        cell = ws_tx.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.border = thin_border

    for r_idx, tx in enumerate(data["transactions"], start=2):
        vals = [
            tx.transaction_date.isoformat(),
            tx.transaction_type,
            tx.title,
            tx.category.name if tx.category else "Other",
            tx.payment_mode or "-",
            float(tx.amount),
            tx.notes or "",
        ]
        for col_idx, v in enumerate(vals, start=1):
            cell = ws_tx.cell(row=r_idx, column=col_idx, value=v)
            cell.border = thin_border
            if col_idx == 6:
                cell.number_format = curr_fmt

    for i, width in enumerate([14, 12, 32, 20, 16, 16, 36], start=1):
        ws_tx.column_dimensions[get_column_letter(i)].width = width

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    slug = data["period_label"].lower().replace(" ", "_")
    return out.read(), f"financial_report_{slug}.xlsx"


def generate_csv_report(
    db: Session,
    user: User,
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: str | None = None,
    payment_mode: str | None = None,
) -> tuple[bytes, str]:
    data = _fetch_report_data(
        db=db,
        user=user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )

    str_buf = io.StringIO()
    writer = csv.writer(str_buf)
    writer.writerow(["Period", data["period_label"]])
    writer.writerow(["Currency", data["currency_code"]])
    writer.writerow(["Total Income", f"{data['total_income']:.2f}"])
    writer.writerow(["Total Expenses", f"{data['total_expenses']:.2f}"])
    writer.writerow(["Remaining Balance", f"{data['remaining_balance']:.2f}"])
    writer.writerow([])
    writer.writerow(["Date", "Type", "Title", "Category", "Payment Mode", "Amount", "Notes"])
    for tx in data["transactions"]:
        writer.writerow(
            [
                tx.transaction_date.isoformat(),
                tx.transaction_type,
                tx.title,
                tx.category.name if tx.category else "Other",
                tx.payment_mode or "",
                f"{float(tx.amount):.2f}",
                tx.notes or "",
            ]
        )

    csv_bytes = ("\ufeff" + str_buf.getvalue()).encode("utf-8")
    slug = data["period_label"].lower().replace(" ", "_")
    return csv_bytes, f"transactions_{slug}.csv"


def generate_reconciliation_csv(
    db: Session,
    user: User,
    session: ReconciliationSession,
) -> tuple[bytes, str]:
    """Generate CSV report for bank statement reconciliation session."""
    stats = session.summary_stats or {}
    statement = session.statement
    matches = (
        db.query(ReconciliationMatch)
        .options(
            joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationMatch.app_transaction).joinedload(Transaction.category),
        )
        .filter(ReconciliationMatch.session_id == session.id)
        .all()
    )

    str_buf = io.StringIO()
    writer = csv.writer(str_buf)
    period_str = f"{calendar.month_name[session.month]} {session.year}"
    writer.writerow(["MyMoney - Bank Statement Reconciliation Report"])
    writer.writerow(["Period", period_str])
    writer.writerow(["Statement File", statement.filename if statement else "N/A"])
    writer.writerow(["Total Bank Transactions", stats.get("total_bank_transactions", 0)])
    writer.writerow(["Matched Count", stats.get("matched_count", 0)])
    writer.writerow(["Missing in App", stats.get("missing_in_app_count", 0)])
    writer.writerow(["Not Found in Bank", stats.get("not_found_in_bank_count", 0)])
    writer.writerow(["Mismatches", stats.get("mismatch_count", 0)])
    writer.writerow(["Needs Review", stats.get("needs_review_count", 0)])
    writer.writerow([])
    writer.writerow([
        "Status", "Match Score", "Bank Date", "Bank Description", "Bank Debit", "Bank Credit",
        "App Date", "App Title", "App Category", "App Type", "App Amount", "User Action", "Notes"
    ])

    for m in matches:
        b = m.bank_transaction
        a = m.app_transaction
        writer.writerow([
            m.status,
            f"{float(m.match_score):.1f}%",
            b.transaction_date.isoformat() if b else "",
            b.description if b else "",
            f"{float(b.debit_amount):.2f}" if (b and b.debit_amount > 0) else "",
            f"{float(b.credit_amount):.2f}" if (b and b.credit_amount > 0) else "",
            a.transaction_date.isoformat() if a else "",
            a.title if a else "",
            a.category.name if (a and a.category) else "",
            a.transaction_type if a else "",
            f"{float(a.amount):.2f}" if a else "",
            m.review_action,
            m.notes or "",
        ])

    csv_bytes = ("\ufeff" + str_buf.getvalue()).encode("utf-8")
    filename = f"reconciliation_{session.year}_{session.month:02d}.csv"
    return csv_bytes, filename


def generate_reconciliation_excel(
    db: Session,
    user: User,
    session: ReconciliationSession,
) -> tuple[bytes, str]:
    """Generate Excel (.xlsx) report for bank statement reconciliation session."""
    stats = session.summary_stats or {}
    statement = session.statement
    matches = (
        db.query(ReconciliationMatch)
        .options(
            joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationMatch.app_transaction).joinedload(Transaction.category),
        )
        .filter(ReconciliationMatch.session_id == session.id)
        .all()
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Reconciliation"

    title_font = Font(name="Segoe UI", size=14, bold=True, color="0F172A")
    sec_font = Font(name="Segoe UI", size=11, bold=True, color="1E293B")
    hdr_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    cell_font = Font(name="Segoe UI", size=9, color="334155")

    hdr_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    matched_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    missing_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    mismatch_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    not_found_fill = PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid")

    period_str = f"{calendar.month_name[session.month]} {session.year}"
    ws["A1"] = f"MyMoney — Bank Statement Reconciliation ({period_str})"
    ws["A1"].font = title_font
    ws.row_dimensions[1].height = 24

    ws["A3"] = "Summary Statistics"
    ws["A3"].font = sec_font
    ws["A4"] = "Statement File:"
    ws["B4"] = statement.filename if statement else "N/A"
    ws["A5"] = "Total Bank Transactions:"
    ws["B5"] = stats.get("total_bank_transactions", 0)
    ws["A6"] = "Total Matched:"
    ws["B6"] = stats.get("matched_count", 0)
    ws["A7"] = "Missing in App:"
    ws["B7"] = stats.get("missing_in_app_count", 0)
    ws["A8"] = "Not Found in Bank:"
    ws["B8"] = stats.get("not_found_in_bank_count", 0)
    ws["A9"] = "Mismatches / Discrepancies:"
    ws["B9"] = stats.get("mismatch_count", 0)

    headers = [
        "Status", "Score", "Bank Date", "Bank Description", "Bank Debit (₹)", "Bank Credit (₹)",
        "App Date", "App Title", "App Category", "App Type", "App Amount (₹)", "Action", "Notes"
    ]
    start_row = 12
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=col_idx, value=h)
        cell.font = hdr_font
        cell.fill = hdr_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.row_dimensions[start_row].height = 26

    for row_idx, m in enumerate(matches, start=start_row + 1):
        b = m.bank_transaction
        a = m.app_transaction
        vals = [
            m.status,
            f"{float(m.match_score):.0f}%",
            b.transaction_date.strftime("%d-%m-%Y") if b else "-",
            b.description if b else "-",
            float(b.debit_amount) if (b and b.debit_amount > 0) else "-",
            float(b.credit_amount) if (b and b.credit_amount > 0) else "-",
            a.transaction_date.strftime("%d-%m-%Y") if a else "-",
            a.title if a else "-",
            a.category.name if (a and a.category) else "-",
            a.transaction_type if a else "-",
            float(a.amount) if a else "-",
            m.review_action,
            m.notes or "",
        ]
        for col_idx, val in enumerate(vals, start=1):
            c = ws.cell(row=row_idx, column=col_idx, value=val)
            c.font = cell_font
            if col_idx == 1:
                if m.status == "MATCHED":
                    c.fill = matched_fill
                elif m.status == "MISSING_IN_APP":
                    c.fill = missing_fill
                elif m.status in ["MISMATCH", "NEEDS_REVIEW"]:
                    c.fill = mismatch_fill
                elif m.status == "NOT_FOUND_IN_BANK":
                    c.fill = not_found_fill

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 40)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), f"reconciliation_{session.year}_{session.month:02d}.xlsx"


def generate_reconciliation_pdf(
    db: Session,
    user: User,
    session: ReconciliationSession,
) -> tuple[bytes, str]:
    """Generate professional PDF report for bank statement reconciliation session."""
    reg_font, bold_font, _ = _ensure_pdf_fonts()
    stats = session.summary_stats or {}
    statement = session.statement
    matches = (
        db.query(ReconciliationMatch)
        .options(
            joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationMatch.app_transaction).joinedload(Transaction.category),
        )
        .filter(ReconciliationMatch.session_id == session.id)
        .all()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "RecTitle",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
    )
    subtitle_style = ParagraphStyle(
        "RecSubTitle",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748B"),
    )
    cell_style = ParagraphStyle(
        "RecCell",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    cell_bold_style = ParagraphStyle(
        "RecCellBold",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
    )

    story = []
    period_str = f"{calendar.month_name[session.month]} {session.year}"
    story.append(Paragraph("<b>MyMoney — Bank Statement Reconciliation</b>", title_style))
    story.append(Paragraph(f"Period: {period_str} | Statement: {statement.filename if statement else 'N/A'}", subtitle_style))
    story.append(Spacer(1, 4 * mm))

    # Summary table
    sum_data = [
        ["Total Bank Tx", "Matched", "Missing in App", "Not in Bank", "Mismatches", "Needs Review"],
        [
            str(stats.get("total_bank_transactions", 0)),
            str(stats.get("matched_count", 0)),
            str(stats.get("missing_in_app_count", 0)),
            str(stats.get("not_found_in_bank_count", 0)),
            str(stats.get("mismatch_count", 0)),
            str(stats.get("needs_review_count", 0)),
        ]
    ]
    sum_table = Table(sum_data, colWidths=[31 * mm] * 6)
    sum_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), bold_font),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F8FAFC")),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 5 * mm))

    # Comparison Table
    table_headers = ["Status", "Bank Date", "Bank Description", "Bank Amt", "App Date", "App Title", "App Amt", "Score"]
    table_rows = [table_headers]

    for m in matches[:60]:  # Cap to fit printable PDF
        b = m.bank_transaction
        a = m.app_transaction
        b_amt_str = f"₹{float(b.debit_amount):.2f}" if (b and b.debit_amount > 0) else (f"₹{float(b.credit_amount):.2f}" if (b and b.credit_amount > 0) else "-")
        a_amt_str = f"₹{float(a.amount):.2f}" if a else "-"
        
        table_rows.append([
            m.status.replace("_", " "),
            b.transaction_date.strftime("%d-%m") if b else "-",
            (b.description[:24] + "...") if (b and len(b.description) > 24) else (b.description if b else "-"),
            b_amt_str,
            a.transaction_date.strftime("%d-%m") if a else "-",
            (a.title[:20] + "...") if (a and len(a.title) > 20) else (a.title if a else "-"),
            a_amt_str,
            f"{float(m.match_score):.0f}%",
        ])

    comp_table = Table(table_rows, colWidths=[24 * mm, 16 * mm, 46 * mm, 20 * mm, 16 * mm, 40 * mm, 18 * mm, 12 * mm])
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("ALIGN", (6, 0), (6, -1), "RIGHT"),
        ("ALIGN", (7, 0), (7, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(comp_table)

    doc.build(story)
    return buf.getvalue(), f"reconciliation_{session.year}_{session.month:02d}.pdf"
