import { useEffect, useRef, useState } from "react";

function Timer({ initialSeconds = 300, onExpire }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <h5 className="text-center mt-3 text-danger">
      {minutes}:{secs}
    </h5>
  );
}

export default Timer;
