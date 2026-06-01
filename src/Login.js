import { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("https://leave-tracker-2.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin({ isAuthenticated: true, isViewOnly: false, user: data.user });
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnly = () => {
    onLogin({ isAuthenticated: false, isViewOnly: true, user: null });
  };

  return (
    <div style={styles.root}>
      <div style={styles.noise} />
      
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.headerTag}>ATTENDANCE MANAGEMENT</div>
            <h1 style={styles.title}>Leave Tracker</h1>
            <p style={styles.subtitle}>Sign in to manage attendance or view as guest</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={styles.input}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.input}
                required
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                ...styles.primaryButton,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerText}>or</span>
          </div>

          <button
            onClick={handleViewOnly}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            👁️ Just Viewing
          </button>

          <div style={styles.footer}>
            <p style={styles.footerText}>
              View-only mode allows you to see attendance data without making changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#e0e0e0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
    position: "relative",
    overflow: "hidden",
  },
  noise: {
    position: "fixed",
    inset: 0,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
    pointerEvents: "none",
    zIndex: 0,
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 420,
    padding: "0 20px",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "40px 32px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    border: "1px solid #d0d0d0",
  },
  header: {
    textAlign: "center",
    marginBottom: 32,
  },
  headerTag: {
    fontSize: 10,
    letterSpacing: 3,
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.5,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#333",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid #ccc",
    borderRadius: 8,
    background: "#f8f8f8",
    color: "#333",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, background 0.2s",
  },
  error: {
    background: "#fee",
    color: "#c33",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 16,
    border: "1px solid #fcc",
  },
  button: {
    width: "100%",
    padding: "12px 20px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  primaryButton: {
    background: "#1a3a2a",
    color: "#4ade80",
    border: "1px solid #2a4a3a",
  },
  secondaryButton: {
    background: "#f0f0f0",
    color: "#555",
    border: "1px solid #ccc",
  },
  divider: {
    position: "relative",
    textAlign: "center",
    margin: "24px 0",
  },
  dividerText: {
    background: "#fff",
    padding: "0 12px",
    fontSize: 12,
    color: "#999",
    position: "relative",
    zIndex: 1,
  },
  footer: {
    marginTop: 24,
    textAlign: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#888",
    lineHeight: 1.5,
  },
};
