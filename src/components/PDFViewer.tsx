// PDFViewer.tsx
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

interface PDFViewerProps {
  onAnnotationsLoad?: (annotations: any[]) => void; // wrappers: { sdk, pageIndex, boundingBox, clientId, type }
  onDocumentLoad?: (fileName: string) => void;
  className?: string;
  onModeChange?: (mode: string) => void;
}

export interface PDFViewerHandle {
  loadDocument: (file: File) => Promise<void>;
  navigateToPage: (pageIndex: number) => void;
  getInstance: () => any;
  unloadDocument: () => Promise<void>;
  focusAnnotation: (annotationWrapper: any) => Promise<void>;
  enterDrawMode: () => Promise<void>;
}

let __tempClientIdCounter = 1; // module-level counter to create stable client ids for unsaved annotations

const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(
  ({ onAnnotationsLoad, onDocumentLoad, className = "", onModeChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    /**
     * Collect annotations across pages and return wrapper objects:
     * { sdk: annotationObj, pageIndex, boundingBox, type, clientId }
     *
     * Key changes:
     * - We include annotations even if they lack a persistent `id`. For those we assign
     *   a generated `__clientId` on the sdk object so React keys can be stable while editing.
     * - We filter annotation types to only include user-created annotations (no widgets/links).
     */
    const collectAnnotations = async (instance: any): Promise<any[]> => {
      const out: any[] = [];
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;

        // Define which annotation types to include (only user-created annotations)
        const allowedTypes = [
          Nutrient.Annotations?.InkAnnotation,
          Nutrient.Annotations?.HighlightAnnotation,
          Nutrient.Annotations?.TextAnnotation,
          Nutrient.Annotations?.NoteAnnotation,
          Nutrient.Annotations?.ImageAnnotation,
          Nutrient.Annotations?.ShapeAnnotation,
          Nutrient.Annotations?.StampAnnotation,
          // Add other types you want to show
        ].filter(Boolean); // remove any undefined entries, for safety

        const totalPages = instance.totalPageCount ?? 0;
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          try {
            const list = await instance.getAnnotations(pageIndex);
            // `list` may be an immutable collection; convert to array of annotation objects
            const pageArray =
              list && typeof list.toArray === "function"
                ? list.toArray()
                : Array.from(list || []);

            for (let i = 0; i < pageArray.length; i++) {
              const a = pageArray[i];
              if (!a) continue;

              // Filter out unwanted annotation types (widgets, links, etc.)
              let isAllowedType = true;
              if (allowedTypes.length > 0) {
                isAllowedType = allowedTypes.some((Type) => {
                  try {
                    // Use instanceof when possible
                    return Type && a instanceof Type;
                  } catch (e) {
                    // In some environments instanceof can fail across realms; fallback to type/subtype/ctor name
                    return false;
                  }
                });

                // If instanceof checks failed (e.g., cross-realm), try name-based fallback
                if (!isAllowedType) {
                  const ctorName = a?.constructor?.name ?? "";
                  const subtype = a?.type ?? a?.subtype ?? "";
                  const nameLower = (ctorName + " " + subtype).toLowerCase();
                  const allowedNames = [
                    "ink",
                    "highlight",
                    "text",
                    "note",
                    "image",
                    "shape",
                    "stamp",
                  ];
                  isAllowedType = allowedNames.some((n) => nameLower.includes(n));
                }
              }

              if (!isAllowedType) continue;

              // Some annotations contain boundingBox, others use rects
              const bbox = a.boundingBox ?? (a.rects && a.rects.length ? a.rects[0] : null);

              // visible text / content heuristic
              const hasVisibleText = !!(a?.text || a?.note || a?.subject);
              const hasGeometry = !!bbox;

              // Accept annotation if it has visible content or geometry
              if (!hasVisibleText && !hasGeometry) continue;

              // annotation type (if available)
              const ctorName = a?.constructor?.name ?? "";
              const type = a?.type ?? a?.subtype ?? ctorName ?? "annotation";

              // Build a stable key:
              // Prefer `id` (persistent). If missing (unsaved / transient annotation), assign a generated __clientId
              let clientId = a?.id ?? (a as any).__clientId;
              if (!clientId) {
                clientId = `temp-${++__tempClientIdCounter}`;
                try {
                  // mutate the annotation object with a small clientId marker - safe for UI only
                  (a as any).__clientId = clientId;
                } catch (e) {
                  // if immutability prevents mutation, fallback to synthetic key below
                }
              }

              out.push({ sdk: a, pageIndex, boundingBox: bbox, type, clientId });
            }
          } catch (err) {
            // ignore page-specific read errors
          }
        }
      } catch (err) {
        console.error("collectAnnotations error:", err);
      }
      return out;
    };

    const attachAnnotationEvents = (instance: any, refreshFn: () => Promise<void>) => {
      // create named handlers so we can remove them later if needed
      const onCreate = async (created: any) => {
        // created may be immutable - we will re-collect for full, authoritative list
        await refreshFn();
      };
      const onUpdate = async (updated: any) => {
        await refreshFn();
      };
      const onDelete = async (deleted: any) => {
        await refreshFn();
      };
      try {
        instance.addEventListener && instance.addEventListener("annotations.create", onCreate);
        instance.addEventListener && instance.addEventListener("annotations.update", onUpdate);
        instance.addEventListener && instance.addEventListener("annotations.delete", onDelete);
      } catch (e) {
        console.warn("Failed to attach annotation events:", e);
      }
      // Return removal function (not strictly used here but good practice)
      return () => {
        try {
          instance.removeEventListener && instance.removeEventListener("annotations.create", onCreate);
          instance.removeEventListener && instance.removeEventListener("annotations.update", onUpdate);
          instance.removeEventListener && instance.removeEventListener("annotations.delete", onDelete);
        } catch (e) {}
      };
    };

    const loadNewDocument = async (arrayBuffer: ArrayBuffer, fileName: string) => {
      const container = containerRef.current;
      if (!container) throw new Error("Viewer container missing");

      const Nutrient = (await import("@nutrient-sdk/viewer")).default;

      // Unload previous instance defensively
      if (instanceRef.current) {
        try {
          await Nutrient.unload(container);
        } catch (e) {
          console.warn("Error unloading previous instance:", e);
        }
        instanceRef.current = null;
      }

      const instance = await Nutrient.load({
        container,
        document: arrayBuffer,
        baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.PUBLIC_URL ?? ""}`,
      });

      instanceRef.current = instance;

      // collect and emit
      const wrappers = await collectAnnotations(instance);
      onAnnotationsLoad?.(wrappers);
      onDocumentLoad?.(fileName);

      // attach annotation listeners and refresh using collectAnnotations
      attachAnnotationEvents(instance, async () => {
        try {
          const updated = await collectAnnotations(instance);
          onAnnotationsLoad?.(updated);
        } catch (e) {
          console.warn("refresh annotations failed:", e);
        }
      });
    };

    useEffect(() => {
      let mounted = true;
      let detachFn: (() => void) | null = null;

      (async () => {
        const container = containerRef.current;
        if (!container) return;
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;

          try {
            await Nutrient.unload(container);
          } catch (e) {}

          const instance = await Nutrient.load({
            container,
            document: "https://www.nutrient.io/downloads/nutrient-web-demo.pdf",
            baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.PUBLIC_URL ?? ""}`,
          });

          if (!mounted) {
            try { await Nutrient.unload(container); } catch (e) {}
            return;
          }

          instanceRef.current = instance;
          setIsInitialized(true);

          const wrappers = await collectAnnotations(instance);
          onAnnotationsLoad?.(wrappers);
          onDocumentLoad?.("nutrient-web-demo.pdf");

          // attach events
          detachFn = attachAnnotationEvents(instance, async () => {
            const updated = await collectAnnotations(instance);
            onAnnotationsLoad?.(updated);
          });
        } catch (err) {
          console.error("Viewer init failed:", err);
        }
      })();

      return () => {
        mounted = false;
        (async () => {
          const c = containerRef.current;
          if (!c) return;
          try {
            const Nutrient = (await import("@nutrient-sdk/viewer")).default;
            await Nutrient.unload(c);
          } catch (e) {}
        })();
        if (typeof detachFn === "function") detachFn();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      loadDocument: async (file: File) => {
        if (!isInitialized) throw new Error("Viewer not ready");
        const buffer = await file.arrayBuffer();
        await loadNewDocument(buffer, file.name);
      },

      navigateToPage: (pageIndex: number) => {
        if (!instanceRef.current) return;
        try {
          instanceRef.current.setViewState((vs: any) =>
            vs.set("currentPageIndex", pageIndex)
          );
        } catch (e) {
          console.error("navigateToPage failed:", e);
        }
      },

      getInstance: () => instanceRef.current,

      unloadDocument: async () => {
        const container = containerRef.current;
        if (!container) return;
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          await Nutrient.unload(container);
        } catch (err) {
          console.warn("unloadDocument failed:", err);
        } finally {
          instanceRef.current = null;
        }
      },

      focusAnnotation: async (annotationWrapper: any) => {
        if (!instanceRef.current || !annotationWrapper) return;
        const instance = instanceRef.current;
        try {
          const pageIndex = annotationWrapper.pageIndex;

          // Navigate to the page WITHOUT zooming
          try {
            instance.setViewState((vs: any) => vs.set("currentPageIndex", pageIndex));
          } catch (e) {
            // fallback if setViewState isn't available
            try {
              if (typeof instance.navigateToPage === "function") instance.navigateToPage(pageIndex);
            } catch (e2) {}
          }

          // Select/highlight the annotation (best-effort)
          try {
            if (typeof instance.setSelectedAnnotation === "function") {
              await instance.setSelectedAnnotation(annotationWrapper.sdk);
            } else if (typeof instance.select === "function") {
              instance.select(annotationWrapper.sdk);
            }
          } catch (e) {
            console.warn("Could not select annotation:", e);
          }
        } catch (err) {
          console.error("focusAnnotation error:", err);
        }
      },

      // Enter draw (ink) mode using InteractionMode.INK if available
      enterDrawMode: async () => {
        if (!instanceRef.current) return;
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          const inkMode = Nutrient?.InteractionMode?.INK;
          if (typeof inkMode !== "undefined") {
            instanceRef.current.setViewState((vs: any) => vs.set("interactionMode", inkMode));
            onModeChange?.("ink");
          } else if (typeof instanceRef.current.activateTool === "function") {
            // fallback
            try { await instanceRef.current.activateTool("ink"); onModeChange?.("ink"); } catch (e) {}
          } else {
            console.warn("Could not set draw mode - InteractionMode.INK not available.");
          }
        } catch (err) {
          console.error("enterDrawMode failed:", err);
        }
      },
    }));

    return (
      <div
        ref={containerRef}
        className={`h-full w-full ${className}`}
        style={{ height: "100%", minHeight: "500px" }}
      />
    );
  }
);

PDFViewer.displayName = "PDFViewer";

export default PDFViewer;
