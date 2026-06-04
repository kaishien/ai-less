export function getMoscowIsoTime(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type);
    if (!part) {
      throw new Error(`Missing ${type} in Moscow time formatter`);
    }
    return part.value;
  };

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+03:00`;
}
