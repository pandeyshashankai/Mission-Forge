export function drawOrbit(canvas, trace) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('2D rendering unavailable');
  const width = canvas.width,
    height = canvas.height,
    extent = Math.max(...trace.map(Math.abs)) * 1.15;
  ctx.fillStyle = '#0b1425';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#67e8f9';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < trace.length; i += 2) {
    const x = width / 2 + trace[i] / extent * Math.min(width, height) / 2,
      y = height / 2 - trace[i + 1] / extent * Math.min(width, height) / 2;
    if (i) ctx.lineTo(x, y);else ctx.moveTo(x, y);
  }
  ctx.stroke();
}
