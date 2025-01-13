export const MILLISECOND = 1
export const SECOND = /* @__PURE__ */ (() => 1000 * MILLISECOND)()
export const MINUTE = /* @__PURE__ */ (() => 60 * SECOND)()
export const HOUR = /* @__PURE__ */ (() => 60 * MINUTE)()
export const DAY = /* @__PURE__ */ (() => 24 * HOUR)()
export const WEEK = /* @__PURE__ */ (() => 7 * DAY)()

/**
 * From experience: -90 seconds and +300 seconds are good offsets wrt. `now()` to set the tx validity time range to
 */
export const DEFAULT_TX_VALIDITY_OFFSETS = /* @__PURE__ */ (() => [
    -90 * SECOND,
    300 * SECOND
])()
