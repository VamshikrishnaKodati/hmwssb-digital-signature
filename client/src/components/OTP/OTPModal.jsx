import { useState, useEffect, useCallback } from "react";
import { otpApi } from "../../services/api";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import "./OTPModal.css";
import OTPInput from "./OTPInput";
import Timer from "./Timer";

const LOGO_SRC = "/assets/logo/hmwssb-logo.png";

const maskValue = (val, keepStart = 2, keepEnd = 2) => {
  if (!val) return "";
  const s = String(val);
  if (s.length <= keepStart + keepEnd) return s;
  return s.slice(0, keepStart) + "*".repeat(s.length - keepStart - keepEnd) + s.slice(-keepEnd);
};

const RESEND_COOLDOWN_SECONDS = 30;

function OTPModal({
  isOpen,
  onClose,
  estimateId,
  managerName,
  email,
  mobile,
  onSuccess,
}) {
  const [screen, setScreen] = useState("confirm");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const resetForm = () => {
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setSuccessMessage("");
    setDeliveryInfo(null);
    setResendCooldown(0);
  };

  const handleClose = () => {
    resetForm();
    setScreen("confirm");
    onClose();
  };

  const handleSuccessClose = () => {
    resetForm();
    setScreen("confirm");
    onSuccess?.();
    onClose();
  };

  const handleSendOTP = useCallback(async () => {
    try {
      setError("");
      setIsSending(true);

      const response = await otpApi.send({
        estimateId,
        email,
        mobile,
      });

      if (response.data?.success) {
        resetForm();
        setTimerKey((prev) => prev + 1);
        setScreen("otp");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        const maskedEmail = maskValue(email, 1, 4);
        const maskedMobile = maskValue(mobile, 2, 2);
        setDeliveryInfo(
          response.data.delivery || { maskedEmail, maskedMobile }
        );
        setSuccessMessage("OTP sent successfully. Please check your email and SMS.");
      } else {
        throw new Error(response.data?.message || "Unable to send OTP.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to send OTP."
      );
    } finally {
      setIsSending(false);
    }
  }, [estimateId, email, mobile]);

  const handleResendOTP = useCallback(async () => {
    if (resendCooldown > 0) return;
    try {
      setError("");
      setIsSending(true);

      const response = await otpApi.resend({ estimateId });

      if (response.data?.success) {
        setOtp(["", "", "", "", "", ""]);
        setTimerKey((prev) => prev + 1);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setDeliveryInfo(response.data.delivery || deliveryInfo);
        setSuccessMessage("A fresh OTP has been sent. Please check your email and SMS.");
      } else {
        throw new Error(response.data?.message || "Unable to resend OTP.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to resend OTP."
      );
    } finally {
      setIsSending(false);
    }
  }, [estimateId, resendCooldown, deliveryInfo]);

  const handleVerifyOTP = useCallback(async () => {
    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setError("");
      setIsVerifying(true);
      setScreen("loading");

      const response = await otpApi.verify({
        estimateId,
        otp: enteredOtp,
      });

      if (response.data?.success) {
        setSuccessMessage(
          response.data.message || "Digital signature generated successfully."
        );
        setScreen("success");
      } else {
        throw new Error(
          response.data?.message || "OTP verification failed."
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Invalid or expired code.";
      setError(msg);
      setScreen("otp");
    } finally {
      setIsVerifying(false);
    }
  }, [otp, estimateId]);

  if (!isOpen) return null;

  const maskedEmail = deliveryInfo?.maskedEmail || maskValue(email, 1, 4);
  const maskedMobile =
    deliveryInfo?.maskedMobile || maskValue(mobile, 2, 2);
  const canResend = resendCooldown === 0 && !isSending;

  return (
    <div className="overlay">
      <div className="modal-box">
        <div className="otp-modal-header">
          <img
            src={LOGO_SRC}
            alt="HMWSSB Official Logo"
            style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain" }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Digital Signature Verification</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.8 }}>Official HMWSSB Authentication</p>
          </div>
        </div>
        <hr style={{ margin: "0 0 16px", borderColor: "var(--border)" }} />

        {screen === "confirm" && (
          <>
            <div className="otp-detail-grid">
              <p><b>Estimate :</b> {estimateId}</p>
              <p><b>Signer :</b> {managerName}</p>
              <p><b>Email :</b> {maskedEmail}</p>
              <p><b>Mobile :</b> {maskedMobile}</p>
            </div>

            <div className="alert alert-warning d-flex align-items-center gap-2" style={{ fontSize: "0.85rem" }}>
              <FaExclamationTriangle />
              OTP will be sent to your registered email and mobile number.
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendOTP}
                disabled={isSending}
              >
                {isSending ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </>
        )}

        {screen === "otp" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>OTP Verification</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{successMessage}</p>

            <div className="delivery-info text-center mb-3">
              <span className="badge bg-light text-dark me-2">
                Email: {maskedEmail} {deliveryInfo?.email ? <FaCheckCircle style={{ color: "var(--success)", marginLeft: 4 }} /> : "✗"}
              </span>
              <span className="badge bg-light text-dark">
                SMS: {maskedMobile} {deliveryInfo?.sms ? <FaCheckCircle style={{ color: "var(--success)", marginLeft: 4 }} /> : "✗"}
              </span>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <p className="text-muted text-center small">
              Enter the code sent to your registered contact.
            </p>

            <OTPInput otp={otp} setOtp={setOtp} />
            <Timer
              key={timerKey}
              initialSeconds={300}
              onExpire={() => {
                setError("OTP has expired. Please request a new one.");
                setOtpSent(false);
              }}
            />

            <div className="d-flex justify-content-between mt-3">
              <button
                className="btn btn-warning"
                onClick={handleResendOTP}
                disabled={!canResend}
                title={resendCooldown > 0 ? `Wait ${resendCooldown}s` : ""}
              >
                {isSending
                  ? "Sending..."
                  : resendCooldown > 0
                    ? `Resend (${resendCooldown}s)`
                    : "Resend OTP"}
              </button>
              <button
                className="btn btn-success"
                onClick={handleVerifyOTP}
                disabled={isVerifying}
              >
                {isVerifying ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </>
        )}

        {screen === "loading" && (
          <div className="text-center py-3">
            <div className="spinner-border" style={{ color: "var(--primary)" }} />
            <h4 className="mt-3" style={{ fontSize: "1rem", color: "var(--primary-dark)" }}>Generating Digital Signature...</h4>
          </div>
        )}

        {screen === "success" && (
          <>
            <div className="text-center mb-3">
              <FaCheckCircle style={{ fontSize: "2.5rem", color: "var(--success)" }} />
            </div>
            <h2 style={{ fontSize: "1.1rem", textAlign: "center", color: "var(--primary-dark)" }}>Digital Signature Ready</h2>
            <p className="text-center" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{successMessage}</p>

            <div className="alert alert-success text-center">
              Your digital signature has been applied successfully.
            </div>

            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-secondary" onClick={handleSuccessClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OTPModal;
