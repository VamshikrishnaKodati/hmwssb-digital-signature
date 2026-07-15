const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

function Footer() {
  return (
    <footer
      style={{
        background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)",
        color: "rgba(255,255,255,0.85)",
        padding: "24px 0",
        marginTop: "auto",
      }}
    >
      <div className="container">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <img
              src={LOGO_SRC}
              alt="HMWSSB Official Logo"
              style={{ width: 36, height: 36, borderRadius: 6, objectFit: "contain" }}
              loading="lazy"
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>
                HMWSSB Works Management System
              </div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                Government of Telangana
              </div>
            </div>
          </div>
          <div className="text-center text-md-end">
            <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
              &copy; {new Date().getFullYear()} HMWSSB &middot; Government of Telangana
            </div>
            <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: 2 }}>
              Version 1.0
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
