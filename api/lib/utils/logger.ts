/**
 * Structured logger.
 *
 * Health data, credentials and tokens must never reach the logs. Callers pass
 * a short event name plus a small context object; the context is scrubbed of
 * anything whose key looks sensitive before it is written.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|apikey|api_key|credential|ssn|dob|dateofbirth/i;

/**
 * Keys whose values are participant health measurements. Their presence is
 * logged, their values are not.
 */
const HEALTH_KEY = /^(value|values|glucose|reading|readings|hba1c|dose|doseunits|carbs|calories|weight|systolic|diastolic|heartrate|notes|body)$/i;

function scrub(context: LogContext, depth = 0): LogContext {
  if (depth > 3) return { truncated: true };

  const output: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (HEALTH_KEY.test(key)) {
      output[key] = "[health-data]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = scrub(value as LogContext, depth + 1);
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = `[array(${value.length})]`;
      continue;
    }
    output[key] = value;
  }
  return output;
}

function write(level: LogLevel, event: string, context?: LogContext): void {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(context ? scrub(context) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") write("debug", event, context);
  },
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};

/** Exposed for unit tests. */
export const __testing = { scrub };
