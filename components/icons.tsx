import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function WaveMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={`text-sunset-400 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="oa-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" stroke="url(#oa-grad)" strokeWidth="1.6" opacity="0.7" />
      <path
        d="M6 24.5c3.2 0 3.2-2.6 6.4-2.6s3.2 2.6 6.4 2.6 3.2-2.6 6.4-2.6 3.2 2.6 6.4 2.6"
        stroke="url(#oa-grad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 30c3.2 0 3.2-2.6 6.4-2.6s3.2 2.6 6.4 2.6 3.2-2.6 6.4-2.6 3.2 2.6 6.4 2.6"
        className="text-sand"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M12.5 18.2 27 10l-6.1 8.9-8.4-.7Z" fill="url(#oa-grad)" />
    </svg>
  );
}

export function HomeIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} {...props}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" strokeLinejoin="round" />
      <path d="M9.5 20.5v-6h5v6" strokeLinejoin="round" />
    </svg>
  );
}

export function PlaneIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} {...props}>
      <path d="M2.5 13.2 21 5.5l-4.1 12.2-4.4-3.4-4 2.4.6-4.4-6.6-2.1Z" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
      <path d="M4 12 20 4l-6.2 16-3.1-6.5L4 12Z" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon({ className = "h-3.5 w-3.5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TicketIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} {...props}>
      <path
        d="M3.5 8.5A2 2 0 0 1 5.5 6.5h13a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4v-2Z"
        strokeLinejoin="round"
      />
      <path d="M14 6.5v11" strokeDasharray="1.6 2.2" />
    </svg>
  );
}

export function ChatIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} {...props}>
      <path d="M20.5 12c0 4.1-3.8 7.4-8.5 7.4-1 0-2-.2-2.9-.4L4 20.5l1.4-3.6A6.9 6.9 0 0 1 3.5 12c0-4.1 3.8-7.4 8.5-7.4s8.5 3.3 8.5 7.4Z" strokeLinejoin="round" />
    </svg>
  );
}

export function ListIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} {...props}>
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function SparkIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} {...props}>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z" strokeLinejoin="round" />
      <path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoutIcon({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} {...props}>
      <path d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12A1.5 1.5 0 0 1 18 19.5h-3" strokeLinecap="round" />
      <path d="M10 8.5 13.5 12 10 15.5M13 12H4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
