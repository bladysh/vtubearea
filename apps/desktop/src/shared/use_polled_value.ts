import { useEffect, useState } from "react";

/**
 * Re-reads a fast-changing runtime value a few times per second, so React
 * renders at UI speed instead of at tracking or render speed.
 */
export function usePolledValue<Value>(read_value: () => Value, interval_ms = 150): Value {
  const [value, set_value] = useState(read_value);
  useEffect(() => {
    const interval_id = window.setInterval(() => set_value(read_value()), interval_ms);
    return () => window.clearInterval(interval_id);
  }, [read_value, interval_ms]);
  return value;
}
