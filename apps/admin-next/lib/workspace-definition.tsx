"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface AdminWorkspaceDefinition {
  elements: ReactNode;
  stage: ReactNode;
  dynamicControls: ReactNode;
  cueStack: ReactNode;
  goControl?: ReactNode;
}

const WorkspaceDefinitionContext = createContext<AdminWorkspaceDefinition | null>(null);

export function WorkspaceDefinitionProvider({ value, children }: { value: AdminWorkspaceDefinition; children: ReactNode }) {
  return <WorkspaceDefinitionContext.Provider value={value}>{children}</WorkspaceDefinitionContext.Provider>;
}

export function useWorkspaceDefinition(): AdminWorkspaceDefinition {
  const ctx = useContext(WorkspaceDefinitionContext);
  if (!ctx) throw new Error("useWorkspaceDefinition must be used within WorkspaceDefinitionProvider");
  return ctx;
}
