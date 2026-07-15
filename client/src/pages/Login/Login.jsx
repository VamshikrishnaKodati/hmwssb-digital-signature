import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";
import { toast } from "react-toastify";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSignInAlt } from "react-icons/fa";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ username: username.trim(), password });
      const { token, user } = res.data;
      login(token, user);
      toast.success("Login successful");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{
        background: "linear-gradient(180deg, #EAF5FF 0%, #f0f7ff 40%, #ffffff 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(33,182,215,0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(11,92,173,0.05) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(30,136,229,0.03) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-3" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          {/* Logo Section */}
          <div className="text-center mb-4">
            <img
              src={LOGO_SRC}
              alt="HMWSSB Official Logo"
              style={{
                width: 200,
                maxWidth: "100%",
                height: "auto",
                marginBottom: 20,
                filter: "drop-shadow(0 8px 32px rgba(11,92,173,0.15))",
              }}
            />
            <h1
              style={{
                fontSize: "1.8rem",
                fontWeight: 800,
                color: "var(--primary)",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              HMWSSB
            </h1>
            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "var(--primary-dark)",
                marginBottom: 4,
                lineHeight: 1.4,
              }}
            >
              Hyderabad Metropolitan<br />
              Water Supply &amp; Sewerage Board
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--primary)",
                letterSpacing: "0.04em",
                marginTop: 8,
              }}
            >
              Works Management System
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                letterSpacing: "0.03em",
                marginTop: 4,
              }}
            >
              Official Government Portal
            </p>
          </div>

          {/* Login Card */}
          <div
            className="card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "0 8px 40px rgba(11,92,173,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 4,
                background: "linear-gradient(90deg, var(--primary) 0%, var(--water-cyan) 50%, var(--primary-light) 100%)",
              }}
            />
            <div className="card-body p-4 p-md-5">
              <h2
                className="text-center mb-4"
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--primary-dark)",
                }}
              >
                Sign In
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                    Username
                  </label>
                  <div className="input-group">
                    <span
                      className="input-group-text"
                      style={{
                        background: "var(--light-blue)",
                        border: "1px solid var(--border)",
                        borderRight: "none",
                        borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
                        color: "var(--primary)",
                      }}
                    >
                      <FaUser />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                      required
                      style={{
                        borderLeft: "none",
                        paddingLeft: 0,
                      }}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                    Password
                  </label>
                  <div className="input-group">
                    <span
                      className="input-group-text"
                      style={{
                        background: "var(--light-blue)",
                        border: "1px solid var(--border)",
                        borderRight: "none",
                        borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
                        color: "var(--primary)",
                      }}
                    >
                      <FaLock />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        borderLeft: "none",
                        paddingLeft: 0,
                      }}
                    />
                    <button
                      type="button"
                      className="input-group-text"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      style={{
                        background: "var(--light-blue)",
                        border: "1px solid var(--border)",
                        borderLeft: "none",
                        borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                        color: "var(--primary)",
                        cursor: "pointer",
                      }}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <FaSignInAlt />
                      Sign In
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="text-center py-3"
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          opacity: 0.7,
        }}
      >
        &copy; {new Date().getFullYear()} HMWSSB &middot; Government of Telangana
      </div>
    </div>
  );
};

export default Login;
