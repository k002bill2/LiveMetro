/**
 * Priority Queue Tests
 */

import { PriorityQueue, createPriorityQueue } from '../priorityQueue';

describe('PriorityQueue', () => {
  let pq: PriorityQueue<string>;

  beforeEach(() => {
    pq = new PriorityQueue<string>();
  });

  describe('basic operations', () => {
    it('should start empty', () => {
      expect(pq.isEmpty()).toBe(true);
      expect(pq.size).toBe(0);
    });

    it('should enqueue items', () => {
      pq.enqueue('a', 1);
      expect(pq.isEmpty()).toBe(false);
      expect(pq.size).toBe(1);
    });

    it('should dequeue items in priority order', () => {
      pq.enqueue('c', 3);
      pq.enqueue('a', 1);
      pq.enqueue('b', 2);

      expect(pq.dequeue()).toBe('a');
      expect(pq.dequeue()).toBe('b');
      expect(pq.dequeue()).toBe('c');
    });

    it('should return undefined when dequeuing empty queue', () => {
      expect(pq.dequeue()).toBeUndefined();
    });

    it('should dequeue single item correctly', () => {
      pq.enqueue('only', 1);
      expect(pq.dequeue()).toBe('only');
      expect(pq.isEmpty()).toBe(true);
    });
  });

  describe('peek', () => {
    it('should peek at top item without removing', () => {
      pq.enqueue('a', 1);
      pq.enqueue('b', 2);

      expect(pq.peek()).toBe('a');
      expect(pq.size).toBe(2);
    });

    it('should return undefined when peeking empty queue', () => {
      expect(pq.peek()).toBeUndefined();
    });
  });

  describe('peekPriority', () => {
    it('should return priority of top item', () => {
      pq.enqueue('a', 5);
      pq.enqueue('b', 3);

      expect(pq.peekPriority()).toBe(3);
    });

    it('should return undefined when queue is empty', () => {
      expect(pq.peekPriority()).toBeUndefined();
    });
  });

  describe('updatePriority', () => {
    const compareFn = (a: string, b: string): boolean => a === b;

    it('should update priority to lower value', () => {
      pq.enqueue('a', 5);
      pq.enqueue('b', 3);

      const updated = pq.updatePriority('a', 1, compareFn);
      expect(updated).toBe(true);
      expect(pq.dequeue()).toBe('a');
    });

    it('should update priority to higher value', () => {
      pq.enqueue('a', 1);
      pq.enqueue('b', 3);

      const updated = pq.updatePriority('a', 10, compareFn);
      expect(updated).toBe(true);
      expect(pq.dequeue()).toBe('b');
    });

    it('should return false for non-existent item', () => {
      pq.enqueue('a', 1);
      expect(pq.updatePriority('z', 5, compareFn)).toBe(false);
    });
  });

  describe('contains', () => {
    const compareFn = (a: string, b: string): boolean => a === b;

    it('should find existing item', () => {
      pq.enqueue('a', 1);
      expect(pq.contains('a', compareFn)).toBe(true);
    });

    it('should not find missing item', () => {
      pq.enqueue('a', 1);
      expect(pq.contains('b', compareFn)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      pq.enqueue('a', 1);
      pq.enqueue('b', 2);
      pq.clear();

      expect(pq.isEmpty()).toBe(true);
      expect(pq.size).toBe(0);
    });
  });

  describe('toArray', () => {
    it('should return all items', () => {
      pq.enqueue('a', 1);
      pq.enqueue('b', 2);

      const arr = pq.toArray();
      expect(arr).toHaveLength(2);
      expect(arr).toContain('a');
      expect(arr).toContain('b');
    });
  });

  describe('heap property', () => {
    it('should maintain min-heap after many insertions', () => {
      const values = [10, 5, 3, 8, 1, 7, 2, 9, 4, 6];
      values.forEach((v) => pq.enqueue(`item${v}`, v));

      const result: string[] = [];
      while (!pq.isEmpty()) {
        const item = pq.dequeue();
        if (item) result.push(item);
      }

      expect(result).toEqual([
        'item1', 'item2', 'item3', 'item4', 'item5',
        'item6', 'item7', 'item8', 'item9', 'item10',
      ]);
    });

    it('should handle duplicate priorities', () => {
      pq.enqueue('a', 1);
      pq.enqueue('b', 1);
      pq.enqueue('c', 1);

      expect(pq.size).toBe(3);
      pq.dequeue();
      pq.dequeue();
      pq.dequeue();
      expect(pq.isEmpty()).toBe(true);
    });
  });
});

describe('createPriorityQueue', () => {
  it('should create a new PriorityQueue instance', () => {
    const pq = createPriorityQueue<number>();
    expect(pq).toBeInstanceOf(PriorityQueue);
    expect(pq.isEmpty()).toBe(true);
  });
});
