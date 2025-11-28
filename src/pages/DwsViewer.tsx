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
        session: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGxvd2VkX2RvY3VtZW50cyI6W3siZG9jdW1lbnRfaWQiOiI3S1BYMDJDSFA0UFRNR0dSQkVLQ1lBM0M1USIsInBlcm1pc3Npb25zIjpbInJlYWQiLCJ3cml0ZSIsImRvd25sb2FkIl19XSwiYWxsb3dlZF9vcGVyYXRpb25zIjpbImZvcm1zIiwiaW5zdGFudCIsImNvbW1lbnRzIiwiYW5ub3RhdGlvbnMiLCJ2aWV3ZXIiLCJhbm5vdGF0aW9uc19hcGkiLCJjYWRfY29udmVyc2lvbiIsImNhZF9jb252ZXJzaW9uX2FwaSIsImNvbW1lbnRzX2FwaSIsImNvbnRlbnRfZWRpdGluZyIsImRvY3VtZW50X2VkaXRvciIsImRvY3VtZW50X2VkaXRvcl9hcGkiLCJlbGVjdHJvbmljX3NpZ25hdHVyZXMiLCJlbGVjdHJvbmljX3NpZ25hdHVyZXNfYXBpIiwiZW1haWxfY29udmVyc2lvbiIsImVtYWlsX2NvbnZlcnNpb25fYXBpIiwiZm9ybXNfYXBpIiwiZm9ybXNfY3JlYXRvciIsImZvcm1zX2NyZWF0b3JfYXBpIiwiaHRtbF9jb252ZXJzaW9uIiwiaHRtbF9jb252ZXJzaW9uX2FwaSIsImltYWdlX2NvbnZlcnNpb24iLCJpbWFnZV9jb252ZXJzaW9uX2FwaSIsImltYWdlX3JlbmRlcmluZyIsImltYWdlX3JlbmRlcmluZ19hcGkiLCJtZWFzdXJlbWVudF90b29scyIsIm1lYXN1cmVtZW50X3Rvb2xzX2FwaSIsIm9mZmljZV9jb252ZXJzaW9uIiwib2ZmaWNlX2NvbnZlcnNpb25fYXBpIiwidXNlcl9pbnRlcmZhY2UiXSwiYWxsb3dlZF9vcmlnaW5zIjpbIl4uKiQiXSwiYXVkIjoiZG9jdW1lbnQtZW5naW5lIiwiZXhwIjoxNzY0MzgxODgwLCJpYXQiOjE3NjQyOTU0ODAsImlzcyI6Imhvc3RlZC1mcm9udGVuZCIsImp0aSI6IjMxdTBpcDI2bjVuaTU1MWdkazAwdjdraSIsIm5iZiI6MTc2NDI5NTQ4MCwic2NvcGUiOiJmcm9udGVuZCIsInNlcnZlcl91cmwiOiJodHRwczovL2RlLmRpZmZlcmVudC1iZWF2ZXIuaTEtZXVyMS5tMS5zZXJ2aWNlcy5udXRyaWVudC1wb3dlcmVkLmlvLyIsInRlbmFudF9pZCI6IjdLUFdaNkEwV1ZZUDA5TjFUN1k0OFhGRjE0IiwidGVuYW50X2xpbWl0cyI6eyJkb2N1bWVudF9saW1pdCI6MTAwLCJzaG93X3RyaWFsX3dhdGVybWFyayI6ZmFsc2UsInN0b3JhZ2Vfc2l6ZV9saW1pdCI6NTI0Mjg4MDAwfSwidmVyc2lvbiI6IjIwMjUtMDMtMDEifQ.NTeNMEmbLo-poQki-0vFJS3_V7LCkAFN70_-qDt9Frj8oCbf5_9po3AxxTLOHE6cmUXVwj6AhwRbOl7S1oEhihZ5oe5QJwHG_o0-3udOZh9-17Z6DkW2ohOx2x-eUo1BSE8y9sKc6PmArRZZE-09w5dWH5zviKc68tSKvsX2d36fwn_Y_8R_IYMJZA8HaeMpbv-uCxzwni0kGfzGhnOD-libMDAwnwRETnNSlA0GzApBa03zeOAwj-wQO4gZEXawSLFz_ln2X6DK7EBJ7Q5gngdNlcF0Teca9kStUZIyhqKwuuU49GpDBdzxeQIBUoq1P1PQBF6xQ2xFkWKv3xM5IniaI267TDfBcY4CxAdM9fysxWao7BD-R-zjcO_DY52Na09r6whzXGQCgJw6LJZev1N2W6bF27DnOn1dGE3LtK2ubI55VL3r7eiLi5EisEtQbNALZdeBg5U3PIzCqVHKTyhvrMMeao_8JvfFQ58jm_Yma7XnL1xVq0Jsg3pK_LPC3nIBkeK6qzygbt7jQI3C6Xh7zmgwh5xHjAMXSSXlfOMKX-PvEwia5A2RhJsoqqY9x2AsKlTjkPVikJb63sFLu6p1-_nF8jZAY5JuMGRt-5WbQTFIEqTVuGHzjPK_Z1ARjNEqaqlGaF1yeinoWJWce_sWuqBh_4whJeEAFKS6haM",
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