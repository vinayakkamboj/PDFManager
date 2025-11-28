import { useEffect, useRef } from "react";

const DwsViewer = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const { NutrientViewer } = window as any;

    if (container && NutrientViewer) {
      NutrientViewer.load({
        container,
        // Paste your DWS Viewer API session token here:
        session: "<YOUR_SESSION_TOKEN>",
      });
    }

    return () => {
      NutrientViewer?.unload(container);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: "100vh", width: "100vw" }}
    />
  );
};

export default DwsViewer;