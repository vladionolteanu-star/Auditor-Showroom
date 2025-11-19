import React, { useState, useRef, useEffect } from 'react';
import type { Deviation } from '../types';

interface ImageViewerProps {
  imageUrl: string;
  deviations: Deviation[];
  activeDeviationIndex: number | null;
}

// FIX: Expanded color map to cover all severity levels and ensure consistency with AuditResultDisplay.
const SEVERITY_COLORS: Record<string, string> = {
    'CRITICĂ': 'rgba(220, 38, 38, 0.7)',   // red-600
    'Mare': 'rgba(236, 72, 153, 0.7)',    // pink-500
    'Medie': 'rgba(234, 179, 8, 0.7)',    // yellow-500
    'Mică': 'rgba(59, 130, 246, 0.7)',     // blue-500
    'Notă': 'rgba(107, 114, 128, 0.7)',   // gray-500
    'default': 'rgba(107, 114, 128, 0.7)', // fallback gray
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, deviations, activeDeviationIndex }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // This function measures the rendered size of the image element and updates the state.
  const updateImageSize = () => {
    if (imageRef.current) {
      const { offsetWidth, offsetHeight } = imageRef.current;
      // Only update state if the size has actually changed to avoid re-render loops.
      if (imageSize.width !== offsetWidth || imageSize.height !== offsetHeight) {
        setImageSize({ width: offsetWidth, height: offsetHeight });
      }
    }
  };

  // Run the measurement when the image URL changes and the image loads.
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    img.addEventListener('load', updateImageSize);
    // If image is already loaded (e.g., from cache), measure it immediately.
    if (img.complete) {
      updateImageSize();
    }

    return () => {
      img.removeEventListener('load', updateImageSize);
    };
  }, [imageUrl]); // Rerun when imageUrl changes

  // Use a ResizeObserver to re-measure the image whenever its container changes size.
  // This handles window resizing, flexbox changes, etc.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(() => {
      // We delay the update slightly to ensure the browser has finished layout calculations.
      requestAnimationFrame(updateImageSize);
    });
    
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    // The outer div provides the background, padding, and flex centering.
    <div ref={containerRef} className="relative w-full h-full rounded-lg overflow-hidden glass-panel p-2 flex items-center justify-center">
      {/* FIX: A new relative container is added to wrap the image and the SVG overlay.
          This ensures the SVG's absolute positioning is relative to the image itself,
          not the outer centered container, fixing the annotation offset bug. */}
      <div className="relative inline-block">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Showroom audit"
          className="block max-w-full max-h-full object-contain rounded-md"
        />
        {deviations.length > 0 && imageSize.width > 0 && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={imageSize.width}
            height={imageSize.height}
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
          >
            {deviations.map((dev, index) => (
              dev.boundingBox && (
                  <rect
                      key={index}
                      x={dev.boundingBox.x * imageSize.width}
                      y={dev.boundingBox.y * imageSize.height}
                      width={dev.boundingBox.width * imageSize.width}
                      height={dev.boundingBox.height * imageSize.height}
                      className={`transition-all duration-300 ease-in-out stroke-white`}
                      fill={SEVERITY_COLORS[dev.severity] || SEVERITY_COLORS.default}
                      strokeWidth={activeDeviationIndex === index ? 4 : 2}
                      style={{
                          opacity: activeDeviationIndex === null || activeDeviationIndex === index ? 1 : 0.2,
                      }}
                  />
              )
            ))}
          </svg>
        )}
      </div>
    </div>
  );
};