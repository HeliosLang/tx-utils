export const MILLISECOND = 1
export const SECOND = 1000 * MILLISECOND
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY

/**
 * From experience: -90 seconds and +300 seconds are good offsets to wrt. `now()` to set the validity time range to
 */
export const DEFAULT_TX_VALIDITY_OFFSETS = [-90 * SECOND, 300 * SECOND]
