// src/components/PDFViewer.tsx - UNIFIED VERSION
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

interface PDFViewerProps {
  onFormFieldsLoad?: (formFields: any[]) => void;
  onDocumentLoad?: (fileName: string) => void;
  className?: string;
}

export interface PDFViewerHandle {
  loadDocument: (file: File) => Promise<void>;
  loadDocumentFromBase64: (base64Data: string, fileName: string) => Promise<void>;
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

    const collectFormFields = async (instance: any): Promise<any[]> => {
      const fields: any[] = [];
      
      try {
        const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;
        const formFields = await instance.getFormFields();
        
        if (!formFields) return fields;

        const fieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
        const totalPages = instance.totalPageCount ?? 0;

        for (const field of fieldsArray) {
          const isSignatureField = 
            field instanceof NutrientViewer.FormFields?.SignatureFormField ||
            field?.type === "signature" ||
            field?.fieldType === "signature";

          if (isSignatureField) continue;

          let fieldType = "text";
          if (field instanceof NutrientViewer.FormFields?.CheckBoxFormField) {
            fieldType = "checkbox";
          } else if (field instanceof NutrientViewer.FormFields?.RadioButtonFormField) {
            fieldType = "radio";
          } else if (field instanceof NutrientViewer.FormFields?.ComboBoxFormField) {
            fieldType = "combobox";
          } else if (field instanceof NutrientViewer.FormFields?.ListBoxFormField) {
            fieldType = "listbox";
          }

          let widget = null;
          let actualPageIndex = 0;

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const pageAnnotations = await instance.getAnnotations(pageIndex);
            const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);
            
            const foundWidget = annotationsArray.find(
              (ann: any) =>
                ann instanceof NutrientViewer.Annotations.WidgetAnnotation &&
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

    const attachFormFieldEvents = (instance: any, refreshFormFn: () => Promise<void>) => {
      const eventTypes = ["formFields.create", "formFields.update", "formFields.delete"];
      
      const handler = async () => {
        try {
          await refreshFormFn();
        } catch (e) {
          // Silent
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

    const attachFormValueChangeListener = (instance: any) => {
      const formFieldValuesUpdateHandler = (formFieldValues: any) => {
        const valuesArray = formFieldValues?.toArray?.() ?? Array.from(formFieldValues || []);
        
        valuesArray.forEach((fieldValue: any) => {
          const value = fieldValue?.toJS?.() ?? fieldValue;
          console.log("Field:", value.name, "Value:", value.value ?? "(empty)");
        });
      };

      try {
        instance.addEventListener("formFieldValues.update", formFieldValuesUpdateHandler);
      } catch (e) {
        console.error("Failed to attach form value listener:", e);
      }

      return () => {
        try {
          instance.removeEventListener("formFieldValues.update", formFieldValuesUpdateHandler);
        } catch {}
      };
    };

    const loadNewDocument = async (arrayBuffer: ArrayBuffer, fileName: string) => {
      const container = containerRef.current;
      if (!container) throw new Error("Viewer container missing");

      const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;

      if (instanceRef.current) {
        try {
          await NutrientViewer.unload(container);
        } catch (e) {
          console.warn("Error unloading:", e);
        }
        instanceRef.current = null;
      }

      console.log('📄 Loading document locally, size:', arrayBuffer.byteLength);

      const instance = await NutrientViewer.load({
        container,
        document: arrayBuffer,
        baseUrl: `${window.location.protocol}//${window.location.host}/`,
        initialViewState: new NutrientViewer.ViewState({
          formDesignMode: true
        }),
        toolbarItems: [
          ...NutrientViewer.defaultToolbarItems,
          { type: "form-creator" }
        ]
      });

      instanceRef.current = instance;

      const formFields = await collectFormFields(instance);
      onFormFieldsLoad?.(formFields);
      onDocumentLoad?.(fileName);

      attachFormFieldEvents(instance, async () => {
        const updated = await collectFormFields(instance);
        onFormFieldsLoad?.(updated);
      });

      attachFormValueChangeListener(instance);

      console.log('✅ Document loaded successfully');
    };

    useEffect(() => {
      let mounted = true;
      let detachFormFields: (() => void) | null = null;
      let detachFormValues: (() => void) | null = null;

      (async () => {
        const container = containerRef.current;
        if (!container) return;

        try {
          const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;

          try {
            await NutrientViewer.unload(container);
          } catch {}

          const instance = await NutrientViewer.load({
            container,
            document: "https://www.nutrient.io/downloads/nutrient-web-demo.pdf",
            baseUrl: `${window.location.protocol}//${window.location.host}/`,
            initialViewState: new NutrientViewer.ViewState({
              formDesignMode: true
            }),
            toolbarItems: [
              ...NutrientViewer.defaultToolbarItems,
              { type: "form-creator" }
            ]
          });

          if (!mounted) {
            try {
              await NutrientViewer.unload(container);
            } catch {}
            return;
          }

          instanceRef.current = instance;
          setIsInitialized(true);

          const formFields = await collectFormFields(instance);
          onFormFieldsLoad?.(formFields);
          onDocumentLoad?.("nutrient-web-demo.pdf");

          detachFormFields = attachFormFieldEvents(instance, async () => {
            const updated = await collectFormFields(instance);
            onFormFieldsLoad?.(updated);
          });

          detachFormValues = attachFormValueChangeListener(instance);
        } catch (err) {
          console.error("Viewer init failed:", err);
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
            const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;
            await NutrientViewer.unload(c);
          } catch {}
        })();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      loadDocument: async (file: File) => {
        if (!isInitialized) throw new Error("Viewer not ready");
        const buffer = await file.arrayBuffer();
        await loadNewDocument(buffer, file.name);
      },

      loadDocumentFromBase64: async (base64Data: string, fileName: string) => {
        if (!isInitialized) throw new Error("Viewer not ready");
        
        console.log('📦 Converting base64 to ArrayBuffer...');
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;
        
        await loadNewDocument(arrayBuffer, fileName);
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
          const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;
          await NutrientViewer.unload(container);
        } catch (err) {
          console.warn("unloadDocument failed:", err);
        } finally {
          instanceRef.current = null;
        }
      },

      addFormField: async () => {
        if (!instanceRef.current) return;
        const instance = instanceRef.current;

        try {
          const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;

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

          const widget = new NutrientViewer.Annotations.WidgetAnnotation({
            id: NutrientViewer.generateInstantId(),
            pageIndex: currentPageIndex,
            boundingBox: new NutrientViewer.Geometry.Rect({
              left: centerLeft,
              top: centerTop,
              width: fieldWidth,
              height: fieldHeight
            }),
            formFieldName: fieldName,
            borderColor: NutrientViewer.Color.BLACK,
            borderWidth: 1,
            backgroundColor: NutrientViewer.Color.WHITE,
          });

          const formField = new NutrientViewer.FormFields.TextFormField({
            name: fieldName,
            annotationIds: NutrientViewer.Immutable.List([widget.id])
          });

          await instance.create([widget, formField]);
        } catch (err) {
          console.error("Failed to add form field:", err);
        }
      },

      focusFormField: async (formField: any) => {
        if (!instanceRef.current || !formField) return;
        const instance = instanceRef.current;
        
        try {
          const NutrientViewer = (await import("@nutrient-sdk/viewer")).default;
          
          const formFields = await instance.getFormFields();
          const formFieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
          
          const field = formFieldsArray.find((f: any) => f.name === formField.name);
          if (!field) return;

          let widget = null;
          let actualPageIndex = 0;
          const totalPages = instance.totalPageCount ?? 0;

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const pageAnnotations = await instance.getAnnotations(pageIndex);
            const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);
            
            const foundWidget = annotationsArray.find(
              (ann: any) =>
                ann instanceof NutrientViewer.Annotations.WidgetAnnotation &&
                ann.formFieldName === field.name
            );
            
            if (foundWidget) {
              widget = foundWidget;
              actualPageIndex = pageIndex;
              break;
            }
          }

          if (!widget) return;

          instance.setViewState((vs: any) => vs.set("currentPageIndex", actualPageIndex));
          await new Promise(resolve => setTimeout(resolve, 300));

          if (widget.boundingBox) {
            try {
              const rect = new NutrientViewer.Geometry.Rect(widget.boundingBox);
              
              if (typeof instance.ensureVisible === "function") {
                await instance.ensureVisible(rect, actualPageIndex, { 
                  position: 'center',
                  padding: 50 
                });
              }
            } catch (e) {
              console.warn("Could not center:", e);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          if (typeof instance.setSelectedAnnotation === "function") {
            await instance.setSelectedAnnotation(widget);
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

          if (formField.sdk?.name) {
            const totalPages = instance.totalPageCount ?? 0;
            
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
              try {
                const pageAnnotations = await instance.getAnnotations(pageIndex);
                const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);
                
                for (const annotation of annotationsArray) {
                  if (annotation.formFieldName === formField.sdk.name) {
                    await instance.delete(annotation);
                  }
                }
              } catch (e) {
                console.warn(`Failed to delete annotations on page ${pageIndex}:`, e);
              }
            }
          }

          if (formField.sdk) {
            await instance.delete(formField.sdk);
          }

          console.log("✅ Form field deleted successfully");
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