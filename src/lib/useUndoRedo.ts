import { useState, useCallback } from 'react';

export function useUndoRedo<T>(maxSize = 30) {
  const [undoStack, setUndoStack] = useState<T[]>([]);
  const [redoStack, setRedoStack] = useState<T[]>([]);

  const pushSnapshot = useCallback(
    (snapshot: T) => {
      setUndoStack((prev) => [...prev.slice(-(maxSize - 1)), snapshot]);
      setRedoStack([]);
    },
    [maxSize]
  );

  const undo = useCallback(
    (current: T): T | null => {
      if (undoStack.length === 0) return null;
      const prev = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      setRedoStack((s) => [...s, current]);
      return prev;
    },
    [undoStack]
  );

  const redo = useCallback(
    (current: T): T | null => {
      if (redoStack.length === 0) return null;
      const next = redoStack[redoStack.length - 1];
      setRedoStack((s) => s.slice(0, -1));
      setUndoStack((s) => [...s, current]);
      return next;
    },
    [redoStack]
  );

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
