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
  addSignatureField: () => Promise<void>;
  deleteSignatureField: (signatureField: any) => Promise<void>;
}

let __tempClientIdCounter = 1;
let __signatureFieldCounter = 1;

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
     * Collect signature form fields from the document - FIXED VERSION
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
              // FIXED: Find the widget annotation to get the ACTUAL page index
              let widget = null;
              let actualPageIndex = 0;
              
              const totalPages = instance.totalPageCount ?? 0;
              for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                const pageAnnotations = await instance.getAnnotations(pageIndex);
                const pageAnnotationsArray = pageAnnotations && typeof pageAnnotations.toArray === "function"
                  ? pageAnnotations.toArray()
                  : Array.from(pageAnnotations || []);
                
                const foundWidget = pageAnnotationsArray.find(
                  (annotation: any) =>
                    annotation instanceof Nutrient.Annotations.WidgetAnnotation &&
                    annotation.formFieldName === field.name
                );
                
                if (foundWidget) {
                  widget = foundWidget;
                  actualPageIndex = pageIndex;
                  break;
                }
              }

              const boundingBox = widget?.boundingBox ?? null;
              const isSigned = field.value != null && field.value !== "";

              out.push({
                id: field.id ?? field.name ?? `sig-${out.length}`,
                sdk: field,
                name: field.name ?? `Signature ${out.length + 1}`,
                pageIndex: actualPageIndex, // FIXED: Use the actual page index from the widget
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
        instance.addEventListener && instance.addEventListener("formFields.delete", onFormFieldChange);
      } catch (e) {
        console.warn("Failed to attach form field events:", e);
      }
      return () => {
        try {
          instance.removeEventListener && instance.removeEventListener("formFields.update", onFormFieldChange);
          instance.removeEventListener && instance.removeEventListener("formFields.create", onFormFieldChange);
          instance.removeEventListener && instance.removeEventListener("formFields.delete", onFormFieldChange);
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

      // Enable form design mode on initialization
      const instance = await Nutrient.load({
        container,
        document: arrayBuffer,
        baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.PUBLIC_URL ?? ""}`,
        initialViewState: new Nutrient.ViewState({
          formDesignMode: true
        })
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
            initialViewState: new Nutrient.ViewState({
              formDesignMode: true
            })
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

          await new Promise(resolve => setTimeout(resolve, 100));

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

      // FIXED: Navigate to signature field and center it in view
      focusSignatureField: async (signatureField: any) => {
        if (!instanceRef.current || !signatureField) return;
        const instance = instanceRef.current;
        
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          
          // Get the form field from the instance
          const formFields = await instance.getFormFields();
          const formFieldsArray = formFields && typeof formFields.toArray === "function"
            ? formFields.toArray()
            : Array.from(formFields || []);
          
          const field = formFieldsArray.find(
            (formField: any) =>
              formField.name === signatureField.name &&
              formField instanceof Nutrient.FormFields.SignatureFormField
          );

          if (!field) {
            console.warn("Signature field not found:", signatureField.name);
            return;
          }

          // Find the widget annotation for this field by searching all pages
          let widget = null;
          let actualPageIndex = 0;

          const totalPages = instance.totalPageCount ?? 0;
          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const pageAnnotations = await instance.getAnnotations(pageIndex);
            const pageAnnotationsArray = pageAnnotations && typeof pageAnnotations.toArray === "function"
              ? pageAnnotations.toArray()
              : Array.from(pageAnnotations || []);
            
            const foundWidget = pageAnnotationsArray.find(
              (annotation: any) =>
                annotation instanceof Nutrient.Annotations.WidgetAnnotation &&
                annotation.formFieldName === field.name
            );
            
            if (foundWidget) {
              widget = foundWidget;
              actualPageIndex = pageIndex;
              break;
            }
          }

          if (!widget) {
            console.warn("Widget not found for signature field:", signatureField.name);
            return;
          }

          console.log(`Navigating to signature field "${field.name}" on page ${actualPageIndex + 1}`);

          // Navigate to the correct page
          instance.setViewState((vs: any) => 
            vs.set("currentPageIndex", actualPageIndex)
          );

          // Wait for page to render
          await new Promise(resolve => setTimeout(resolve, 300));

          // Center the signature field in the viewport
          if (widget.boundingBox) {
            try {
              const rect = new Nutrient.Geometry.Rect(widget.boundingBox);
              
              // Use ensureVisible with center option for better centering
              if (typeof instance.ensureVisible === "function") {
                await instance.ensureVisible(rect, actualPageIndex, { 
                  position: 'center',
                  padding: 50 
                });
              } else if (typeof instance.jumpToRect === "function") {
                await instance.jumpToRect(actualPageIndex, widget.boundingBox);
              } else if (typeof instance.scrollToRect === "function") {
                await instance.scrollToRect(widget.boundingBox, actualPageIndex);
              }
            } catch (e) {
              console.warn("Could not center signature field:", e);
            }
          }

          console.log("Signature field is now centered in the viewer");

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

          // Enable form design mode to allow dragging and resizing
          instance.setViewState((viewState: any) =>
            viewState.set("formDesignMode", true)
          );

          const viewState = instance.viewState;
          const currentPageIndex = viewState?.currentPageIndex ?? 0;

          // Get the page dimensions to center the field
          const pageInfo = instance.pageInfoForIndex(currentPageIndex);
          const pageWidth = pageInfo?.width ?? 612;
          const pageHeight = pageInfo?.height ?? 792;

          // Calculate center position
          const fieldWidth = 200;
          const fieldHeight = 80;
          const centerLeft = (pageWidth - fieldWidth) / 2;
          const centerTop = (pageHeight - fieldHeight) / 2;

          const fieldName = `signature_field_${Date.now()}_${__signatureFieldCounter++}`;

          const widget = new Nutrient.Annotations.WidgetAnnotation({
            id: Nutrient.generateInstantId(),
            pageIndex: currentPageIndex,
            boundingBox: new Nutrient.Geometry.Rect({
              left: centerLeft,
              top: centerTop,
              width: fieldWidth,
              height: fieldHeight
            }),
            formFieldName: fieldName,
            borderColor: Nutrient.Color.BLUE,
            borderWidth: 2,
          });

          const formField = new Nutrient.FormFields.SignatureFormField({
            name: fieldName,
            annotationIds: Nutrient.Immutable.List([widget.id])
          });

          await instance.create([widget, formField]);

          console.log(`Signature field "${fieldName}" added at center of page ${currentPageIndex + 1}`);

          // Wait for the field to be created
          await new Promise(resolve => setTimeout(resolve, 100));

          // Center the viewport on the newly created field
          const rect = new Nutrient.Geometry.Rect({
            left: centerLeft,
            top: centerTop,
            width: fieldWidth,
            height: fieldHeight
          });

          try {
            if (typeof instance.jumpToRect === "function") {
              await instance.jumpToRect(currentPageIndex, rect);
            } else if (typeof instance.ensureVisible === "function") {
              await instance.ensureVisible(rect, currentPageIndex, {
                position: 'center',
                padding: 50
              });
            }
          } catch (e) {
            console.warn("Could not center viewport on new field:", e);
          }

        } catch (err) {
          console.error("Failed to add signature field:", err);
          
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          alert(`Failed to add signature field: ${errorMessage}\n\nPlease ensure:\n- The PDF is loaded\n- You have permission to edit the PDF\n- The Nutrient SDK supports form field creation`);
        }
      },

      deleteSignatureField: async (signatureField: any) => {
        if (!instanceRef.current || !signatureField) {
          console.warn("Cannot delete: viewer instance or signature field not available");
          return;
        }

        const instance = instanceRef.current;

        try {
          // Delete the widget annotation(s) first
          if (signatureField.widget) {
            try {
              await instance.delete(signatureField.widget);
            } catch (e) {
              console.warn("Failed to delete widget annotation:", e);
            }
          }

          // If there are multiple widget annotations linked to this field, delete them all
          if (signatureField.sdk?.annotationIds) {
            const annotationIds = signatureField.sdk.annotationIds.toArray 
              ? signatureField.sdk.annotationIds.toArray() 
              : Array.from(signatureField.sdk.annotationIds || []);

            for (const annotationId of annotationIds) {
              try {
                const annotation = await instance.getAnnotation(annotationId);
                if (annotation) {
                  await instance.delete(annotation);
                }
              } catch (e) {
                console.warn(`Failed to delete annotation ${annotationId}:`, e);
              }
            }
          }

          // Delete the form field itself
          try {
            await instance.delete(signatureField.sdk);
          } catch (e) {
            console.warn("Failed to delete form field:", e);
          }

          console.log("Signature field deleted successfully");
        } catch (err) {
          console.error("Failed to delete signature field:", err);
          throw err;
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