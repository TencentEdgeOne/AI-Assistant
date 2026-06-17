/**
 * Model & Gateway configuration
 */

const DEFAULT_MODEL = '@makers/hy3-preview';

export function resolveModelName(env?: Record<string, string | undefined>): string {
  return env?.AI_GATEWAY_MODEL || DEFAULT_MODEL;
}
