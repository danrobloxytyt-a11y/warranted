module.exports = {
  colors: {
    black: 0x0a0a0a,
    silver: 0xc9c9c9,
    red: 0x7a1010
  },

  // XP needed to REACH a given level. Scaled 4x from the standard MEE6-style
  // curve (5L^2 + 50L + 100) specifically so the top of the ladder takes
  // months of real activity, not days. See README "Tuning the grind" section
  // for the actual day-count math this was built from.
  //
  // Level 0 is special-cased to require exactly 0 XP — everyone starts there
  // by definition. Without this, the raw formula returns 400 at level 0,
  // which made new members' progress bars show negative numbers.
  xpForLevel(level) {
    if (level <= 0) return 0;
    return 20 * (level ** 2) + 200 * level + 400;
  },

  // Given total xp, figure out current level.
  levelFromXp(xp) {
    let level = 0;
    while (xp >= this.xpForLevel(level + 1)) {
      level++;
    }
    return level;
  },

  // Random XP per text message, gated by a cooldown enforced by the caller
  // (see leveling.js MESSAGE_COOLDOWN_MS).
  xpPerMessage() {
    return Math.floor(Math.random() * 10) + 15; // 15-24
  },

  // XP granted per minute of active (non-AFK) voice channel time.
  // Deliberately lower per-tick than message XP since it accrues passively
  // and can't be rate-limited the same way a cooldown limits typing.
  xpPerVoiceMinute() {
    return Math.floor(Math.random() * 6) + 8; // 8-13
  }
};
