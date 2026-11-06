import { useEffect, useState } from "react";
import { Toaster } from "../ui/sonner";
import { useGame } from "../../game/GameContext";
export function Notifications() {
  const { settings } = useGame(),
    [mobile, setMobile] = useState(
      () => window.matchMedia("(max-width:600px)").matches,
    );
  useEffect(() => {
    const media = window.matchMedia("(max-width:600px)"),
      update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <Toaster
      theme={settings.theme === "daylight" ? "light" : "dark"}
      position={mobile ? "top-center" : "bottom-right"}
      mobileOffset={{ top: 120, left: 16, right: 16 }}
      duration={2200}
      closeButton
    />
  );
}
