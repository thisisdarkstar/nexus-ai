import { scannerAdapterRegistry } from './ScannerAdapter';
import { NucleiAdapter } from './nuclei/NucleiAdapter';
import { SemgrepAdapter } from './semgrep/SemgrepAdapter';

// Register core open-source tool adapters
scannerAdapterRegistry.register(new NucleiAdapter());
scannerAdapterRegistry.register(new SemgrepAdapter());

export * from './ScannerAdapter';
export * from './nuclei/NucleiAdapter';
export * from './semgrep/SemgrepAdapter';

