// NarrativeArchive's stand-ins for Marinara server pieces the ported files import (not Marinara code).
// The ported files stay as they are; what they need from the Marinara server is given here, empty.
export const logDebugOverride = () => {};
export const isDebugAgentsEnabled = () => false;
export const logger = { debug() {}, info() {}, warn() {}, error() {} };
// (the ported context block is put under our own "[CONTEXT]" heading: nothing is wrapped here)
export const wrapContent = content => String(content ?? '').trim();
