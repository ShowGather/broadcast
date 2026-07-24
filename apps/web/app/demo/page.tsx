"use client";

import { PresentationProvider, PresentationRegion, ViewerShell } from "@showgather/player-ui";
import { createDemoPresentationState } from "@showgather/player-core";

export default function DemoPage() {
  const initialState = createDemoPresentationState();

  return (
    <main className="min-h-screen p-4 max-w-[1440px] mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">ShowGather Demo</h1>
        <p className="text-sm text-slate-500">Static demonstration with baseline presentation state</p>
      </div>
      <PresentationProvider initialState={initialState}>
        <ViewerShell
          profile="desktop"
          video={
            <div className="video-container">
              <div className="video-player flex items-center justify-center bg-slate-900 text-slate-500">
                Demo Mode — No Live Stream
              </div>
            </div>
          }
          diagnostics={null}
        />
      </PresentationProvider>
    </main>
  );
}
