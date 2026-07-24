"use client";

import { useState } from "react";

export function useCommandBuilder() {
  const [commandKind, setCommandKind] = useState("score");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [label, setLabel] = useState("");
  const [commandDuration, setCommandDuration] = useState(8000);
  const [commandInstanceId, setCommandInstanceId] = useState("");

  const currentCommand = () => {
    const duration = Number.isFinite(commandDuration) && commandDuration > 0 ? commandDuration : undefined;
    const instance = commandInstanceId.trim() ? { i: commandInstanceId.trim() } : {};
    return commandKind === "score" ? { k: "score", h: Number(primary), a: Number(secondary), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : commandKind === "lower" ? { k: "lower", t: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "alert" ? { k: "alert", t: primary.trim(), m: secondary.trim(), x: "w", ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "sponsor" ? { k: "sponsor", b: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "ticker" ? { k: "ticker", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : commandKind === "clock" ? { k: "clock", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : { k: "clear", ...(primary ? { g: primary } : {}), ...(secondary.trim() ? { y: secondary.trim() } : {}) };
  };

  return {
    commandKind, setCommandKind,
    primary, setPrimary,
    secondary, setSecondary,
    label, setLabel,
    commandDuration, setCommandDuration,
    commandInstanceId, setCommandInstanceId,
    currentCommand,
  } as const;
}
