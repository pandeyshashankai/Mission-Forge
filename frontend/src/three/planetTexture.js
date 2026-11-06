import * as THREE from "three";

// Small deterministic surface maps keep exploration self-contained and inexpensive to load.
export function planetTexture(body) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  let seed = [...body.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 17) >>> 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.fillStyle = body.color;
  g.fillRect(0, 0, 1024, 512);
  if (body.gas || body.id === "venus" || body.id === "titan") {
    for (let y = 0; y < 512; y += 2) {
      const band = Math.sin(y * 0.11) * 0.07 + Math.sin(y * 0.035) * 0.08;
      g.fillStyle =
        band > 0 ? `rgba(255,245,220,${band})` : `rgba(60,30,20,${-band})`;
      g.fillRect(0, y, 1024, 3);
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,240,215,${random() * 0.07})`;
      g.beginPath();
      g.ellipse(
        random() * 1024,
        random() * 512,
        random() * 130 + 12,
        random() * 8 + 2,
        0,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    if (body.id === "jupiter") {
      g.fillStyle = "#ad725a";
      g.beginPath();
      g.ellipse(700, 318, 45, 17, -0.12, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    for (let i = 0; i < 2200; i++) {
      const r = random() * 10 + 1,
        x = random() * 1024,
        y = random() * 512;
      g.fillStyle = `rgba(35,20,15,${random() * 0.15})`;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,245,220,.08)";
      g.stroke();
    }
    if (body.id === "mars") {
      g.fillStyle = "rgba(235,227,213,.65)";
      g.fillRect(0, 0, 1024, 13);
      g.fillRect(0, 499, 1024, 13);
    }
    if (body.id === "europa") {
      g.strokeStyle = "rgba(113,76,45,.4)";
      g.lineWidth = 1;
      for (let i = 0; i < 55; i++) {
        let x = random() * 1024,
          y = random() * 512;
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 10; j++) {
          x += (random() - 0.5) * 90;
          y += (random() - 0.5) * 50;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
