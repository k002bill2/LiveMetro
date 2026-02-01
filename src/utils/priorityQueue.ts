/**
 * Priority Queue (Min-Heap Implementation)
 * Efficient data structure for A* and Dijkstra algorithms
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Item with priority
 */
interface PriorityItem<T> {
  item: T;
  priority: number;
}

// ============================================================================
// Class
// ============================================================================

/**
 * Min-Heap based Priority Queue
 * Lower priority values are dequeued first
 */
export class PriorityQueue<T> {
  private heap: PriorityItem<T>[] = [];

  /**
   * Get the number of items in the queue
   */
  get size(): number {
    return this.heap.length;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Add an item with priority
   */
  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the item with lowest priority
   */
  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop()?.item;

    const min = this.heap[0]?.item;
    const last = this.heap.pop();

    if (last && this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return min;
  }

  /**
   * Peek at the item with lowest priority without removing it
   */
  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  /**
   * Get the priority of the top item
   */
  peekPriority(): number | undefined {
    return this.heap[0]?.priority;
  }

  /**
   * Update the priority of an item (if exists)
   * Returns true if updated, false if not found
   */
  updatePriority(item: T, newPriority: number, compareFn: (a: T, b: T) => boolean): boolean {
    const index = this.heap.findIndex(h => compareFn(h.item, item));

    if (index === -1) return false;

    const heapItem = this.heap[index];
    if (!heapItem) return false;

    const oldPriority = heapItem.priority;
    heapItem.priority = newPriority;

    if (newPriority < oldPriority) {
      this.bubbleUp(index);
    } else {
      this.bubbleDown(index);
    }

    return true;
  }

  /**
   * Check if an item exists in the queue
   */
  contains(item: T, compareFn: (a: T, b: T) => boolean): boolean {
    return this.heap.some(h => compareFn(h.item, item));
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Get all items as array (for debugging)
   */
  toArray(): T[] {
    return this.heap.map(h => h.item);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      const current = this.heap[index];

      if (!parent || !current || parent.priority <= current.priority) {
        break;
      }

      // Swap
      this.heap[parentIndex] = current;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let smallestIndex = index;

      const current = this.heap[index];
      const leftChild = this.heap[leftChildIndex];
      const rightChild = this.heap[rightChildIndex];

      if (!current) break;

      if (
        leftChildIndex < length &&
        leftChild &&
        leftChild.priority < (this.heap[smallestIndex]?.priority ?? Infinity)
      ) {
        smallestIndex = leftChildIndex;
      }

      if (
        rightChildIndex < length &&
        rightChild &&
        rightChild.priority < (this.heap[smallestIndex]?.priority ?? Infinity)
      ) {
        smallestIndex = rightChildIndex;
      }

      if (smallestIndex === index) break;

      // Swap
      const smallest = this.heap[smallestIndex];
      if (smallest) {
        this.heap[smallestIndex] = current;
        this.heap[index] = smallest;
        index = smallestIndex;
      } else {
        break;
      }
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new priority queue
 */
export function createPriorityQueue<T>(): PriorityQueue<T> {
  return new PriorityQueue<T>();
}

export default PriorityQueue;
