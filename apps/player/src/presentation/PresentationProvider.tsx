import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import {
  applyPresentationCommand,
  createPresentationState,
  expirePresentationItems,
  type PresentationCommand,
  type PresentationState,
} from "@showgather/presentation-model";

interface PresentationContextValue {
  state: PresentationState;
  applyCommand: (command: PresentationCommand) => void;
  replaceState: (state: PresentationState) => void;
  expireAt: (currentPts: number) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function PresentationProvider({ children, initialState }: PropsWithChildren<{ initialState?: PresentationState }>) {
  const [state, setState] = useState<PresentationState>(initialState ?? createPresentationState());
  const applyCommand = useCallback((command: PresentationCommand) => setState((current) => applyPresentationCommand(current, command)), []);
  const replaceState = useCallback((nextState: PresentationState) => setState(nextState), []);
  const expireAt = useCallback((currentPts: number) => setState((current) => expirePresentationItems(current, currentPts)), []);
  const value = useMemo(() => ({ state, applyCommand, replaceState, expireAt }), [state, applyCommand, replaceState, expireAt]);

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation() {
  const value = useContext(PresentationContext);
  if (value === null) throw new Error("usePresentation must be used inside PresentationProvider");
  return value;
}
