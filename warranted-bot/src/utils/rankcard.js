const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const config = require('../config');

const WIDTH = 934;
const HEIGHT = 282;
const BG_PATH = path.join(__dirname, '..', '..', 'assets', 'rank-bg.png');

let backgroundImage = null;
async function getBackground() {
  if (!backgroundImage) {
    backgroundImage = await loadImage(BG_PATH);
  }
  return backgroundImage;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a rank card as a PNG buffer.
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.avatarURL
 * @param {number} opts.level
 * @param {number} opts.rank - server-wide position, e.g. 3 for #3
 * @param {number} opts.xp - total xp
 * @param {number} opts.currentLevelXp - xp required to reach current level
 * @param {number} opts.nextLevelXp - xp required to reach next level
 */
async function generateRankCard({ username, avatarURL, level, rank, xp, currentLevelXp, nextLevelXp }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background image, cropped to fill.
  const bg = await getBackground();
  ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);

  // Dark overlay so white text stays legible over the busy texture.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle vignette on the left where the avatar/text sit, for extra contrast.
  const gradient = ctx.createLinearGradient(0, 0, WIDTH * 0.65, 0);
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Avatar, circular crop.
  const avatarSize = 170;
  const avatarX = 56;
  const avatarY = (HEIGHT - avatarSize) / 2;

  try {
    const avatar = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    console.error('Rank card: failed to load avatar:', err.message);
  }

  // Thin ring around the avatar.
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const textX = avatarX + avatarSize + 48;

  // Username.
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '600 44px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(username, textX, 108);

  // Rank + Level, level number in the red accent to match the bot's theme.
  ctx.font = '400 26px sans-serif';
  ctx.fillStyle = '#a8a8a8';
  ctx.fillText('RANK', textX, 150);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '600 30px sans-serif';
  ctx.fillText(`#${rank}`, textX + 78, 152);

  ctx.font = '400 26px sans-serif';
  ctx.fillStyle = '#a8a8a8';
  ctx.fillText('LEVEL', textX + 200, 150);
  ctx.fillStyle = '#c0392b';
  ctx.font = '600 30px sans-serif';
  ctx.fillText(`${level}`, textX + 292, 152);

  // XP progress bar.
  const barX = textX;
  const barY = 190;
  const barWidth = WIDTH - textX - 56;
  const barHeight = 22;

  roundRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  const progress = Math.max(0, Math.min(1, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)));
  const filledWidth = Math.max(barHeight, barWidth * progress); // never smaller than the rounded cap

  roundRect(ctx, barX, barY, filledWidth, barHeight, barHeight / 2);
  const barGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  barGradient.addColorStop(0, '#e5e5e5');
  barGradient.addColorStop(1, '#c0392b');
  ctx.fillStyle = barGradient;
  ctx.fill();

  // XP text under the bar.
  ctx.font = '400 20px sans-serif';
  ctx.fillStyle = '#c8c8c8';
  const xpText = `${xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP`;
  ctx.fillText(xpText, barX, barY + barHeight + 28);

  return canvas.encode('png');
}

module.exports = { generateRankCard };
