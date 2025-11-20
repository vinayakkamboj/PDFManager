// PDFViewer.tsx - Enhanced version with Sign Here overlay and double-click support
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

interface PDFViewerProps {
  onAnnotationsLoad?: (annotations: any[]) => void;
  onSignatureFieldsLoad?: (signatureFields: any[]) => void;
  onDocumentLoad?: (fileName: string) => void;
  onSignatureFieldFocus?: (signatureField: any, fieldIndex: number) => void;
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
  ({ onAnnotationsLoad, onSignatureFieldsLoad, onDocumentLoad, onSignatureFieldFocus, className = "", onModeChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const overlayItemIdRef = useRef<string | null>(null);
    const [currentFocusedField, setCurrentFocusedField] = useState<any>(null);
    const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Detect background color at signature field position to determine theme
     */
    const detectBackgroundColor = async (instance: any, signatureField: any): Promise<'light' | 'dark'> => {
      try {
        if (!signatureField || !signatureField.boundingBox) {
          return 'light'; // Default to light
        }

        const pageIndex = signatureField.pageIndex;
        const bbox = signatureField.boundingBox;

        // Get canvas element for the page
        const pageElement = instance.contentDocument?.querySelector(
          `[data-page-index="${pageIndex}"]`
        );

        if (!pageElement) {
          return 'light';
        }

        // Find canvas within the page element
        const canvas = pageElement.querySelector('canvas');
        if (!canvas) {
          return 'light';
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return 'light';
        }

        // Get page dimensions and scale
        const pageInfo = instance.pageInfoForIndex(pageIndex);
        const scale = canvas.width / (pageInfo?.width ?? 612);

        // Sample point near the signature field (left side where overlay appears)
        const sampleX = Math.max(0, Math.floor((bbox.left - 100) * scale));
        const sampleY = Math.floor((bbox.top + bbox.height / 2) * scale);

        // Sample a small area (5x5 pixels) to get average color
        const sampleSize = 5;
        const imageData = ctx.getImageData(
          Math.max(0, sampleX - sampleSize / 2),
          Math.max(0, sampleY - sampleSize / 2),
          sampleSize,
          sampleSize
        );

        let totalBrightness = 0;
        let pixelCount = 0;

        // Calculate average brightness
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          // Only consider opaque pixels
          if (a > 200) {
            // Calculate relative luminance
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
            totalBrightness += brightness;
            pixelCount++;
          }
        }

        if (pixelCount === 0) {
          return 'light';
        }

        const avgBrightness = totalBrightness / pixelCount;

        // If average brightness is less than 128 (middle), it's a dark background
        return avgBrightness < 128 ? 'dark' : 'light';
      } catch (err) {
        console.warn("Failed to detect background color:", err);
        return 'light'; // Default to light on error
      }
    };
    /**
     * Create and display "Sign Here" overlay using Nutrient's CustomOverlayItem API
     */
    const showSignHereOverlay = async (instance: any, signatureField: any) => {
      try {
        if (!signatureField || signatureField.isSigned || !signatureField.boundingBox) {
          await removeSignHereOverlay(instance);
          return;
        }

        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        const bbox = signatureField.boundingBox;
        const pageIndex = signatureField.pageIndex;

        // Detect background color theme
        const theme = await detectBackgroundColor(instance, signatureField);
        const textColor = theme === 'dark' ? '#ffffff' : '#1f2937';
        const arrowColor1 = theme === 'dark' ? '#e5e7eb' : '#6b7280';
        const arrowColor2 = theme === 'dark' ? '#ffffff' : '#374151';

        // Create the "Sign Here" indicator DOM element
        const overlayNode = document.createElement("div");
        overlayNode.className = "sign-here-overlay";
        overlayNode.setAttribute('data-theme', theme);
        overlayNode.style.cssText = `
          display: flex;
          align-items: center;
          gap: 12px;
          pointer-events: none;
        `;

        overlayNode.innerHTML = `
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
            
            @keyframes subtleWave {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-2px) rotate(1deg); }
            }
            
            .sign-here-text {
              font-family: 'Caveat', cursive;
              font-weight: 700;
              font-size: 32px;
              color: ${textColor};
              white-space: nowrap;
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
              letter-spacing: 0.5px;
              transition: color 2.5s ease-in-out;
            }
            
            .sign-here-overlay:hover .sign-here-text,
            .sign-here-overlay.waving .sign-here-text {
              animation: subtleWave 1s ease-in-out;
            }
            
            .arrow-svg {
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
              transition: opacity 2.5s ease-in-out;
            }
          </style>
          <div class="sign-here-text">
            Sign Here
          </div>
          <svg class="arrow-svg" width="50" height="24" viewBox="0 0 50 24">
            <defs>
              <linearGradient id="arrowGradient-${Date.now()}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${arrowColor1};stop-opacity:1">
                  <animate attributeName="stop-color" values="${arrowColor1};${arrowColor1}" dur="2.5s" fill="freeze" />
                </stop>
                <stop offset="100%" style="stop-color:${arrowColor2};stop-opacity:1">
                  <animate attributeName="stop-color" values="${arrowColor2};${arrowColor2}" dur="2.5s" fill="freeze" />
                </stop>
              </linearGradient>
            </defs>
            <path
              d="M 0 12 L 38 12 L 32 6 M 38 12 L 32 18"
              stroke="url(#arrowGradient-${Date.now()})"
              stroke-width="3.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        `;

        // Position the overlay to the left of the signature field
        const overlayX = bbox.left - 170; // 170px to the left of the field
        const overlayY = bbox.top + (bbox.height / 2) - 20; // Vertically centered

        const overlayId = `sign-here-${signatureField.id || Date.now()}`;
        const overlayItem = new Nutrient.CustomOverlayItem({
          id: overlayId,
          node: overlayNode,
          pageIndex: pageIndex,
          position: new Nutrient.Geometry.Point({
            x: Math.max(10, overlayX), // Ensure it doesn't go off-screen
            y: Math.max(10, overlayY)
          })
        });

        // Remove any existing overlay first
        if (overlayItemIdRef.current) {
          try {
            await instance.removeCustomOverlayItem(overlayItemIdRef.current);
          } catch (e) {
            // Ignore errors if overlay doesn't exist
          }
        }

        // Add the new overlay
        await instance.setCustomOverlayItem(overlayItem);
        overlayItemIdRef.current = overlayId;

        console.log(`Sign Here overlay created with ${theme} theme at position:`, overlayX, overlayY);
      } catch (err) {
        console.warn("Failed to show sign here overlay:", err);
      }
    };

    /**
     * Remove the "Sign Here" overlay and clear tracking interval
     */
    const removeSignHereOverlay = async (instance: any) => {
      try {
        // Clear position tracking interval
        if (positionUpdateIntervalRef.current) {
          clearInterval(positionUpdateIntervalRef.current);
          positionUpdateIntervalRef.current = null;
        }

        if (overlayItemIdRef.current && instance) {
          await instance.removeCustomOverlayItem(overlayItemIdRef.current);
          overlayItemIdRef.current = null;
        }
      } catch (e) {
        // Ignore errors if overlay doesn't exist
      }
    };

    /**
     * Start tracking signature field position and update overlay periodically
     */
    const startPositionTracking = async (instance: any, signatureField: any) => {
      // Clear any existing interval
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
      }

      // Update position every 2 seconds
      positionUpdateIntervalRef.current = setInterval(async () => {
        try {
          if (!currentFocusedField) {
            // No field is focused, stop tracking
            if (positionUpdateIntervalRef.current) {
              clearInterval(positionUpdateIntervalRef.current);
              positionUpdateIntervalRef.current = null;
            }
            return;
          }

          // Get updated signature fields
          const updatedFields = await collectSignatureFields(instance);
          const updatedField = updatedFields.find(f => f.name === currentFocusedField.name);

          if (updatedField && !updatedField.isSigned) {
            // Check if position or theme changed
            const oldBbox = currentFocusedField.boundingBox;
            const newBbox = updatedField.boundingBox;

            if (!oldBbox || !newBbox) return;

            const positionChanged = 
              oldBbox.left !== newBbox.left || 
              oldBbox.top !== newBbox.top ||
              oldBbox.width !== newBbox.width ||
              oldBbox.height !== newBbox.height;

            // Always update to check for theme changes
            setCurrentFocusedField(updatedField);
            await showSignHereOverlay(instance, updatedField);

            if (positionChanged) {
              console.log("Signature field position updated, overlay repositioned");
            }
          } else if (!updatedField) {
            // Field was deleted, stop tracking
            await removeSignHereOverlay(instance);
            setCurrentFocusedField(null);
          }
        } catch (err) {
          console.warn("Position tracking update failed:", err);
        }
      }, 2000); // Update every 2 seconds
    };
    const collectAnnotations = async (instance: any): Promise<any[]> => {
      const annotations: any[] = [];
      
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
          const pageAnnotations = await instance.getAnnotations(pageIndex);
          const annotationsArray = pageAnnotations?.toArray?.() ?? Array.from(pageAnnotations || []);

          for (const annotation of annotationsArray) {
            if (!annotation) continue;

            const isAllowed = allowedTypes.length === 0 || allowedTypes.some(Type => {
              try {
                return Type && annotation instanceof Type;
              } catch {
                return false;
              }
            });

            if (!isAllowed) {
              const name = (annotation.constructor?.name ?? "") + " " + (annotation.type ?? annotation.subtype ?? "");
              const isAllowedName = ["ink", "highlight", "text", "note", "image", "shape", "stamp"]
                .some(n => name.toLowerCase().includes(n));
              
              if (!isAllowedName) continue;
            }

            const bbox = annotation.boundingBox ?? annotation.rects?.[0];
            const hasText = !!(annotation.text || annotation.note || annotation.subject);
            const hasGeometry = !!bbox;

            if (!hasText && !hasGeometry) continue;

            let clientId = annotation.id ?? (annotation as any).__clientId;
            if (!clientId) {
              clientId = `temp-${++__tempClientIdCounter}`;
              try {
                (annotation as any).__clientId = clientId;
              } catch {}
            }

            annotations.push({
              sdk: annotation,
              pageIndex,
              boundingBox: bbox,
              type: annotation.type ?? annotation.subtype ?? annotation.constructor?.name ?? "annotation",
              clientId
            });
          }
        }
      } catch (err) {
        console.error("collectAnnotations error:", err);
      }
      
      return annotations;
    };

    /**
     * Collect signature form fields with proper page detection
     */
    const collectSignatureFields = async (instance: any): Promise<any[]> => {
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

          if (!isSignatureField) continue;

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
            id: field.id ?? field.name ?? `sig-${fields.length}`,
            sdk: field,
            name: field.name ?? `Signature ${fields.length + 1}`,
            pageIndex: actualPageIndex,
            boundingBox: widget?.boundingBox ?? null,
            isSigned: field.value != null && field.value !== "",
            widget,
          });
        }
      } catch (err) {
        console.error("collectSignatureFields error:", err);
      }
      
      return fields;
    };

    /**
     * Attach event listeners for annotation changes
     */
    const attachAnnotationEvents = (instance: any, refreshFn: () => Promise<void>) => {
      const eventTypes = ["annotations.create", "annotations.update", "annotations.delete"];
      const handler = async () => {
        try {
          await refreshFn();
        } catch (e) {
          console.warn("Refresh annotations failed:", e);
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
     * Attach event listeners for form field changes and widget updates
     */
    const attachFormFieldEvents = (instance: any, refreshFn: () => Promise<void>) => {
      const eventTypes = ["formFields.create", "formFields.update", "formFields.delete", "annotations.update"];
      let isDragging = false;
      let dragTimeout: NodeJS.Timeout | null = null;
      
      const handler = async (event?: any) => {
        try {
          await refreshFn();
          
          // Handle widget drag and update overlay position
          if (currentFocusedField && event?.type === "annotations.update") {
            const updatedFields = await collectSignatureFields(instance);
            const updatedField = updatedFields.find(f => f.name === currentFocusedField.name);
            
            if (updatedField) {
              // Check if widget position changed (being dragged)
              const oldBbox = currentFocusedField.boundingBox;
              const newBbox = updatedField.boundingBox;
              
              if (oldBbox && newBbox) {
                const positionChanged = 
                  oldBbox.left !== newBbox.left || 
                  oldBbox.top !== newBbox.top;
                
                if (positionChanged) {
                  // Widget is being dragged
                  isDragging = true;
                  
                  // Clear any existing timeout
                  if (dragTimeout) {
                    clearTimeout(dragTimeout);
                  }
                  
                  // Update overlay position immediately during drag
                  setCurrentFocusedField(updatedField);
                  await showSignHereOverlay(instance, updatedField);
                  
                  // Set timeout to trigger wave animation after drag stops
                  dragTimeout = setTimeout(async () => {
                    isDragging = false;
                    // Trigger wave animation by temporarily adding class
                    const overlayElements = instance.contentDocument?.querySelectorAll('.sign-here-overlay');
                    if (overlayElements) {
                      overlayElements.forEach((el: HTMLElement) => {
                        el.classList.add('waving');
                        setTimeout(() => {
                          el.classList.remove('waving');
                        }, 1000);
                      });
                    }
                  }, 300); // Wait 300ms after last update to consider drag stopped
                }
              }
            }
          }
        } catch (e) {
          console.warn("Refresh signature fields failed:", e);
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
        if (dragTimeout) {
          clearTimeout(dragTimeout);
        }
        eventTypes.forEach(eventType => {
          try {
            instance.removeEventListener?.(eventType, handler);
          } catch {}
        });
      };
    };

    /**
     * Setup click handler for signature fields to show overlay
     */
    const setupSignatureFieldClickHandler = async (instance: any) => {
      try {
        const Nutrient = (await import("@nutrient-sdk/viewer")).default;
        
        // Listen for annotations.press events on widgets
        instance.addEventListener("annotations.press", async (event: any) => {
          if (event.annotation instanceof Nutrient.Annotations.WidgetAnnotation) {
            const formFieldName = event.annotation.formFieldName;
            
            // Check if this is a signature field
            const formFields = await instance.getFormFields();
            const fieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
            const formField = fieldsArray.find((f: any) => f.name === formFieldName);
            
            if (formField instanceof Nutrient.FormFields.SignatureFormField) {
              console.log("Signature field clicked:", formFieldName);
              
              // Get the full signature field data with widget and bounding box
              const signatureFields = await collectSignatureFields(instance);
              const clickedField = signatureFields.find(f => f.name === formFieldName);
              
              if (clickedField && !clickedField.isSigned) {
                // Update the focused field and show overlay
                setCurrentFocusedField(clickedField);
                await showSignHereOverlay(instance, clickedField);
                
                // Start position tracking
                await startPositionTracking(instance, clickedField);
                
                // Notify parent component about the clicked field
                const fieldIndex = signatureFields.findIndex(f => f.name === formFieldName);
                if (fieldIndex !== -1) {
                  onSignatureFieldFocus?.(clickedField, fieldIndex);
                }
              }
            }
          }
        });
      } catch (err) {
        console.warn("Failed to setup click handler:", err);
      }
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
        baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.PUBLIC_URL ?? ""}`,
        initialViewState: new Nutrient.ViewState({
          formDesignMode: true
        })
      });

      instanceRef.current = instance;

      const annotations = await collectAnnotations(instance);
      onAnnotationsLoad?.(annotations);

      const signatureFields = await collectSignatureFields(instance);
      onSignatureFieldsLoad?.(signatureFields);

      onDocumentLoad?.(fileName);

      attachAnnotationEvents(instance, async () => {
        const updated = await collectAnnotations(instance);
        onAnnotationsLoad?.(updated);
      });

      attachFormFieldEvents(instance, async () => {
        const updated = await collectSignatureFields(instance);
        onSignatureFieldsLoad?.(updated);
      });

      // Setup click handler for signature fields
      await setupSignatureFieldClickHandler(instance);

      // Listen for scroll/zoom/page changes to hide overlay temporarily
      instance.addEventListener("viewState.change", async () => {
        if (currentFocusedField) {
          // Re-show overlay after view state changes
          await showSignHereOverlay(instance, currentFocusedField);
        }
      });
    };

    /**
     * Initialize viewer on mount
     */
    useEffect(() => {
      let mounted = true;
      let detachAnnotations: (() => void) | null = null;
      let detachFormFields: (() => void) | null = null;

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
            baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.PUBLIC_URL ?? ""}`,
            initialViewState: new Nutrient.ViewState({
              formDesignMode: true
            })
          });

          if (!mounted) {
            try {
              await Nutrient.unload(container);
            } catch {}
            return;
          }

          instanceRef.current = instance;
          setIsInitialized(true);

          const annotations = await collectAnnotations(instance);
          onAnnotationsLoad?.(annotations);

          const signatureFields = await collectSignatureFields(instance);
          onSignatureFieldsLoad?.(signatureFields);

          onDocumentLoad?.("nutrient-web-demo.pdf");

          detachAnnotations = attachAnnotationEvents(instance, async () => {
            const updated = await collectAnnotations(instance);
            onAnnotationsLoad?.(updated);
          });

          detachFormFields = attachFormFieldEvents(instance, async () => {
            const updated = await collectSignatureFields(instance);
            onSignatureFieldsLoad?.(updated);
          });

          // Setup click handler for signature fields
          await setupSignatureFieldClickHandler(instance);

          // Listen for view state changes
          instance.addEventListener("viewState.change", async () => {
            if (currentFocusedField) {
              await showSignHereOverlay(instance, currentFocusedField);
            }
          });
        } catch (err) {
          console.error("Viewer initialization failed:", err);
        }
      })();

      return () => {
        mounted = false;
        detachAnnotations?.();
        detachFormFields?.();
        
        // Clear position tracking interval
        if (positionUpdateIntervalRef.current) {
          clearInterval(positionUpdateIntervalRef.current);
          positionUpdateIntervalRef.current = null;
        }
        
        (async () => {
          const c = containerRef.current;
          const instance = instanceRef.current;
          if (instance) {
            await removeSignHereOverlay(instance);
          }
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

      focusAnnotation: async (annotationWrapper: any) => {
        if (!instanceRef.current || !annotationWrapper) return;
        const instance = instanceRef.current;
        
        try {
          // Hide sign here overlay when focusing on annotations
          await removeSignHereOverlay(instance);
          setCurrentFocusedField(null);

          const pageIndex = annotationWrapper.pageIndex;

          instance.setViewState((vs: any) => vs.set("currentPageIndex", pageIndex));
          await new Promise(resolve => setTimeout(resolve, 100));

          if (typeof instance.setSelectedAnnotation === "function") {
            await instance.setSelectedAnnotation(annotationWrapper.sdk);
          } else if (typeof instance.select === "function") {
            instance.select(annotationWrapper.sdk);
          }
        } catch (err) {
          console.error("focusAnnotation error:", err);
        }
      },

      focusSignatureField: async (signatureField: any) => {
        if (!instanceRef.current || !signatureField) return;
        const instance = instanceRef.current;
        
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          
          const formFields = await instance.getFormFields();
          const formFieldsArray = formFields?.toArray?.() ?? Array.from(formFields || []);
          
          const field = formFieldsArray.find(
            (formField: any) =>
              formField.name === signatureField.name &&
              formField instanceof Nutrient.FormFields.SignatureFormField
          );

          if (!field) {
            console.warn("Signature field not found:", signatureField.name);
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
            console.warn("Widget not found for signature field:", signatureField.name);
            return;
          }

          console.log(`Navigating to signature field "${field.name}" on page ${actualPageIndex + 1}`);

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
              console.warn("Could not center signature field:", e);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          if (typeof instance.setSelectedAnnotation === "function") {
            await instance.setSelectedAnnotation(widget);
          } else if (typeof instance.select === "function") {
            instance.select(widget);
          }

          // Show the "Sign Here" overlay after navigation
          const updatedField = {
            ...signatureField,
            widget,
            pageIndex: actualPageIndex,
            boundingBox: widget.boundingBox
          };
          setCurrentFocusedField(updatedField);
          await showSignHereOverlay(instance, updatedField);

          // Start position tracking
          await startPositionTracking(instance, updatedField);

          // Double-click is automatically handled by Nutrient SDK
          // When user clicks the signature field, the signature modal opens
        } catch (err) {
          console.error("focusSignatureField error:", err);
        }
      },

      enterDrawMode: async () => {
        if (!instanceRef.current) return;
        try {
          const Nutrient = (await import("@nutrient-sdk/viewer")).default;
          const inkMode = Nutrient?.InteractionMode?.INK;
          
          if (inkMode) {
            instanceRef.current.setViewState((vs: any) => vs.set("interactionMode", inkMode));
            onModeChange?.("ink");
          } else if (typeof instanceRef.current.activateTool === "function") {
            await instanceRef.current.activateTool("ink");
            onModeChange?.("ink");
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

          instance.setViewState((viewState: any) => viewState.set("formDesignMode", true));

          const viewState = instance.viewState;
          const currentPageIndex = viewState?.currentPageIndex ?? 0;

          const pageInfo = instance.pageInfoForIndex(currentPageIndex);
          const pageWidth = pageInfo?.width ?? 612;
          const pageHeight = pageInfo?.height ?? 792;

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

          // Wait a bit for the field to be fully created and registered
          await new Promise(resolve => setTimeout(resolve, 200));

          // Collect the updated signature fields to get the newly created one
          const updatedFields = await collectSignatureFields(instance);
          const newField = updatedFields.find(f => f.name === fieldName);

          if (newField) {
            console.log("New signature field found, showing Sign Here overlay");
            // Update the focused field state
            setCurrentFocusedField(newField);
            // Show the "Sign Here" overlay for the newly created field
            await showSignHereOverlay(instance, newField);
            
            // Start position tracking
            await startPositionTracking(instance, newField);
            
            // Trigger the wave animation after a short delay
            setTimeout(() => {
              const overlayElements = instance.contentDocument?.querySelectorAll('.sign-here-overlay');
              if (overlayElements) {
                overlayElements.forEach((el: HTMLElement) => {
                  el.classList.add('waving');
                  setTimeout(() => {
                    el.classList.remove('waving');
                  }, 1000);
                });
              }
            }, 100);
          } else {
            console.warn("Could not find newly created signature field");
          }
        } catch (err) {
          console.error("Failed to add signature field:", err);
          alert(`Failed to add signature field: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      },

      deleteSignatureField: async (signatureField: any) => {
        if (!instanceRef.current || !signatureField) {
          console.warn("Cannot delete: viewer instance or signature field not available");
          return;
        }

        const instance = instanceRef.current;

        try {
          // Hide overlay when deleting
          if (currentFocusedField?.name === signatureField.name) {
            await removeSignHereOverlay(instance);
            setCurrentFocusedField(null);
          }

          if (signatureField.widget) {
            await instance.delete(signatureField.widget);
          }

          if (signatureField.sdk?.annotationIds) {
            const annotationIds = signatureField.sdk.annotationIds?.toArray?.() ?? 
                                  Array.from(signatureField.sdk.annotationIds || []);

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

          await instance.delete(signatureField.sdk);

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
        style={{ height: "100%", minHeight: "500px", position: "relative" }}
      />
    );
  }
);

PDFViewer.displayName = "PDFViewer";

export default PDFViewer;