"use client";

import { useState, useMemo } from "react";

interface InlineCalendarProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function InlineCalendar({ value, onChange, minDate }: InlineCalendarProps) {
  const min = minDate ?? startOfDay(new Date());
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value.getFullYear(), value.getMonth(), 1);
    return new Date(min.getFullYear(), min.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("en", { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    // Monday=0 offset
    let startDay = first.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  function prev() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function next() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function isDisabled(day: number) {
    const d = new Date(year, month, day);
    return d < min;
  }

  function isSelected(day: number) {
    if (!value) return false;
    return value.getFullYear() === year && value.getMonth() === month && value.getDate() === day;
  }

  function isToday(day: number) {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  }

  function addYears(n: number) {
    const base = startOfDay(new Date());
    const d = new Date(base.getFullYear() + n, base.getMonth(), base.getDate());
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    onChange(d);
  }

  const PRESETS: { label: string; years: number }[] = [
    { label: "In 1 year", years: 1 },
    { label: "In 3 years", years: 3 },
    { label: "In 5 years", years: 5 },
  ];

  return (
    <div
      className="w-[280px] rounded-[12px] p-3"
      style={{
        background: "var(--h-card, #FFFFFF)",
        border: "0.5px solid var(--h-line, rgba(20,21,26,0.08))",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] transition-colors"
          style={{ color: "var(--h-ink-3, #8A8D95)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--h-bg, #FAFAF7)";
            e.currentTarget.style.color = "var(--h-ink, #14151A)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--h-ink-3, #8A8D95)";
          }}
        >
          ‹
        </button>
        <span
          className="text-[13px]"
          style={{ color: "var(--h-ink, #14151A)", fontWeight: 500 }}
        >
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={next}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] transition-colors"
          style={{ color: "var(--h-ink-3, #8A8D95)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--h-bg, #FAFAF7)";
            e.currentTarget.style.color = "var(--h-ink, #14151A)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--h-ink-3, #8A8D95)";
          }}
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[11px]"
            style={{ color: "var(--h-ink-3, #8A8D95)", fontWeight: 500 }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 text-center">
        {days.map((day, i) =>
          day === null ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={day}
              type="button"
              disabled={isDisabled(day)}
              aria-selected={isSelected(day)}
              onClick={() => onChange(new Date(year, month, day))}
              className="mx-auto aspect-square w-full max-w-[36px] rounded-full text-[13px] font-medium transition-colors"
              style={
                isSelected(day)
                  ? {
                      background: "var(--h-ink, #14151A)",
                      color: "#F1F0EC",
                    }
                  : isToday(day)
                    ? {
                        border: "0.5px solid var(--h-ink, #14151A)",
                        color: "var(--h-ink, #14151A)",
                      }
                    : isDisabled(day)
                      ? {
                          color: "var(--h-line-2, rgba(20,21,26,0.14))",
                          cursor: "not-allowed",
                        }
                      : { color: "var(--h-ink, #14151A)" }
              }
              onMouseEnter={(e) => {
                if (!isSelected(day) && !isDisabled(day)) {
                  e.currentTarget.style.background = "var(--h-bg, #FAFAF7)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected(day) && !isDisabled(day)) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {day}
            </button>
          ),
        )}
      </div>

      {/* Quick presets */}
      <div
        className="mt-3 flex gap-1.5 border-t pt-3"
        style={{ borderColor: "var(--h-line, rgba(20,21,26,0.08))" }}
      >
        {PRESETS.map((p) => (
          <button
            key={p.years}
            type="button"
            onClick={() => addYears(p.years)}
            className="flex-1 rounded-[8px] py-1.5 text-[12px] font-medium transition-colors"
            style={{
              color: "var(--h-ink, #14151A)",
              border: "0.5px solid var(--h-line, rgba(20,21,26,0.08))",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--h-bg, #FAFAF7)";
              e.currentTarget.style.borderColor =
                "var(--h-line-2, rgba(20,21,26,0.14))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor =
                "var(--h-line, rgba(20,21,26,0.08))";
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
