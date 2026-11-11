import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Runs the in-browser model (lib/local-model.ts) off the page's main thread.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
