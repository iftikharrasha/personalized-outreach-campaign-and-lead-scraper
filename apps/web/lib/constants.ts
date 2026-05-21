export const CATEGORIES = [
  // Food & Hospitality
  { value: "restaurants", label: "Restaurants" },
  { value: "cafes", label: "Cafes & Coffee Shops" },
  { value: "bakeries", label: "Bakeries" },
  { value: "hotels", label: "Hotels & Resorts" },
  { value: "catering", label: "Catering Services" },
  // Health & Wellness
  { value: "dentists", label: "Dentists" },
  { value: "doctors", label: "Doctors & Clinics" },
  { value: "gyms", label: "Gyms & Fitness" },
  { value: "salons", label: "Hair Salons & Barbers" },
  { value: "spas", label: "Spas & Beauty" },
  { value: "pharmacies", label: "Pharmacies" },
  // Professional Services
  { value: "lawyers", label: "Personal Injury Lawyers" },
  { value: "accountants", label: "Accountants & CPA" },
  { value: "realestate", label: "Real Estate Agents" },
  { value: "insurance", label: "Insurance Agencies" },
  { value: "marketing", label: "Marketing Agencies" },
  { value: "itservices", label: "IT & Tech Support" },
  // Events & Entertainment
  { value: "eventmanagement", label: "Event Management" },
  { value: "weddingplanners", label: "Wedding Planners" },
  { value: "photographers", label: "Photographers & Videographers" },
  { value: "venues", label: "Event Venues & Banquet Halls" },
  { value: "djentertainment", label: "DJs & Entertainment" },
  // Home & Trade
  { value: "plumbers", label: "Plumbers" },
  { value: "electricians", label: "Electricians" },
  { value: "auto", label: "Auto Repair Shops" },
  { value: "cleaningservices", label: "Cleaning Services" },
  { value: "landscaping", label: "Landscaping & Gardening" },
  { value: "contractors", label: "General Contractors" },
  // Retail & Education
  { value: "tutoring", label: "Tutoring & Coaching" },
  { value: "gymsports", label: "Sports & Recreation" },
  { value: "petservices", label: "Pet Services & Vets" },
  { value: "custom", label: "Custom keyword…" },
] as const;

export const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "BD", label: "Bangladesh" },
] as const;

export const STATES_BY_COUNTRY: Record<string, string[]> = {
  US: ["California", "New York", "Illinois", "Texas", "Florida", "Washington", "Massachusetts", "Colorado", "Georgia", "Oregon"],
  CA: ["Ontario", "Quebec", "British Columbia", "Alberta"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland"],
  AU: ["New South Wales", "Victoria", "Queensland", "Western Australia"],
  BD: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh"],
};

export const STATUS_OPTIONS = [
  { value: "NEW", label: "New", tone: "neutral" as const },
  { value: "CONTACTED", label: "Contacted", tone: "warning" as const },
  { value: "REPLIED", label: "Replied", tone: "positive" as const },
  { value: "IGNORED", label: "Ignored", tone: "mute" as const },
  { value: "CLOSED", label: "Closed", tone: "purple" as const },
] as const;

export type StatusOptionTone = "neutral" | "warning" | "positive" | "mute" | "purple";
