// Lucide-style SVG icons. All inherit currentColor.
const Icon = ({ children, size = 18, strokeWidth = 2, className = '', ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...rest}
  >{children}</svg>
);

const IconMapPin = (p) => (<Icon {...p}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></Icon>);
const IconSearch  = (p) => (<Icon {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></Icon>);
const IconPlus    = (p) => (<Icon {...p}><path d="M5 12h14"/><path d="M12 5v14"/></Icon>);
const IconPlay    = (p) => (<Icon {...p}><polygon points="6 3 20 12 6 21 6 3"/></Icon>);
const IconPause   = (p) => (<Icon {...p}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></Icon>);
const IconArchive = (p) => (<Icon {...p}><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></Icon>);
const IconEdit    = (p) => (<Icon {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></Icon>);
const IconChevronDown = (p) => (<Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>);
const IconChevronUp   = (p) => (<Icon {...p}><path d="m18 15-6-6-6 6"/></Icon>);
const IconChevronLeft = (p) => (<Icon {...p}><path d="m15 18-6-6 6-6"/></Icon>);
const IconChevronRight= (p) => (<Icon {...p}><path d="m9 18 6-6-6-6"/></Icon>);
const IconChevronsLeft = (p) => (<Icon {...p}><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></Icon>);
const IconMoon    = (p) => (<Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>);
const IconSun     = (p) => (<Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></Icon>);
const IconCheck   = (p) => (<Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>);
const IconCheckCircle = (p) => (<Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></Icon>);
const IconX       = (p) => (<Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>);
const IconAlert   = (p) => (<Icon {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></Icon>);
const IconDownload= (p) => (<Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></Icon>);
const IconTrash   = (p) => (<Icon {...p}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Icon>);
const IconMenu    = (p) => (<Icon {...p}><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></Icon>);
const IconExternal= (p) => (<Icon {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></Icon>);
const IconPhone   = (p) => (<Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></Icon>);
const IconNote    = (p) => (<Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>);
const IconFilter  = (p) => (<Icon {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Icon>);
const IconStop    = (p) => (<Icon {...p}><rect x="5" y="5" width="14" height="14" rx="2"/></Icon>);
const IconRotate  = (p) => (<Icon {...p}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.83 1 6.5 2.5"/><path d="M21 4v6h-6"/></Icon>);
const IconMoreH   = (p) => (<Icon {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></Icon>);
const IconArrowRight = (p) => (<Icon {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>);
const IconSparkles = (p) => (<Icon {...p}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></Icon>);
const IconHistory = (p) => (<Icon {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></Icon>);
const IconGlobe   = (p) => (<Icon {...p}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></Icon>);
const IconUser    = (p) => (<Icon {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>);
const IconMail    = (p) => (<Icon {...p}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></Icon>);
const IconHome    = (p) => (<Icon {...p}><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></Icon>);
const IconLayout  = (p) => (<Icon {...p}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></Icon>);

// Logo mark — abstract pin + green dot
const LogoMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#0e0f0c"/>
    <path d="M16 7c-3.866 0-7 3.06-7 6.83 0 4.78 5.5 9.7 6.6 10.65a.6.6 0 0 0 .8 0c1.1-.95 6.6-5.87 6.6-10.65C23 10.06 19.866 7 16 7Z" fill="#9fe870"/>
    <circle cx="16" cy="13.5" r="2.4" fill="#0e0f0c"/>
  </svg>
);

Object.assign(window, {
  Icon,
  IconMapPin, IconSearch, IconPlus, IconPlay, IconPause, IconArchive, IconEdit,
  IconChevronDown, IconChevronUp, IconChevronLeft, IconChevronRight, IconChevronsLeft,
  IconMoon, IconSun, IconCheck, IconCheckCircle, IconX, IconAlert, IconDownload,
  IconTrash, IconMenu, IconExternal, IconPhone, IconNote, IconFilter, IconStop,
  IconRotate, IconMoreH, IconArrowRight, IconSparkles, IconHistory, IconGlobe, IconUser,
  IconMail, IconHome, IconLayout,
  LogoMark,
});
