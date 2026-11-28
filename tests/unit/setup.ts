import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

afterEach(() => localStorage.clear());
// jsdom has no canvas: give confetti a harmless 2D context
HTMLCanvasElement.prototype.getContext = (() => new Proxy({}, { get: () => () => {} })) as never;
