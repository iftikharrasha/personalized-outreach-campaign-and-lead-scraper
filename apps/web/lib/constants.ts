export const CATEGORIES = [
  { value: "restaurants", label: "Restaurants" },
  { value: "dentists", label: "Dentists" },
  { value: "lawyers", label: "Personal Injury Lawyers" },
  { value: "plumbers", label: "Plumbers" },
  { value: "cafes", label: "Cafes & Coffee Shops" },
  { value: "gyms", label: "Gyms & Fitness" },
  { value: "auto", label: "Auto Repair Shops" },
  { value: "custom", label: "Custom keyword…" },
] as const;

export const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
] as const;

export const STATES_BY_COUNTRY: Record<string, string[]> = {
  US: ["California", "New York", "Illinois", "Texas", "Florida", "Washington", "Massachusetts", "Colorado", "Georgia", "Oregon"],
  CA: ["Ontario", "Quebec", "British Columbia", "Alberta"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland"],
  AU: ["New South Wales", "Victoria", "Queensland", "Western Australia"],
};

export const STATUS_OPTIONS = [
  { value: "NEW", label: "New", tone: "neutral" as const },
  { value: "CONTACTED", label: "Contacted", tone: "warning" as const },
  { value: "REPLIED", label: "Replied", tone: "positive" as const },
  { value: "IGNORED", label: "Ignored", tone: "mute" as const },
  { value: "CLOSED", label: "Closed", tone: "purple" as const },
] as const;

export type StatusOptionTone = "neutral" | "warning" | "positive" | "mute" | "purple";
