import React, { useEffect, useRef, useState } from 'react';

export default function WidthProvider(ComposedComponent: any) {
    return function WidthProviderWrapper(props: any) {
        const [width, setWidth] = useState(1280);
        const elementRef = useRef<HTMLDivElement>(null);
        const mountedRef = useRef(false);

        useEffect(() => {
            mountedRef.current = true;
            const element = elementRef.current;
            if (!element) return;

            // Initial measure
            setWidth(element.offsetWidth);

            const resizeObserver = new ResizeObserver((entries) => {
                if (!mountedRef.current) return;
                for (const entry of entries) {
                    setWidth(entry.contentRect.width);
                }
            });

            resizeObserver.observe(element);
            return () => {
                mountedRef.current = false;
                resizeObserver.disconnect();
            };
        }, []);

        return (
            <div ref={elementRef} className={props.className} style={{ ...props.style, width: '100%' }}>
                <ComposedComponent {...props} width={width} />
            </div>
        );
    };
}
