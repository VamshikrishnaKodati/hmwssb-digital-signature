import React from "react";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="d-flex flex-column align-items-center justify-content-center"
          style={{ minHeight: "100vh", padding: "2rem" }}
        >
          <div
            className="card shadow-sm"
            style={{ maxWidth: 500, width: "100%" }}
          >
            <div className="card-body text-center p-5">
              <img
                src={LOGO_SRC}
                alt="HMWSSB Official Logo"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  marginBottom: 16,
                  objectFit: "contain",
                }}
              />
              <h3 className="card-title mb-3">Something went wrong</h3>
              <p className="text-muted mb-4">
                An unexpected error occurred. Please try again.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-start mb-3">
                  <summary className="text-muted small">Error details</summary>
                  <pre
                    className="mt-2 p-3 bg-light rounded"
                    style={{ fontSize: 12, overflow: "auto", maxHeight: 200 }}
                  >
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <div className="d-flex gap-2 justify-content-center">
                <button className="btn btn-primary" onClick={this.handleReload}>
                  Reload Page
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={this.handleGoHome}
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
