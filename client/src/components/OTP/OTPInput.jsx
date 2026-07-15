import { useRef } from "react";

function OTPInput({ otp, setOtp }) {
  const inputRefs = useRef([]);

  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1].focus();
    }
  };

  return (
    <div
      className="d-flex justify-content-center gap-2 mt-3"
    >
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          maxLength={1}
          className="form-control text-center"
          style={{
            width: "50px",
            height: "55px",
            fontSize: "22px",
            fontWeight: "bold",
          }}
          value={digit}
          onChange={(e) =>
            handleChange(e.target.value, index)
          }
          onKeyDown={(e) =>
            handleKeyDown(e, index)
          }
        />
      ))}
    </div>
  );
}

export default OTPInput;