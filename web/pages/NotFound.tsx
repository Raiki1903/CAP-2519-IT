import { useNavigate } from "react-router";
import { Shield, AlertTriangle } from "lucide-react";

const BRAND = "#005A36";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9FAFB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "#FEF2F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={28} color="#EF4444" />
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#F3F4F6",
            fontFamily: "'Montserrat', sans-serif",
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h2
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: "#111827",
            margin: "8px 0 4px",
          }}
        >
          Page Not Found
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          The route you requested does not exist in this system.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "9px 18px",
            border: "1px solid #E5E7EB",
            background: "#fff",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Go Back
        </button>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "9px 18px",
            border: "none",
            background: BRAND,
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          <Shield size={14} /> Return to Login
        </button>
      </div>
    </div>
  );
}
