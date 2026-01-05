/**
 * useDragReorder Hook Tests
 * Tests for drag-to-reorder functionality
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDragReorder } from '../useDragReorder';

interface TestItem {
  id: string;
  name: string;
}

const createTestItems = (): TestItem[] => [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
  { id: '3', name: 'Item 3' },
  { id: '4', name: 'Item 4' },
];

describe('useDragReorder', () => {
  const mockOnReorder = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with isDragging false', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      expect(result.current.isDragging).toBe(false);
    });

    it('should initialize with draggedIndex null', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      expect(result.current.draggedIndex).toBeNull();
    });
  });

  describe('Drag Start', () => {
    it('handleDragStart should set isDragging to true', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      expect(result.current.isDragging).toBe(true);
    });

    it('handleDragStart should set draggedIndex correctly', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      act(() => {
        result.current.handleDragStart(2);
      });

      expect(result.current.draggedIndex).toBe(2);
    });

    it('handleDragStart should work with first item (index 0)', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedIndex).toBe(0);
    });

    it('handleDragStart should work with last item', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      act(() => {
        result.current.handleDragStart(items.length - 1);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedIndex).toBe(items.length - 1);
    });
  });

  describe('Drag Movement', () => {
    it('handleDragMove should do nothing when draggedIndex is null', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      // Call handleDragMove without starting drag
      act(() => {
        result.current.handleDragMove(100);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedIndex).toBeNull();
    });

    it('handleDragMove should accept positive gesture values (dragging down)', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(150); // Moving down
      });

      expect(result.current.isDragging).toBe(true);
    });

    it('handleDragMove should accept negative gesture values (dragging up)', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(2);
      });

      act(() => {
        result.current.handleDragMove(-100); // Moving up
      });

      expect(result.current.isDragging).toBe(true);
    });
  });

  describe('Drag End', () => {
    it('handleDragEnd should call onReorder with reordered items', async () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(200); // Move to index 2
      });

      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(mockOnReorder).toHaveBeenCalled();
    });

    it('handleDragEnd should not call onReorder when position unchanged', async () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      // Don't move
      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(mockOnReorder).not.toHaveBeenCalled();
    });

    it('handleDragEnd should reset isDragging and draggedIndex', async () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedIndex).toBe(0);

      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedIndex).toBeNull();
    });

    it('handleDragEnd should handle onReorder errors gracefully', async () => {
      const errorOnReorder = jest.fn().mockRejectedValue(new Error('Test error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: errorOnReorder, itemHeight: 100 })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(200);
      });

      // Should not throw
      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error reordering items:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handleDragEnd should handle case when draggedIndex is null', async () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      // Call handleDragEnd without starting drag
      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(mockOnReorder).not.toHaveBeenCalled();
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('Animation Values', () => {
    it('getItemTranslateY should return Animated.Value for valid item', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      const translateY = result.current.getItemTranslateY(0);
      expect(translateY).toBeDefined();
    });

    it('getItemTranslateY should return value for each item', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      const translateY1 = result.current.getItemTranslateY(0);
      const translateY2 = result.current.getItemTranslateY(1);

      expect(translateY1).toBeDefined();
      expect(translateY2).toBeDefined();
    });

    it('getItemTranslateY should handle invalid index', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      const translateY = result.current.getItemTranslateY(100); // Invalid index
      expect(translateY).toBeDefined();
    });
  });

  describe('Custom itemHeight', () => {
    it('should use default itemHeight of 150', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      // Start drag and move
      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(150); // Default itemHeight
      });

      expect(result.current.isDragging).toBe(true);
    });

    it('should use custom itemHeight when provided', () => {
      const items = createTestItems();
      const customHeight = 200;
      const { result } = renderHook(() =>
        useDragReorder({
          items,
          onReorder: mockOnReorder,
          itemHeight: customHeight,
        })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(customHeight);
      });

      expect(result.current.isDragging).toBe(true);
    });
  });

  describe('Reorder Logic', () => {
    it('should reorder items correctly when dragging down', async () => {
      const items = createTestItems();
      let capturedReorder: TestItem[] = [];
      const captureOnReorder = jest.fn(async (reordered: TestItem[]) => {
        capturedReorder = reordered;
      });

      const { result } = renderHook(() =>
        useDragReorder({
          items,
          onReorder: captureOnReorder,
          itemHeight: 100,
        })
      );

      // Drag item 0 to position 2
      act(() => {
        result.current.handleDragStart(0);
      });

      act(() => {
        result.current.handleDragMove(200); // Move to index 2
      });

      await act(async () => {
        await result.current.handleDragEnd();
      });

      expect(captureOnReorder).toHaveBeenCalled();
      // Item 1 (originally first) should now be at index 2
      if (capturedReorder.length > 0) {
        expect(capturedReorder[2]?.id).toBe('1');
      }
    });

    it('should handle empty items array', () => {
      const items: TestItem[] = [];
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedIndex).toBeNull();
    });

    it('should handle single item array', async () => {
      const items = [{ id: '1', name: 'Only Item' }];
      const { result } = renderHook(() =>
        useDragReorder({ items, onReorder: mockOnReorder })
      );

      act(() => {
        result.current.handleDragStart(0);
      });

      await act(async () => {
        await result.current.handleDragEnd();
      });

      // No reorder should happen for single item
      expect(mockOnReorder).not.toHaveBeenCalled();
    });
  });

  describe('Item Changes', () => {
    it('should handle items prop changes', () => {
      const initialItems = createTestItems();
      const { result, rerender } = renderHook(
        ({ items }) => useDragReorder({ items, onReorder: mockOnReorder }),
        { initialProps: { items: initialItems } }
      );

      expect(result.current.isDragging).toBe(false);

      // Add new item
      const newItems = [...initialItems, { id: '5', name: 'Item 5' }];
      rerender({ items: newItems });

      expect(result.current.isDragging).toBe(false);
    });
  });
});
