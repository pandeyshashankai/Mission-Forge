def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'three/FlightView.jsx',[
('''const QUALITY = { low: { px: 0.75, seg: 96, cap: 96 },''','''const QUALITY = { auto: { px: 1, seg: 160, cap: 160 }, low: { px: 0.75, seg: 96, cap: 96 },'''),
('''      const dtReal = Math.min(0.1, (now - last) / 1000);''','''      const dtReal = Math.min(0.1, (now - last) / 1000);
      // Dynamic quality: adapt the render resolution to hold ~40-55 fps.
      if (quality === "auto") {
        fpsAcc += dtReal;
        fpsN++;
        if (fpsAcc > 2) {
          const fps = fpsN / fpsAcc;
          const np = fps < 40 ? Math.max(0.5, px - 0.15) : fps > 55 ? Math.min(window.devicePixelRatio, 1.5, px + 0.1) : px;
          if (np !== px) renderer.setPixelRatio((px = np));
          fpsAcc = fpsN = 0;
        }
      }'''),
])
print("ok")
