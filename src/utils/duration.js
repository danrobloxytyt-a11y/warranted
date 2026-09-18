const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };

// Parses strings like "10m", "1h", "3d" into milliseconds. Returns null if
// the format doesn't match.
function parseDuration(input) {
  const match = /^(\d+)([mhd])$/i.exec(input.trim());
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit.toLowerCase()];
}

module.exports = { parseDuration };
