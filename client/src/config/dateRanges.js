import {
  addDays,
  endOfDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfWeek,
  endOfWeek,
  isSameDay,
  differenceInCalendarDays,
  subDays,
} from "date-fns";

const defineds = {
  startOfWeek: startOfWeek(new Date()),
  endOfWeek: endOfWeek(new Date()),
  startOfLastWeek: startOfWeek(addDays(new Date(), -7)),
  endOfLastWeek: endOfWeek(addDays(new Date(), -7)),
  startOfToday: startOfDay(new Date()),
  endOfToday: endOfDay(new Date()),
  startOfYesterday: startOfDay(addDays(new Date(), -1)),
  endOfYesterday: endOfDay(addDays(new Date(), -1)),
  startOfMonth: startOfMonth(new Date()),
  endOfMonth: endOfMonth(new Date()),
  startOfLastMonth: startOfMonth(addMonths(new Date(), -1)),
  endOfLastMonth: endOfMonth(addMonths(new Date(), -1)),
};

const staticRangeHandler = {
  range: {},
  isSelected(range) {
    const definedRange = this.range();
    return (
      isSameDay(range.startDate, definedRange.startDate)
      && isSameDay(range.endDate, definedRange.endDate)
    );
  },
};

export function createStaticRanges(ranges) {
  return ranges.map(range => ({ ...staticRangeHandler, ...range }));
}

export const defaultStaticRanges = createStaticRanges([
  {
    label: "Last 7 days",
    range: () => ({
      startDate: subDays(defineds.startOfToday, 7),
      endDate: defineds.endOfToday,
    }),
  },
  {
    label: "Last 30 days",
    range: () => ({
      startDate: subDays(defineds.startOfToday, 30),
      endDate: defineds.endOfToday,
    }),
  },
  {
    label: "Last 60 days",
    range: () => ({
      startDate: subDays(defineds.startOfToday, 60),
      endDate: defineds.endOfToday,
    }),
  },
  {
    label: "Last 90 days",
    range: () => ({
      startDate: subDays(defineds.startOfToday, 90),
      endDate: defineds.endOfToday,
    }),
  },
]);

export const defaultInputRanges = [
  {
    label: "days up to today",
    range(value) {
      return {
        startDate: addDays(defineds.startOfToday, (Math.max(Number(value), 1)) * -1),
        endDate: defineds.endOfToday,
      };
    },
    getCurrentValue(range) {
      if (!isSameDay(range.endDate, defineds.endOfToday)) return "-";
      if (!range.startDate) return "∞";
      return differenceInCalendarDays(defineds.endOfToday, range.startDate);
    },
  },
  {
    label: "days starting today",
    range(value) {
      const today = new Date();
      return {
        startDate: today,
        endDate: addDays(today, Math.max(Number(value), 1) - 1),
      };
    },
    getCurrentValue(range) {
      if (!isSameDay(range.startDate, defineds.startOfToday)) return "-";
      if (!range.endDate) return "∞";
      return differenceInCalendarDays(range.endDate, defineds.startOfToday) + 1;
    },
  },
];
