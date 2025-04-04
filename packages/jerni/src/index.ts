// Main package exports
import createJourney from "./createJourney";

// Default export for backward compatibility
export default createJourney;

// Named export for ESM
export { default as createJourney } from './createJourney';

// Export type definitions
export * from './lib/exported_types';

// Export utility functions
export { default as mapEvents } from './lib/mapEvents';
export { default as skip } from './lib/skip';

// Export errors
export { default as JerniPersistenceError } from './JerniPersistenceError';
export { default as UnrecoverableError } from './UnrecoverableError';

// Export test utilities
export { default as testWrapper } from './lib/testWrapper';

// Export development tools
export { default as begin } from './begin';
