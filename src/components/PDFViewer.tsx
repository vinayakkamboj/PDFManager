// PDFViewer.tsx - Clean Console Logging (Field, Value, Type only)
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

interface PDFViewerProps {
  onFormFieldsLoad?: (formFields: any[]) => void;
  onDocumentLoad?: (fileName: string) => void;
  className?: string;
}

export interface PDFViewerHandle {
  loadDocument: (file: File) => Promise<void>;
  navigateToPage: (pageIndex: number) => void;
  getInstance: () => any;
  unloadDocument: () => Promise<void>;
  focusFormField: (formField: any) => Promise<void>;
  addFormField: () => Promise<void>;
  deleteFormField: (formField: any) => Promise<void>;
}

let __formFieldCounter = 1;

const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(
  ({ onFormFieldsLoad, onDocumentLoad, className = "" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    /**
     * Activate Form Creator Mode
     */
    const activateFormCreatorMode = async (instance: any) => {
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        
        instance.setViewState((viewState: any) => 
          viewState.set("interactionMode", Nutrient.InteractionMode.FORM_CREATOR)
        );
        
        return true;
      } catch (err) {
        console.error("Failed to activate Form Creator mode:", err);
        return false;
      }
    };

    /**
     * Deactivate Form Creator Mode
     */
    const deactivateFormCreatorMode = async (instance: any) => {
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        
        instance.setViewState((viewState: any) => 
          viewState.set("interactionMode", null)
        );
        
        return true;
      } catch (err) {
        return false;
      }
    };

    /**
     * Collect all form fields from the document
     */
    const collectFormFields = async (instance: any): Promise<any[]> => {
      const fields: any[] = [];
      
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        const formFields = await instance.getFormFields();
        
        if (!formFields) return fields;

        const fieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
        const totalPages = instance.totalPageCount ?? 0;

        for (const field of fieldsArray) {
          const isSignatureField = 
            field instanceof Nutrient.FormFields?.SignatureFormField ||
            field?.type === "signature" ||
            field?.fieldType === "signature" ||
            (field?.constructor?.name || "").toLowerCase().includes("signature");

          if (isSignatureField) continue;

          let fieldType = "text";
          if (field instanceof Nutrient.FormFields?.CheckBoxFormField) {
            fieldType = "checkbox";
          } else if (field instanceof Nutrient.FormFields?.RadioButtonFormField) {
            fieldType = "radio";
          } else if (field instanceof Nutrient.FormFields?.ComboBoxFormField) {
            fieldType = "combobox";
          } else if (field instanceof Nutrient.FormFields?.ListBoxFormField) {
            fieldType = "listbox";
          } else if (field instanceof Nutrient.FormFields?.TextFormField) {
            fieldType = "text";
          }

          let widget = null;
          let actualPageIndex = 0;

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const pageAnnotations = await instance.getAnnotations(pageIndex);
            const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);
            
            const foundWidget = annotationsArray.find(
              (ann: any) =>
                ann instanceof Nutrient.Annotations.WidgetAnnotation &&
                ann.formFieldName === field.name
            );
            
            if (foundWidget) {
              widget = foundWidget;
              actualPageIndex = pageIndex;
              break;
            }
          }

          fields.push({
            id: field.id ?? field.name ?? `form-${fields.length}`,
            sdk: field,
            name: field.name ?? `Field ${fields.length + 1}`,
            type: fieldType,
            pageIndex: actualPageIndex,
            boundingBox: widget?.boundingBox ?? null,
            value: field.value ?? "",
            widget,
          });
        }
      } catch (err) {
        console.error("collectFormFields error:", err);
      }
      
      return fields;
    };

    /**
     * Attach event listeners for form field changes
     */
    const attachFormFieldEvents = (instance: any, refreshFormFn: () => Promise<void>) => {
      const eventTypes = ["formFields.create", "formFields.update", "formFields.delete"];
      
      const handler = async () => {
        try {
          await refreshFormFn();
        } catch (e) {
          // console.warn("Refresh form fields failed:", e);
        }
      };

      eventTypes.forEach(eventType => {
        try {
          instance.addEventListener?.(eventType, handler);
        } catch (e) {
          console.warn(`Failed to attach ${eventType}:`, e);
        }
      });

      return () => {
        eventTypes.forEach(eventType => {
          try {
            instance.removeEventListener?.(eventType, handler);
          } catch {}
        });
      };
    };

    /**
     * CLEAN CONSOLE LOGGING - Only Field, Input Value, Type
     */
    const attachFormValueChangeListener = (instance: any) => {
      const formFieldValuesUpdateHandler = (formFieldValues: any) => {
        const valuesArray = formFieldValues?.toArray?.() ?? Array.from(formFieldValues || []);
        
        valuesArray.forEach((fieldValue: any) => {
          const value = fieldValue?.toJS?.() ?? fieldValue;
          
          console.log("Field:", value.name);
          console.log("Input Value:", value.value ?? "(empty)");
          console.log("Type:", value.type ?? "unknown");
        });
      };

      try {
        instance.addEventListener("formFieldValues.update", formFieldValuesUpdateHandler);
        // console.log("✅ Real-time form value listener attached!");
      } catch (e) {
        console.error("Failed to attach formFieldValues.update listener:", e);
      }

      return () => {
        try {
          instance.removeEventListener("formFieldValues.update", formFieldValuesUpdateHandler);
        } catch {}
      };
    };

    /**
     * Load a new PDF document
     */
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
        baseUrl: `${window.location.protocol}//${window.location.host}/`,
        initialViewState: new Nutrient.ViewState({
          formDesignMode: true
        }),
        toolbarItems: [
          ...Nutrient.defaultToolbarItems,
          { type: "form-creator" }
        ]
      });

      instanceRef.current = instance;

      const formFields = await collectFormFields(instance);
      onFormFieldsLoad?.(formFields);
      onDocumentLoad?.(fileName);

      attachFormFieldEvents(
        instance,
        async () => {
          const updated = await collectFormFields(instance);
          onFormFieldsLoad?.(updated);
        }
      );

      attachFormValueChangeListener(instance);
    };

    /**
     * Initialize viewer on mount
     */
    useEffect(() => {
      let mounted = true;
      let detachFormFields: (() => void) | null = null;
      let detachFormValues: (() => void) | null = null;

      (async () => {
        const container = containerRef.current;
        if (!container) return;

        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;

          try {
            await Nutrient.unload(container);
          } catch {}

          const instance = await Nutrient.load({
            container,
            document: "https://www.nutrient.io/downloads/nutrient-web-demo.pdf",
            baseUrl: `${window.location.protocol}//${window.location.host}/`,
            initialViewState: new Nutrient.ViewState({
              formDesignMode: true
            }),
            toolbarItems: [
              ...Nutrient.defaultToolbarItems,
              { type: "form-creator" }
            ]
          });

          if (!mounted) {
            try {
              await Nutrient.unload(container);
            } catch {}
            return;
          }

          instanceRef.current = instance;
          setIsInitialized(true);

          const formFields = await collectFormFields(instance);
          onFormFieldsLoad?.(formFields);
          onDocumentLoad?.("nutrient-web-demo.pdf");

          detachFormFields = attachFormFieldEvents(
            instance,
            async () => {
              const updated = await collectFormFields(instance);
              onFormFieldsLoad?.(updated);
            }
          );

          detachFormValues = attachFormValueChangeListener(instance);

          // console.log("✅ PDF Viewer initialized with real-time logging");
        } catch (err) {
          console.error("Viewer initialization failed:", err);
        }
      })();

      return () => {
        mounted = false;
        detachFormFields?.();
        detachFormValues?.();
        
        (async () => {
          const c = containerRef.current;
          if (!c) return;
          try {
            const Nutrient = (await import("@nutrient-sdk/viewer")).default;
            await Nutrient.unload(c);
          } catch {}
        })();
      };
    }, []);

    /**
     * Expose methods via ref
     */
    useImperativeHandle(ref, () => ({
      loadDocument: async (file: File) => {
        if (!isInitialized) throw new Error("Viewer not ready");
        const buffer = await file.arrayBuffer();
        await loadNewDocument(buffer, file.name);
      },

      navigateToPage: (pageIndex: number) => {
        if (!instanceRef.current) return;
        try {
          instanceRef.current.setViewState((vs: any) => vs.set("currentPageIndex", pageIndex));
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

      addFormField: async () => {
        if (!instanceRef.current) {
          console.error("Viewer instance not available");
          return;
        }

        const instance = instanceRef.current;

        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;

          await activateFormCreatorMode(instance);

          const viewState = instance.viewState;
          const currentPageIndex = viewState?.currentPageIndex ?? 0;

          const pageInfo = instance.pageInfoForIndex(currentPageIndex);
          const pageWidth = pageInfo?.width ?? 612;
          const pageHeight = pageInfo?.height ?? 792;

          const fieldWidth = 200;
          const fieldHeight = 40;
          const centerLeft = (pageWidth - fieldWidth) / 2;
          const centerTop = (pageHeight - fieldHeight) / 2;

          const fieldName = `text_field_${Date.now()}_${__formFieldCounter++}`;

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
            borderColor: Nutrient.Color.BLACK,
            borderWidth: 1,
            backgroundColor: Nutrient.Color.WHITE,
          });

          const formField = new Nutrient.FormFields.TextFormField({
            name: fieldName,
            annotationIds: Nutrient.Immutable.List([widget.id])
          });

          await instance.create([widget, formField]);

          console.log(`Text field "${fieldName}" added`);

          await new Promise(resolve => setTimeout(resolve, 100));

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

          await new Promise(resolve => setTimeout(resolve, 200));

          if (typeof instance.setSelectedAnnotation === "function") {
            await instance.setSelectedAnnotation(widget);
          } else if (typeof instance.select === "function") {
            instance.select(widget);
          }

          setTimeout(() => deactivateFormCreatorMode(instance), 500);
        } catch (err) {
          console.error("Failed to add form field:", err);
          alert(`Failed to add form field: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      },

      focusFormField: async (formField: any) => {
        if (!instanceRef.current || !formField) return;
        const instance = instanceRef.current;
        
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          
          const formFields = await instance.getFormFields();
          const formFieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
          
          const field = formFieldsArray.find((f: any) => f.name === formField.name);

          if (!field) {
            console.warn("Form field not found:", formField.name);
            return;
          }

          let widget = null;
          let actualPageIndex = 0;
          const totalPages = instance.totalPageCount ?? 0;

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const pageAnnotations = await instance.getAnnotations(pageIndex);
            const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);
            
            const foundWidget = annotationsArray.find(
              (ann: any) =>
                ann instanceof Nutrient.Annotations.WidgetAnnotation &&
                ann.formFieldName === field.name
            );
            
            if (foundWidget) {
              widget = foundWidget;
              actualPageIndex = pageIndex;
              break;
            }
          }

          if (!widget) {
            console.warn("Widget not found for form field:", formField.name);
            return;
          }

          instance.setViewState((vs: any) => vs.set("currentPageIndex", actualPageIndex));
          await new Promise(resolve => setTimeout(resolve, 300));

          if (widget.boundingBox) {
            try {
              const rect = new Nutrient.Geometry.Rect(widget.boundingBox);
              
              if (typeof instance.ensureVisible === "function") {
                await instance.ensureVisible(rect, actualPageIndex, { 
                  position: 'center',
                  padding: 50 
                });
              } else if (typeof instance.jumpToRect === "function") {
                await instance.jumpToRect(actualPageIndex, widget.boundingBox);
              }
            } catch (e) {
              console.warn("Could not center form field:", e);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          if (typeof instance.setSelectedAnnotation === "function") {
            await instance.setSelectedAnnotation(widget);
          } else if (typeof instance.select === "function") {
            instance.select(widget);
          }
        } catch (err) {
          console.error("focusFormField error:", err);
        }
      },

      deleteFormField: async (formField: any) => {
        if (!instanceRef.current || !formField) {
          console.warn("Cannot delete: viewer instance or form field not available");
          return;
        }

        const instance = instanceRef.current;

        try {
          if (formField.widget) {
            await instance.delete(formField.widget);
          }

          if (formField.sdk?.annotationIds) {
            const annotationIds = formField.sdk.annotationIds?.toArray?.() ?? 
                                  Array.from(formField.sdk.annotationIds || []);

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

          await instance.delete(formField.sdk);

          console.log("Form field deleted successfully");
        } catch (err) {
          console.error("Failed to delete form field:", err);
          throw err;
        }
      },
    }));

    return (
      <div
        ref={containerRef}
        className={`h-full w-full ${className}`}
        style={{ height: "100%", minHeight: "500px", position: "relative" }}
      />
    );
  }
);

PDFViewer.displayName = "PDFViewer";

export default PDFViewer;