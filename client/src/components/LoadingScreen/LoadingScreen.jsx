const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function LoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #EAF5FF 0%, #F7FAFC 50%, #ffffff 100%)",
        zIndex: 9999,
      }}
    >
      <div style={{ position: "relative", marginBottom: 24 }}>
        <img
          src={LOGO_SRC}
          alt="HMWSSB Official Logo"
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            animation: "pulse-logo 2s ease-in-out infinite",
            objectFit: "contain",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -8,
            border: "3px solid transparent",
            borderTopColor: "var(--primary)",
            borderRadius: 20,
            animation: "spin-ring 1s linear infinite",
          }}
        />
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: "1.1rem",
          color: "var(--primary)",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        HMWSSB
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
        Loading HMWSSB Works Management System...
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.7 }}>
        Government of Telangana
      </div>
      <style>{`
        @keyframes pulse-logo {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        @keyframes spin-ring {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoadingScreen;
