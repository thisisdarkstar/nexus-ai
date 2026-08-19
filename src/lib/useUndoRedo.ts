import { useState, useCallback } from 'react';
import type { Message } from '../types';

export function useUndoRedo(maxSize = 30) {
  const [undoStack, setUndoStack] = useState<Message[][]>([]);
  const [redoStack, setRedoStack] = useState<Message[][]>([]);

  const pushSnapshot = useCallback(
    (messages: Message[]) => {
      setUndoStack((prev) => [...prev.slice(-(maxSize - 1)), messages]);
      setRedoStack([]);
    },
    [maxSize]
  );

  const undo = useCallback(
    (current: Message[]): Message[] | null => {
      if (undoStack.length === 0) return null;
      const prev = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      setRedoStack((s) => [...s, current]);
      return prev;
    },
    [undoStack]
  );

  const redo = useCallback(
    (current: Message[]): Message[] | null => {
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
