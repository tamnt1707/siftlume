import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  InterruptableStoppingCriteria,
  TextStreamer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers';

/**
 * Runs an in-browser model with transformers.js (ONNX Runtime on WebGPU), off the page's main
 * thread; see lib/local-model.ts. The ONNX Runtime code ships in public/ort: nothing executable
 * is fetched, only the model's weights from Hugging Face.
 *
 * Messages in:  { type: 'load', id } | { type: 'generate', system, user, maxTokens } |
 *               { type: 'interrupt' } | { type: 'unload' }
 * Messages out: { type: 'progress', value } | { type: 'loaded' } | { type: 'text', text } |
 *               { type: 'done', text } | { type: 'error', message }
 */

const origin = self.location.origin;
env.allowLocalModels = false;
// The default would fetch the runtime from a CDN and import it from a blob: URL; both are
// blocked in an extension (and remote code is not allowed).
env.useWasmCache = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = {
    mjs: `${origin}/ort/ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${origin}/ort/ort-wasm-simd-threaded.asyncify.wasm`,
  };
}

let loaded: { id: string; tokenizer: PreTrainedTokenizer; model: PreTrainedModel } | null = null;
const stopping = new InterruptableStoppingCriteria();

const post = (msg: Record<string, unknown>) => self.postMessage(msg);

async function load(id: string) {
  if (loaded?.id === id) return post({ type: 'loaded' });
  await loaded?.model.dispose();
  loaded = null;
  // Progress over every file of the model, by bytes.
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    let done = 0;
    let total = 0;
    for (const f of files.values()) {
      done += f.loaded;
      total += f.total;
    }
    post({ type: 'progress', value: total ? done / total : 0 });
  };
  const tokenizer = await AutoTokenizer.from_pretrained(id, { progress_callback });
  const model = await AutoModelForCausalLM.from_pretrained(id, { device: 'webgpu', dtype: 'q4f16', progress_callback });
  loaded = { id, tokenizer, model };
  post({ type: 'loaded' });
}

async function generate(system: string, user: string, maxTokens: number) {
  if (!loaded) throw new Error('No model loaded');
  const { tokenizer, model } = loaded;
  const inputs = tokenizer.apply_chat_template(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    // LFM3 thinks out loud by default: off, the answer starts right away.
    // Extra options reach the chat template as variables (not in the published types).
    { add_generation_prompt: true, return_dict: true, enable_thinking: false } as Parameters<
      typeof tokenizer.apply_chat_template
    >[1],
  ) as Record<string, unknown>;
  let text = '';
  stopping.reset();
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk: string) => {
      text += chunk;
      post({ type: 'text', text });
    },
  });
  await model.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    do_sample: false,
    streamer,
    stopping_criteria: stopping,
  });
  post({ type: 'done', text });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; id?: string; system?: string; user?: string; maxTokens?: number };
  const run = async () => {
    if (msg.type === 'load') await load(msg.id!);
    else if (msg.type === 'generate') await generate(msg.system!, msg.user!, msg.maxTokens!);
    else if (msg.type === 'interrupt') stopping.interrupt();
    else if (msg.type === 'unload') {
      await loaded?.model.dispose();
      loaded = null;
    }
  };
  run().catch((err) => post({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
};
