/**
 * Pyodide Web Worker for safe, isolated Python execution
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let pyodide: any = null;
let isInitializing = false;
let stdoutBuffer: string[] = [];
let stderrBuffer: string[] = [];

async function initPyodide() {
  if (pyodide) return pyodide;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return pyodide;
  }

  isInitializing = true;
  try {
    const cdnUrl = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs';
    const pyodideModule = await import(/* @vite-ignore */ cdnUrl);

    pyodide = await pyodideModule.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/',
      stdout: (text: string) => {
        stdoutBuffer.push(text);
      },
      stderr: (text: string) => {
        stderrBuffer.push(text);
      },
    });

    isInitializing = false;
    return pyodide;
  } catch (err) {
    isInitializing = false;
    throw err;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, code, timeoutMs = 15000 } = e.data;

  if (type === 'INIT') {
    try {
      await initPyodide();
      self.postMessage({ id, type: 'INIT_SUCCESS' });
    } catch (err: any) {
      self.postMessage({ id, type: 'INIT_ERROR', error: err.message || String(err) });
    }
    return;
  }

  if (type === 'RUN') {
    const startTime = performance.now();
    try {
      const py = await initPyodide();
      stdoutBuffer = [];
      stderrBuffer = [];

      // Execute code with a timeout race
      const execPromise = py.runPythonAsync(code);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      );

      const rawResult = await Promise.race([execPromise, timeoutPromise]);
      const executionTimeMs = Math.round(performance.now() - startTime);

      let resultStr = '';
      if (rawResult !== undefined && rawResult !== null) {
        try {
          if (typeof rawResult.toJs === 'function') {
            resultStr = JSON.stringify(rawResult.toJs());
          } else {
            resultStr = String(rawResult);
          }
        } catch {
          resultStr = String(rawResult);
        }
      }

      self.postMessage({
        id,
        type: 'RUN_SUCCESS',
        stdout: stdoutBuffer.join('\n'),
        stderr: stderrBuffer.join('\n'),
        result: resultStr,
        executionTimeMs,
      });
    } catch (err: any) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      self.postMessage({
        id,
        type: 'RUN_ERROR',
        stdout: stdoutBuffer.join('\n'),
        error: err.message || String(err),
        executionTimeMs,
      });
    }
  }
};
