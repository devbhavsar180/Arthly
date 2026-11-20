import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";
import { CategoryBreakdownItem, MonthlyTrendItem } from "@/types";
import { COLORS, formatCompact, formatCurrency } from "@/lib/format";

export function ExpenseDonutChart({
  data,
  currencySymbol,
}: {
  data: CategoryBreakdownItem[];
  currencySymbol: string;
}) {
  if (!data.length) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No expenses recorded for this month</Text>
      </View>
    );
  }

  const size = 148;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  let cumulative = 0;
  const segments = data.slice(0, 6).map((item) => {
    const ratio = total > 0 ? item.amount / total : 0;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const rotation = (cumulative / (total || 1)) * 360 - 90;
    cumulative += item.amount;
    return { ...item, strokeDasharray, rotation };
  });

  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutSvgWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segments.map((seg) => (
            <G key={seg.category_id} rotation={seg.rotation} origin={`${size / 2}, ${size / 2}`}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                fill="none"
              />
            </G>
          ))}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutCenterLabel}>Spent</Text>
          <Text style={styles.donutCenterVal}>{formatCompact(total, currencySymbol)}</Text>
        </View>
      </View>

      <View style={styles.legendCol}>
        {data.slice(0, 6).map((item) => (
          <View key={item.category_id} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text numberOfLines={1} style={styles.legendName}>
                {item.category_name}
              </Text>
            </View>
            <Text style={styles.legendPct}>{item.percentage.toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function IncomeVsExpenseChart({
  data,
  currencySymbol,
}: {
  data: MonthlyTrendItem[];
  currencySymbol: string;
}) {
  // Show the most recent 6 months with activity or first/last 6 months
  const currentMonth = new Date().getMonth() + 1;
  const startIdx = Math.max(0, Math.min(6, currentMonth - 6));
  const slice = data.slice(startIdx, startIdx + 6);
  const maxVal = Math.max(
    1,
    ...slice.flatMap((m) => [m.income, m.expenses])
  );

  const width = 310;
  const height = 156;
  const chartHeight = 112;
  const groupWidth = width / Math.max(1, slice.length);

  return (
    <View>
      <View style={styles.chartLegendInline}>
        <View style={styles.inlineLegendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.sage }]} />
          <Text style={styles.inlineLegendText}>Income</Text>
        </View>
        <View style={styles.inlineLegendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.brand }]} />
          <Text style={styles.inlineLegendText}>Expenses</Text>
        </View>
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {slice.map((m, idx) => {
          const xBase = idx * groupWidth + 10;
          const incH = Math.max(3, (m.income / maxVal) * chartHeight);
          const expH = Math.max(3, (m.expenses / maxVal) * chartHeight);
          return (
            <G key={m.month}>
              <Rect
                x={xBase}
                y={chartHeight - incH + 14}
                width={12}
                height={incH}
                rx={4}
                fill={COLORS.sage}
              />
              <Rect
                x={xBase + 15}
                y={chartHeight - expH + 14}
                width={12}
                height={expH}
                rx={4}
                fill={COLORS.brand}
              />
              <SvgText
                x={xBase + 13}
                y={height - 8}
                fontSize="10"
                fill={COLORS.textMuted}
                textAnchor="middle"
              >
                {m.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={styles.scaleHint}>
        Peak monthly value: {formatCurrency(maxVal, currencySymbol)}
      </Text>
    </View>
  );
}

export function CategoryBarsList({
  data,
  currencySymbol,
}: {
  data: CategoryBreakdownItem[];
  currencySymbol: string;
}) {
  if (!data.length) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Add expenses to view category breakdown</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {data.map((cat) => (
        <View key={cat.category_id} style={{ gap: 5 }}>
          <View style={styles.barHeader}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={styles.barName}>{cat.category_name}</Text>
            </View>
            <Text style={styles.barAmt}>
              {formatCurrency(cat.amount, currencySymbol)} ({cat.percentage.toFixed(1)}%)
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                  backgroundColor: cat.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    backgroundColor: COLORS.ivory,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "500",
  },
  donutWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  donutSvgWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
  },
  donutCenterLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  donutCenterVal: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "800",
  },
  legendCol: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendName: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "500",
    flexShrink: 1,
  },
  legendPct: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  chartLegendInline: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 6,
  },
  inlineLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineLegendText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  scaleHint: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "right",
    marginTop: 2,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  barAmt: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  barTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
  },
});
