import { useEffect, useRef } from 'react';

export function useFocusTrap(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      const container = containerRef.current;
      if (container) {
        // Set tabIndex dynamically on container to make it focusable if needed
        if (!container.hasAttribute('tabindex')) {
          container.setAttribute('tabindex', '-1');
        }
        
        // Let's delay focus slightly to ensure layout is complete and transition has started
        const focusTimeout = setTimeout(() => {
          const elements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const focusableElements = (Array.from(elements) as HTMLElement[]).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && !(el as any).disabled;
          });

          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else {
            container.focus();
          }
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
          }

          if (e.key === 'Tab') {
            const elements = container.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const focusableElements = (Array.from(elements) as HTMLElement[]).filter(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && !(el as any).disabled;
            });

            if (focusableElements.length === 0) {
              e.preventDefault();
              return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
              if (document.activeElement === firstElement || document.activeElement === container) {
                lastElement.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
              }
            }
          }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
          clearTimeout(focusTimeout);
          window.removeEventListener('keydown', handleKeyDown);
          // Restore focus
          if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
            previousFocusRef.current.focus();
          }
        };
      }
    }
  }, [isOpen, onClose]);

  return containerRef;
}
