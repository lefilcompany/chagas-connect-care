/**
 * Centralized, non-sensitive application identity.
 * Used by the frontend to display the product name and the default
 * "Powered by …" signature. The backend mirrors this with the
 * `APPLICATION_DISPLAY_NAME` environment variable (Edge Functions only,
 * NEVER expose via VITE_ prefixed vars).
 */
export const APP_DISPLAY_NAME = "Chagas Digital Care";
export const DEFAULT_POWERED_BY_TEXT = `Powered by ${APP_DISPLAY_NAME}`;