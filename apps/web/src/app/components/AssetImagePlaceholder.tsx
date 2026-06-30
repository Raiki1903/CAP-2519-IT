import { useId } from "react";

type Category =
  | "Computing Array"
  | "Robotic Node"
  | "Mobile Infrastructure"
  | "Sensor Array"
  | "Networking"
  | "Peripheral"
  | string;

interface AssetImagePlaceholderProps {
  category?: Category;
  aspectRatio?: "4/3" | "16/9";
  imageUrl?: string;
}

function ComputingIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <rect x="8" y="12" width="48" height="32" rx="4" stroke="#9CA3AF" strokeWidth="2.5" />
      <rect x="14" y="18" width="36" height="20" rx="2" fill="#E5E7EB" />
      <rect x="22" y="46" width="20" height="4" rx="1" fill="#D1D5DB" />
      <rect x="16" y="50" width="32" height="2" rx="1" fill="#D1D5DB" />
    </svg>
  );
}

function RoboticIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="16" r="10" stroke="#9CA3AF" strokeWidth="2.5" />
      <rect x="20" y="28" width="24" height="20" rx="3" stroke="#9CA3AF" strokeWidth="2.5" />
      <line x1="8" y1="34" x2="20" y2="34" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="8" y1="34" x2="8" y2="44" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="44" y1="34" x2="56" y2="34" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="56" y1="34" x2="56" y2="44" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="48" x2="24" y2="58" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="48" x2="40" y2="58" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="27" cy="35" r="2.5" fill="#D1D5DB" />
      <circle cx="37" cy="35" r="2.5" fill="#D1D5DB" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <rect x="18" y="8" width="28" height="48" rx="5" stroke="#9CA3AF" strokeWidth="2.5" />
      <rect x="24" y="14" width="16" height="28" rx="1" fill="#E5E7EB" />
      <circle cx="32" cy="50" r="3" fill="#D1D5DB" />
      <line x1="28" y1="10" x2="36" y2="10" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SensorIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="10" stroke="#9CA3AF" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="3" fill="#D1D5DB" />
      <path d="M18 18 A 19.8 19.8 0 0 0 46 18" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M18 46 A 19.8 19.8 0 0 1 46 46" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="32" y1="10" x2="32" y2="6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="54" x2="32" y2="58" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="32" x2="6" y2="32" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <line x1="54" y1="32" x2="58" y2="32" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function NetworkingIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <rect x="6" y="22" width="52" height="20" rx="4" stroke="#9CA3AF" strokeWidth="2.5" />
      <rect x="10" y="27" width="4" height="10" rx="1" fill="#D1D5DB" />
      <rect x="18" y="27" width="4" height="10" rx="1" fill="#D1D5DB" />
      <rect x="26" y="27" width="4" height="10" rx="1" fill="#D1D5DB" />
      <circle cx="50" cy="32" r="3" fill="#D1D5DB" />
      <line x1="14" y1="42" x2="14" y2="52" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="42" x2="50" y2="52" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PeripheralIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <rect x="14" y="26" width="36" height="22" rx="4" stroke="#9CA3AF" strokeWidth="2.5" />
      <rect x="20" y="32" width="6" height="5" rx="1" fill="#D1D5DB" />
      <rect x="29" y="32" width="6" height="5" rx="1" fill="#D1D5DB" />
      <rect x="38" y="32" width="6" height="5" rx="1" fill="#D1D5DB" />
      <rect x="23" y="39" width="18" height="4" rx="2" fill="#E5E7EB" />
      <line x1="32" y1="20" x2="32" y2="26" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="17" r="4" stroke="#9CA3AF" strokeWidth="2" />
    </svg>
  );
}

const categoryIcons: Record<string, () => JSX.Element> = {
  "Computing Array":      ComputingIcon,
  "Robotic Node":         RoboticIcon,
  "Mobile Infrastructure": MobileIcon,
  "Sensor Array":         SensorIcon,
  "Networking":           NetworkingIcon,
  "Peripheral":           PeripheralIcon,
};

const categoryLabels: Record<string, string> = {
  "Computing Array":       "COMPUTING",
  "Robotic Node":          "ROBOTICS",
  "Mobile Infrastructure": "MOBILE",
  "Sensor Array":          "SENSOR",
  "Networking":            "NETWORK",
  "Peripheral":            "PERIPHERAL",
};

export function AssetImagePlaceholder({
  category = "",
  aspectRatio = "4/3",
  imageUrl,
}: AssetImagePlaceholderProps) {
  // useId gives a stable, unique ID per component instance — no SVG ID collisions
  const uid = useId().replace(/:/g, "-");

  const Icon = categoryIcons[category] ?? ComputingIcon;
  const label = categoryLabels[category] ?? "ASSET";
  const paddingTop = aspectRatio === "16/9" ? "56.25%" : "75%";

  if (imageUrl) {
    return (
      <div style={{ position: "relative", width: "100%", paddingTop, overflow: "hidden" }}>
        <img
          src={imageUrl}
          alt={category}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", paddingTop, background: "#F3F4F6", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {/* Dot-grid background — unique pattern ID per instance */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={`dot-${uid}`}
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="#D1D5DB" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dot-${uid})`} />
        </svg>

        {/* Category icon */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            opacity: 0.55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon />
        </div>

        {/* Category label */}
        <span
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 9,
            fontWeight: 700,
            color: "#9CA3AF",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
