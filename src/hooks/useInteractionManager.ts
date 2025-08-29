import { useCallback, useRef, useState } from 'react';

export type TargetType = 'canvas' | 'envelopeArea' | 'annotation';

export interface InteractionContext {
    target: TargetType;
    annotation?: { id: number; displayId: string; isEndingEvent: boolean };
    envelope?: { name: string; category: string };
}

export function useInteractionManager(options: {
    onCanvasClick?: () => void;
    onAnnotationClick?: (eventId: number) => void;
    startDragAnnotation?: (ctx: InteractionContext, e: PointerEvent) => void;
    updateDragAnnotation?: (e: PointerEvent) => void;
    endDragAnnotation?: (e: PointerEvent) => void;
}) {
    const { onCanvasClick, onAnnotationClick, startDragAnnotation, updateDragAnnotation, endDragAnnotation } = options;

    const startPos = useRef<{ x: number; y: number } | null>(null);
    const ctxRef = useRef<InteractionContext | null>(null);
    const [hasDragged, setHasDragged] = useState(false);
    const suppressNextClick = useRef(false);
    const DRAG_THRESHOLD = 6;

    const onPointerDown = useCallback((e: React.PointerEvent, ctx: InteractionContext) => {
        e.preventDefault();
        e.stopPropagation();
        ctxRef.current = ctx;
        startPos.current = { x: e.clientX, y: e.clientY };
        setHasDragged(false);
        if (ctx.target === 'annotation' && startDragAnnotation) {
            startDragAnnotation(ctx, e.nativeEvent);
        }
    }, [startDragAnnotation]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!startPos.current) return;
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        if (!hasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) setHasDragged(true);
        if (hasDragged && ctxRef.current?.target === 'annotation' && updateDragAnnotation) {
            updateDragAnnotation(e.nativeEvent);
        }
    }, [hasDragged, updateDragAnnotation]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ctx = ctxRef.current;
        if (ctx?.target === 'annotation' && hasDragged) {
            endDragAnnotation?.(e.nativeEvent);
        } else if (e.button === 0 && !hasDragged && !suppressNextClick.current) {
            if (ctx?.target === 'annotation' && ctx.annotation) {
                onAnnotationClick?.(ctx.annotation.id);
            } else if (ctx?.target === 'canvas') {
                onCanvasClick?.();
            }
        }
        suppressNextClick.current = false;
        startPos.current = null;
        ctxRef.current = null;
        setHasDragged(false);
    }, [hasDragged, endDragAnnotation, onAnnotationClick, onCanvasClick]);

    const onContextMenu = useCallback((e: React.MouseEvent, ctx: InteractionContext) => {
        e.preventDefault();
        e.stopPropagation();
        ctxRef.current = ctx;
        suppressNextClick.current = true; // prevent follow-up click
    }, []);

    const afterMenuAction = useCallback(() => {
        suppressNextClick.current = true;
    }, []);

    const isClickSuppressed = () => suppressNextClick.current;
    const clearSuppression = () => { suppressNextClick.current = false; };

    return { onPointerDown, onPointerMove, onPointerUp, onContextMenu, afterMenuAction, hasDraggedRef: () => hasDragged, isClickSuppressed, clearSuppression };
}


