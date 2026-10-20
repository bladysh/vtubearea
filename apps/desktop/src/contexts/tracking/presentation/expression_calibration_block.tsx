import { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { Badge, Button, useTranslate } from "@vtubearea/ui";
import { app_config } from "../../../config/app_config";
import { useTrackingStore } from "../application/tracking_store";

/** Faces to pull during the expression calibration, shown one after another. */
const EXPRESSION_STEPS = ["brows_up", "brows_down", "mouth_open", "smile", "frown"] as const;

/** Guided calibration of brows and mouth: the user pulls each face while the ranges are recorded. */
export function ExpressionCalibrationBlock() {
  const translate = useTranslate();
  const is_running = useTrackingStore((state) => state.session_status === "running");
  const status = useTrackingStore((state) => state.expression_calibration_status);
  const has_ranges = useTrackingStore((state) => state.expression_ranges !== null);
  const calibrate_expressions = useTrackingStore((state) => state.calibrate_expressions);
  const reset_expression_calibration = useTrackingStore((state) => state.reset_expression_calibration);
  const [started_at_ms, set_started_at_ms] = useState(0);
  const [now_ms, set_now_ms] = useState(0);
  const step_ms = app_config.tracking.expression_calibration_duration_ms / EXPRESSION_STEPS.length;
  const step_index = Math.min(EXPRESSION_STEPS.length - 1, Math.max(0, Math.floor((now_ms - started_at_ms) / step_ms)));

  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => set_now_ms(performance.now()), 200);
    return () => clearInterval(timer);
  }, [status]);

  const start = () => {
    const started_at = performance.now();
    set_started_at_ms(started_at);
    set_now_ms(started_at);
    void calibrate_expressions();
  };

  return (
    <>
      <p className="vta-field__hint">{translate("tracking.expression_calibration_hint")}</p>
      <div className="button-row">
        <Button icon={<Smile size={16} />} disabled={!is_running || status === "recording"} onClick={start}>
          {translate(status === "recording" ? "tracking.calibrating" : "tracking.calibrate_expressions")}
        </Button>
        <Button variant="ghost" disabled={!has_ranges} onClick={reset_expression_calibration}>
          {translate("common.reset")}
        </Button>
      </div>
      {status === "recording" && (
        <p className="expression-calibration__step" aria-live="polite">
          {translate(`tracking.expression_step.${EXPRESSION_STEPS[step_index]!}`)}
        </p>
      )}
      {status === "done" && <Badge tone="success">{translate("tracking.expression_calibration_done")}</Badge>}
      {status === "no_face" && <Badge tone="danger">{translate("tracking.calibration_no_face")}</Badge>}
    </>
  );
}
