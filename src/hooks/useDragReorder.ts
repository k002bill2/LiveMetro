/**
 * Drag Reorder Hook
 * Generic hook for implementing drag-to-reorder functionality
 */

import { useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';

interface UseDragReorderProps<T extends { id: string }> {
  items: T[];
  onReorder: (reordered: T[]) => Promise<void>;
  itemHeight?: number; // Approximate height of each item
}

interface UseDragReorderReturn {
  isDragging: boolean;
  draggedIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragMove: (gestureY: number) => void;
  handleDragEnd: () => void;
  getItemTranslateY: (index: number) => Animated.Value;
}

export const useDragReorder = <T extends { id: string }>({
  items,
  onReorder,
  itemHeight = 150, // Default approximate item height
}: UseDragReorderProps<T>): UseDragReorderReturn => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Animated values for each item
  const translateYValues = useRef<Map<string, Animated.Value>>(new Map()).current;
  const draggedItemY = useRef(new Animated.Value(0)).current;
  const initialY = useRef(0);

  /**
   * Get or create animated value for an item
   */
  const getItemTranslateY = useCallback((index: number): Animated.Value => {
    const item = items[index];
    if (!item) {
      return new Animated.Value(0);
    }

    if (!translateYValues.has(item.id)) {
      translateYValues.set(item.id, new Animated.Value(0));
    }
    return translateYValues.get(item.id)!;
  }, [items, translateYValues]);

  /**
   * Start dragging an item
   */
  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
    setHoverIndex(index);
    initialY.current = index * itemHeight;

    // Reset all animations
    translateYValues.forEach(value => value.setValue(0));
    draggedItemY.setValue(0);
  }, [itemHeight, translateYValues, draggedItemY]);

  /**
   * Handle drag movement
   */
  const handleDragMove = useCallback((gestureY: number) => {
    if (draggedIndex === null) return;

    // Update dragged item position
    draggedItemY.setValue(gestureY);

    // Calculate new hover index based on gesture position
    const currentY = initialY.current + gestureY;
    const newHoverIndex = Math.round(currentY / itemHeight);
    const clampedHoverIndex = Math.max(0, Math.min(items.length - 1, newHoverIndex));

    if (clampedHoverIndex !== hoverIndex) {
      setHoverIndex(clampedHoverIndex);

      // Animate other items to make space
      items.forEach((_item, index) => {
        if (index === draggedIndex) return;

        const translateY = getItemTranslateY(index);
        let offset = 0;

        // Calculate offset based on drag direction
        if (draggedIndex < clampedHoverIndex) {
          // Dragging down
          if (index > draggedIndex && index <= clampedHoverIndex) {
            offset = -itemHeight;
          }
        } else if (draggedIndex > clampedHoverIndex) {
          // Dragging up
          if (index < draggedIndex && index >= clampedHoverIndex) {
            offset = itemHeight;
          }
        }

        Animated.timing(translateY, {
          toValue: offset,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [draggedIndex, hoverIndex, itemHeight, items, getItemTranslateY, draggedItemY, initialY]);

  /**
   * End dragging and reorder items
   */
  const handleDragEnd = useCallback(async () => {
    if (draggedIndex === null || hoverIndex === null) {
      setIsDragging(false);
      setDraggedIndex(null);
      setHoverIndex(null);
      return;
    }

    // Don't reorder if position hasn't changed
    if (draggedIndex === hoverIndex) {
      // Reset animations
      draggedItemY.setValue(0);
      translateYValues.forEach(value => {
        Animated.timing(value, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });

      setIsDragging(false);
      setDraggedIndex(null);
      setHoverIndex(null);
      return;
    }

    // Create reordered array
    const reordered = [...items];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    if (movedItem === undefined) return; // Safety check
    reordered.splice(hoverIndex, 0, movedItem);

    // Reset state first for immediate UI feedback
    setIsDragging(false);
    setDraggedIndex(null);
    setHoverIndex(null);

    // Reset animations
    draggedItemY.setValue(0);
    translateYValues.forEach(value => value.setValue(0));

    // Persist reorder
    try {
      await onReorder(reordered);
    } catch (error) {
      console.error('Error reordering items:', error);
      // Errors are handled by the parent component
    }
  }, [draggedIndex, hoverIndex, items, onReorder, draggedItemY, translateYValues]);

  return {
    isDragging,
    draggedIndex,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    getItemTranslateY,
  };
};
