// PDFViewer.tsx
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

interface PDFViewerProps {
  onAnnotationsLoad?: (annotations: any[]) => void;
  onSignatureFieldsLoad?: (signatureFields: any[]) => void;
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
  focusSignatureField: (signatureField: any) => Promise<void>;
  enterDrawMode: () => Promise<void>;
  addSignatureField: () => Promise<void>; // NEW method
}

let __tempClientIdCounter = 1;
let __signatureFieldCounter = 1; // Counter for unique signature field names

const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(
  ({ onAnnotationsLoad, onSignatureFieldsLoad, onDocumentLoad, className = "", onModeChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    /**
     * Collect annotations across pages
     */
    const collectAnnotations = async (instance: any): Promise<any[]> => {
      const out: any[] = [];
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;

        const allowedTypes = [
          Nutrient.Annotations?.InkAnnotation,
          Nutrient.Annotations?.HighlightAnnotation,
          Nutrient.Annotations?.TextAnnotation,
          Nutrient.Annotations?.NoteAnnotation,
          Nutrient.Annotations?.ImageAnnotation,
          Nutrient.Annotations?.ShapeAnnotation,
          Nutrient.Annotations?.StampAnnotation,
        ].filter(Boolean);

        const totalPages = instance.totalPageCount ?? 0;
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          try {
            const list = await instance.getAnnotations(pageIndex);
            const pageArray =
              list && typeof list.toArray === "function"
                ? list.toArray()
                : Array.from(list || []);

            for (let i = 0; i < pageArray.length; i++) {
              const a = pageArray[i];
              if (!a) continue;

              let isAllowedType = true;
              if (allowedTypes.length > 0) {
                isAllowedType = allowedTypes.some((Type) => {
                  try {
                    return Type && a instanceof Type;
                  } catch (e) {
                    return false;
                  }
                });

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

              const bbox = a.boundingBox ?? (a.rects && a.rects.length ? a.rects[0] : null);
              const hasVisibleText = !!(a?.text || a?.note || a?.subject);
              const hasGeometry = !!bbox;

              if (!hasVisibleText && !hasGeometry) continue;

              const ctorName = a?.constructor?.name ?? "";
              const type = a?.type ?? a?.subtype ?? ctorName ?? "annotation";

              let clientId = a?.id ?? (a as any).__clientId;
              if (!clientId) {
                clientId = `temp-${++__tempClientIdCounter}`;
                try {
                  (a as any).__clientId = clientId;
                } catch (e) {}
              }

              out.push({ sdk: a, pageIndex, boundingBox: bbox, type, clientId });
            }
          } catch (err) {}
        }
      } catch (err) {
        console.error("collectAnnotations error:", err);
      }
      return out;
    };

    /**
     * Collect signature form fields from the document
     */
    const collectSignatureFields = async (instance: any): Promise<any[]> => {
      const out: any[] = [];
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        
        const formFields = await instance.getFormFields();
        
        if (!formFields) return out;

        const fieldsArray =
          formFields && typeof formFields.toArray === "function"
            ? formFields.toArray()
            : Array.from(formFields || []);

        for (const field of fieldsArray) {
          try {
            const isSignatureField = 
              field instanceof Nutrient.FormFields?.SignatureFormField ||
              field?.type === "signature" ||
              field?.fieldType === "signature" ||
              (field?.constructor?.name || "").toLowerCase().includes("signature");

            if (isSignatureField) {
              const widgetAnnotations = field.annotationIds 
                ? await Promise.all(
                    field.annotationIds.map(async (id: string) => {
                      try {
                        return await instance.getAnnotation(id);
                      } catch (e) {
                        return null;
                      }
                    })
                  )
                : [];

              const widget = widgetAnnotations.find(w => w != null);
              const pageIndex = widget?.pageIndex ?? field.pageIndex ?? 0;
              const boundingBox = widget?.boundingBox ?? field.boundingBox ?? null;

              const isSigned = field.value != null && field.value !== "";

              out.push({
                id: field.id ?? field.name ?? `sig-${out.length}`,
                sdk: field,
                name: field.name ?? `Signature ${out.length + 1}`,
                pageIndex,
                boundingBox,
                isSigned,
                widget,
              });
            }
          } catch (err) {
            console.warn("Error processing form field:", err);
          }
        }
      } catch (err) {
        console.error("collectSignatureFields error:", err);
      }
      return out;
    };

    const attachAnnotationEvents = (instance: any, refreshFn: () => Promise<void>) => {
      const onCreate = async (created: any) => {
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
      return () => {
        try {
          instance.removeEventListener && instance.removeEventListener("annotations.create", onCreate);
          instance.removeEventListener && instance.removeEventListener("annotations.update", onUpdate);
          instance.removeEventListener && instance.removeEventListener("annotations.delete", onDelete);
        } catch (e) {}
      };
    };

    const attachFormFieldEvents = (instance: any, refreshSignaturesFn: () => Promise<void>) => {
      const onFormFieldChange = async () => {
        await refreshSignaturesFn();
      };
      try {
        instance.addEventListener && instance.addEventListener("formFields.update", onFormFieldChange);
        instance.addEventListener && instance.addEventListener("formFields.create", onFormFieldChange);
      } catch (e) {
        console.warn("Failed to attach form field events:", e);
      }
      return () => {
        try {
          instance.removeEventListener && instance.removeEventListener("formFields.update", onFormFieldChange);
          instance.removeEventListener && instance.removeEventListener("formFields.create", onFormFieldChange);
        } catch (e) {}
      };
    };

    const loadNewDocument = async (arrayBuffer: ArrayBuffer, fileName: string) => {
      const container = containerRef.current;
      if (!container) throw new Error("Viewer container missing");

      const Nutrient = (await import("@nutrient-sdk/viewer")).default;

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

      const wrappers = await collectAnnotations(instance);
      onAnnotationsLoad?.(wrappers);

      const sigFields = await collectSignatureFields(instance);
      onSignatureFieldsLoad?.(sigFields);

      onDocumentLoad?.(fileName);

      attachAnnotationEvents(instance, async () => {
        try {
          const updated = await collectAnnotations(instance);
          onAnnotationsLoad?.(updated);
        } catch (e) {
          console.warn("refresh annotations failed:", e);
        }
      });

      attachFormFieldEvents(instance, async () => {
        try {
          const updated = await collectSignatureFields(instance);
          onSignatureFieldsLoad?.(updated);
        } catch (e) {
          console.warn("refresh signature fields failed:", e);
        }
      });
    };

    useEffect(() => {
      let mounted = true;
      let detachAnnotationsFn: (() => void) | null = null;
      let detachFormFieldsFn: (() => void) | null = null;

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

          const sigFields = await collectSignatureFields(instance);
          onSignatureFieldsLoad?.(sigFields);

          onDocumentLoad?.("nutrient-web-demo.pdf");

          detachAnnotationsFn = attachAnnotationEvents(instance, async () => {
            const updated = await collectAnnotations(instance);
            onAnnotationsLoad?.(updated);
          });

          detachFormFieldsFn = attachFormFieldEvents(instance, async () => {
            const updated = await collectSignatureFields(instance);
            onSignatureFieldsLoad?.(updated);
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
        if (typeof detachAnnotationsFn === "function") detachAnnotationsFn();
        if (typeof detachFormFieldsFn === "function") detachFormFieldsFn();
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

          try {
            instance.setViewState((vs: any) => vs.set("currentPageIndex", pageIndex));
          } catch (e) {
            try {
              if (typeof instance.navigateToPage === "function") instance.navigateToPage(pageIndex);
            } catch (e2) {}
          }

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

      focusSignatureField: async (signatureField: any) => {
        if (!instanceRef.current || !signatureField) return;
        const instance = instanceRef.current;
        try {
          const pageIndex = signatureField.pageIndex ?? 0;

          try {
            instance.setViewState((vs: any) => vs.set("currentPageIndex", pageIndex));
          } catch (e) {
            try {
              if (typeof instance.navigateToPage === "function") instance.navigateToPage(pageIndex);
            } catch (e2) {}
          }

          if (signatureField.boundingBox) {
            try {
              if (typeof instance.ensureVisible === "function") {
                await instance.ensureVisible(signatureField.boundingBox, pageIndex);
              }
            } catch (e) {
              console.warn("Could not scroll to signature field:", e);
            }
          }

          if (signatureField.widget) {
            try {
              if (typeof instance.setSelectedAnnotation === "function") {
                await instance.setSelectedAnnotation(signatureField.widget);
              } else if (typeof instance.select === "function") {
                instance.select(signatureField.widget);
              }
            } catch (e) {
              console.warn("Could not select signature field widget:", e);
            }
          }
        } catch (err) {
          console.error("focusSignatureField error:", err);
        }
      },

      enterDrawMode: async () => {
        if (!instanceRef.current) return;
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          const inkMode = Nutrient?.InteractionMode?.INK;
          if (typeof inkMode !== "undefined") {
            instanceRef.current.setViewState((vs: any) => vs.set("interactionMode", inkMode));
            onModeChange?.("ink");
          } else if (typeof instanceRef.current.activateTool === "function") {
            try { await instanceRef.current.activateTool("ink"); onModeChange?.("ink"); } catch (e) {}
          } else {
            console.warn("Could not set draw mode - InteractionMode.INK not available.");
          }
        } catch (err) {
          console.error("enterDrawMode failed:", err);
        }
      },

      addSignatureField: async () => {
        if (!instanceRef.current) {
          console.error("Viewer instance not available");
          return;
        }

        const instance = instanceRef.current;

        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;

          // Get current page index
          const viewState = instance.viewState;
          const currentPageIndex = viewState?.currentPageIndex ?? 0;

          // Generate unique field name
          const fieldName = `signature_field_${Date.now()}_${__signatureFieldCounter++}`;

          // Create widget annotation (the visual representation of the signature field)
          const widget = new Nutrient.Annotations.WidgetAnnotation({
            id: Nutrient.generateInstantId(),
            pageIndex: currentPageIndex,
            boundingBox: new Nutrient.Geometry.Rect({
              left: 100,
              top: 100,
              width: 200,
              height: 80
            }),
            formFieldName: fieldName,
            borderColor: Nutrient.Color.BLUE,
            borderWidth: 2,
          });

          // Create the signature form field
          const formField = new Nutrient.FormFields.SignatureFormField({
            name: fieldName,
            annotationIds: new Nutrient.Immutable.List([widget.id])
          });

          // Add both the widget and form field to the document
          await instance.create([widget, formField]);

          console.log("Signature field added successfully:", fieldName);

          // The form field events will automatically refresh the signature fields list
        } catch (err) {
          console.error("Failed to add signature field:", err);
          
          // Provide user-friendly error message
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          alert(`Failed to add signature field: ${errorMessage}\n\nPlease ensure:\n- The PDF is loaded\n- You have permission to edit the PDF\n- The Nutrient SDK supports form field creation`);
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