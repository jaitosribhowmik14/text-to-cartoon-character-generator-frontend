"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";

type GenerateResponse = {
  id: string;
  status?: string;
  error?: string;
};

const API_BASE = "http://localhost:8080/api/v1/images";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const pollRef = useRef<number | null>(null);

  const imageUrl = useMemo(() => {
    if (!imageId) return null;
    return `${API_BASE}/${imageId}/content`;
  }, [imageId]);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setError(null);
    setImageId(null);
    setIsPolling(false);
    setIsReady(false);
  }, []);

  const startPolling = useCallback((id: string) => {
    setIsPolling(true);
    setIsReady(false);
    // Poll HEAD to detect availability without transferring bytes
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/${id}/content`, {
          method: "HEAD",
          cache: "no-store",
        });
        if (res.ok) {
          setIsReady(true);
          setIsPolling(false);
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        // ignore transient errors while polling
      }
    };
    // Start immediately then repeat
    poll();
    pollRef.current = window.setInterval(poll, 1500);
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setIsSubmitting(true);
      setError(null);
      setImageId(null);
      setIsReady(false);

      try {
        const res = await fetch(`${API_BASE}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            negativePrompt: "",
            width: 1024,
            height: 1024,
            numInferenceSteps: 20,
            guidanceScale: 3.5,
            returnBase64: true,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }

        const data: GenerateResponse = await res.json();
        if (!data?.id) {
          throw new Error("No image id returned from server");
        }
        setImageId(data.id);
        startPolling(data.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [prompt, startPolling]
  );

  const onCopy = useCallback(async () => {
    if (!imageUrl) return;
    try {
      await navigator.clipboard.writeText(imageUrl);
    } catch (e) {
      // ignore
    }
  }, [imageUrl]);

  const onDownload = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl, { cache: "no-store" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${imageId ?? "generated"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  }, [imageUrl, imageId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Image src="/globe.svg" alt="logo" width={24} height={24} className="dark:invert" />
            <span className="text-base font-semibold tracking-tight">Text2Img</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Local API • v1</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">Generate images from text</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Enter a descriptive prompt and we will generate an image using your local backend.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black">
            <div className="flex flex-col gap-2">
              <label htmlFor="prompt" className="text-sm font-medium">Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. a cinematic photo of a golden retriever astronaut walking on Mars at sunset"
                className="min-h-28 w-full resize-y rounded-xl border border-black/10 bg-transparent p-3 outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/15 dark:focus:border-white/25"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : ""}
              </div>
              <div className="flex gap-2">
                {imageId && (
                  <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !prompt.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent dark:border-black/60" />
                      Generating
                    </>
                  ) : (
                    <>Generate</>
                  )}
                </button>
              </div>
            </div>
          </form>

          {(imageId || isSubmitting) && (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {isSubmitting && !imageId && "Submitting prompt..."}
                  {imageId && !isReady && "Waiting for image to be ready..."}
                  {imageId && isReady && "Image ready"}
                </div>
                {imageId && (
                  <div className="flex gap-2">
                    <button onClick={onCopy} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">Copy URL</button>
                    <button onClick={onDownload} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">Download</button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid place-items-center overflow-hidden rounded-xl border border-black/5 bg-zinc-100 dark:border-white/5 dark:bg-zinc-900" style={{aspectRatio: "1/1"}}>
                {imageId && isReady ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl ?? undefined}
                    alt="Generated"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-400/60 border-t-transparent" />
                    <span>{imageId ? "Generating image..." : "Preparing..."}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Built with Next.js. Backend: http://localhost:8080/api/v1
      </footer>
    </div>
  );
}
