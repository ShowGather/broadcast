import { Prisma, type PrismaClient } from "@prisma/client";
import { validatePresentationCommandPayload, type PresentationCommandPayload } from "@showgather/event-schema";

const PRODUCTION_STATUSES = new Set(["draft", "rehearsal", "live", "complete", "archived"]);

export type ProductionInput = {
  title?: unknown; description?: unknown; status?: unknown; scheduledStart?: unknown; scheduledEnd?: unknown;
  configuration?: unknown; showConfigurationId?: unknown;
};
export type RundownInput = { name?: unknown };
export type CueInput = { label?: unknown; command?: unknown; enabled?: unknown; position?: unknown };

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required`);
  return value.trim();
}
function optionalText(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  return value.trim() || null;
}
function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be an ISO date`);
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`${field} must be an ISO date`);
  return date;
}
function optionalConfiguration(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("configuration must be an object");
  validateConfiguration(value as Record<string, unknown>);
  return value as Prisma.InputJsonValue;
}
function validateConfiguration(configuration: Record<string, unknown>) {
  const allowed = new Set(["sport", "homeTeam", "awayTeam", "tickerLabel", "programmeTitle", "programmeSubtitle", "liveLabel", "accent", "enabledCompanionPanels", "companionPanelLabels", "viewerContext"]);
  if (Object.keys(configuration).some((key) => !allowed.has(key))) throw new Error("configuration contains an unsupported field");
  for (const key of ["sport", "homeTeam", "awayTeam", "tickerLabel", "programmeTitle", "programmeSubtitle", "liveLabel", "viewerContext"] as const) {
    if (configuration[key] !== undefined && (typeof configuration[key] !== "string" || configuration[key].trim().length === 0 || configuration[key].length > 80)) throw new Error(`${key} must be 1-80 characters`);
  }
  if (configuration.accent !== undefined && (typeof configuration.accent !== "string" || !/^#[0-9a-fA-F]{6}$/.test(configuration.accent))) throw new Error("accent must be a hex colour");
  const panels = configuration.enabledCompanionPanels;
  if (panels !== undefined && (!Array.isArray(panels) || panels.some((panel) => panel !== "match" && panel !== "info" && panel !== "partners" && panel !== "interact"))) throw new Error("enabledCompanionPanels contains an unsupported panel");
  const labels = configuration.companionPanelLabels;
  if (labels !== undefined && (typeof labels !== "object" || labels === null || Array.isArray(labels) || Object.entries(labels as Record<string, unknown>).some(([key, label]) => !["match", "info", "partners", "interact"].includes(key) || typeof label !== "string" || label.length === 0 || label.length > 24))) throw new Error("companionPanelLabels contains an invalid label");
}
function optionalBoolean(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${field} must be true or false`);
  return value;
}

function productionData(input: ProductionInput, creating: boolean): Prisma.ProductionUncheckedCreateInput | Prisma.ProductionUncheckedUpdateInput {
  const title = creating ? requiredText(input.title, "production title") : (input.title === undefined ? undefined : requiredText(input.title, "production title"));
  const status = input.status === undefined ? undefined : requiredText(input.status, "production status");
  if (status !== undefined && !PRODUCTION_STATUSES.has(status)) throw new Error("invalid production status");
  const showConfigurationId = input.showConfigurationId === undefined ? undefined : optionalText(input.showConfigurationId, "showConfigurationId");
  return {
    ...(title !== undefined ? { title } : {}),
    ...(input.description !== undefined ? { description: optionalText(input.description, "description") } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(input.scheduledStart !== undefined ? { scheduledStart: optionalDate(input.scheduledStart, "scheduledStart") } : {}),
    ...(input.scheduledEnd !== undefined ? { scheduledEnd: optionalDate(input.scheduledEnd, "scheduledEnd") } : {}),
    ...(input.configuration !== undefined ? { configuration: optionalConfiguration(input.configuration) } : {}),
    ...(showConfigurationId !== undefined ? { showConfigurationId } : {}),
  };
}

function cueData(input: CueInput, creating: boolean): Prisma.RundownCueUncheckedCreateInput | Prisma.RundownCueUncheckedUpdateInput {
  const label = creating ? requiredText(input.label, "cue label") : (input.label === undefined ? undefined : requiredText(input.label, "cue label"));
  const command = input.command === undefined ? undefined : validatePresentationCommandPayload(input.command);
  if (input.command !== undefined && command === null) throw new Error("invalid presentation command");
  const position = input.position;
  if (position !== undefined && (!Number.isSafeInteger(position) || typeof position !== "number" || position < 1)) throw new Error("position must be a positive integer");
  return {
    ...(label !== undefined ? { label } : {}),
    ...(command !== undefined && command !== null ? { commandType: command.k, commandPayload: command } : {}),
    ...(optionalBoolean(input.enabled, "enabled") !== undefined ? { enabled: optionalBoolean(input.enabled, "enabled") } : {}),
    ...(position !== undefined ? { position } : {}),
  };
}

export class ShowService {
  constructor(private readonly db: PrismaClient) {}

  async createProduction(channelId: string, input: ProductionInput) {
    const data = productionData(input, true) as Prisma.ProductionUncheckedCreateInput;
    if (data.showConfigurationId) await this.requireConfiguration(channelId, data.showConfigurationId);
    return this.db.production.create({ data: { ...data, channelId } });
  }
  async updateProduction(id: string, input: ProductionInput) {
    const existing = await this.db.production.findUniqueOrThrow({ where: { id } });
    const data = productionData(input, false) as Prisma.ProductionUncheckedUpdateInput;
    if (data.showConfigurationId && typeof data.showConfigurationId === "string") await this.requireConfiguration(existing.channelId, data.showConfigurationId);
    return this.db.production.update({ where: { id }, data });
  }
  async copyConfigurationIntoProduction(id: string, configurationId: string) {
    const production = await this.db.production.findUniqueOrThrow({ where: { id } });
    const configuration = await this.requireConfiguration(production.channelId, configurationId);
    return this.db.production.update({ where: { id }, data: { showConfigurationId: configuration.id, configuration: configuration.configuration as Prisma.InputJsonValue } });
  }
  async duplicateProduction(id: string) {
    const source = await this.db.production.findUniqueOrThrow({ where: { id }, include: { rundowns: { include: { cues: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } } } });
    return this.db.$transaction(async (tx) => {
      const copy = await tx.production.create({ data: { channelId: source.channelId, title: `${source.title} (Copy)`, description: source.description, status: "draft", configuration: source.configuration === null ? undefined : source.configuration as Prisma.InputJsonValue, showConfigurationId: source.showConfigurationId } });
      for (const rundown of source.rundowns) {
        await tx.rundown.create({ data: { productionId: copy.id, name: rundown.name, version: 1, cues: { create: rundown.cues.map((cue) => ({ position: cue.position, label: cue.label, commandType: cue.commandType, commandPayload: cue.commandPayload as Prisma.InputJsonValue, enabled: cue.enabled })) } } });
      }
      return copy;
    });
  }
  async createRundown(productionId: string, input: RundownInput) { return this.db.rundown.create({ data: { productionId, name: requiredText(input.name, "rundown name") } }); }
  async updateRundown(id: string, input: RundownInput) { return this.db.rundown.update({ where: { id }, data: { ...(input.name === undefined ? {} : { name: requiredText(input.name, "rundown name") }) } }); }
  async duplicateRundown(id: string) {
    const source = await this.db.rundown.findUniqueOrThrow({ where: { id }, include: { cues: { orderBy: { position: "asc" } } } });
    return this.db.rundown.create({ data: { productionId: source.productionId, name: `${source.name} (Copy)`, version: 1, cues: { create: source.cues.map((cue) => ({ position: cue.position, label: cue.label, commandType: cue.commandType, commandPayload: cue.commandPayload as Prisma.InputJsonValue, enabled: cue.enabled })) } }, include: { cues: { orderBy: { position: "asc" } } } });
  }
  async createCue(rundownId: string, input: CueInput) {
    const data = cueData(input, true) as Prisma.RundownCueUncheckedCreateInput;
    return this.db.$transaction(async (tx) => {
      const cues = await tx.rundownCue.findMany({ where: { rundownId }, orderBy: { position: "asc" } });
      const position = Math.min(typeof data.position === "number" ? data.position : cues.length + 1, cues.length + 1);
      const reordered = [...cues];
      for (let index = 0; index < reordered.length; index += 1) await tx.rundownCue.update({ where: { id: reordered[index]!.id }, data: { position: -(index + 1) } });
      for (let index = 0; index < reordered.length; index += 1) {
        const nextPosition = index >= position - 1 ? index + 2 : index + 1;
        await tx.rundownCue.update({ where: { id: reordered[index]!.id }, data: { position: nextPosition } });
      }
      return tx.rundownCue.create({ data: { ...data, rundownId, position } });
    });
  }
  async updateCue(id: string, input: CueInput) {
    const cue = await this.db.rundownCue.findUniqueOrThrow({ where: { id } });
    const data = cueData(input, false) as Prisma.RundownCueUncheckedUpdateInput;
    if (data.position === undefined || data.position === cue.position) return this.db.rundownCue.update({ where: { id }, data });
    return this.reorderCue(cue.rundownId, id, data.position as number, data);
  }
  async reorder(rundownId: string, cueIds: unknown) {
    if (!Array.isArray(cueIds) || !cueIds.every((id) => typeof id === "string")) throw new Error("cueIds must be an array of cue ids");
    const cues = await this.db.rundownCue.findMany({ where: { rundownId }, select: { id: true }, orderBy: { position: "asc" } });
    if (cues.length !== cueIds.length || new Set(cueIds).size !== cueIds.length || cues.some((cue) => !cueIds.includes(cue.id))) throw new Error("cueIds must contain every cue exactly once");
    return this.db.$transaction(async (tx) => {
      for (let index = 0; index < cueIds.length; index += 1) await tx.rundownCue.update({ where: { id: cueIds[index] }, data: { position: -(index + 1) } });
      for (let index = 0; index < cueIds.length; index += 1) await tx.rundownCue.update({ where: { id: cueIds[index] }, data: { position: index + 1 } });
      return tx.rundownCue.findMany({ where: { rundownId }, orderBy: { position: "asc" } });
    });
  }
  async configurations(channelId: string) { return this.db.showConfiguration.findMany({ where: { channelId }, orderBy: { name: "asc" } }); }
  async createConfiguration(channelId: string, input: { name?: unknown; configuration?: unknown }) {
    const configuration = optionalConfiguration(input.configuration);
    if (!configuration) throw new Error("configuration is required");
    return this.db.showConfiguration.create({ data: { channelId, name: requiredText(input.name, "configuration name"), configuration } });
  }
  async updateConfiguration(id: string, input: { name?: unknown; configuration?: unknown }) {
    const configuration = optionalConfiguration(input.configuration);
    return this.db.showConfiguration.update({ where: { id }, data: { ...(input.name === undefined ? {} : { name: requiredText(input.name, "configuration name") }), ...(configuration === undefined ? {} : { configuration }) } });
  }
  private async reorderCue(rundownId: string, cueId: string, target: number, data: Prisma.RundownCueUncheckedUpdateInput) {
    const cues = await this.db.rundownCue.findMany({ where: { rundownId }, orderBy: { position: "asc" } });
    const ordered = cues.filter((cue) => cue.id !== cueId);
    ordered.splice(Math.min(target, ordered.length + 1) - 1, 0, cues.find((cue) => cue.id === cueId)!);
    await this.reorder(rundownId, ordered.map((cue) => cue.id));
    return this.db.rundownCue.update({ where: { id: cueId }, data: { ...data, position: Math.min(target, ordered.length) } });
  }
  private async requireConfiguration(channelId: string, id: string) {
    const configuration = await this.db.showConfiguration.findFirst({ where: { id, channelId } });
    if (!configuration) throw new Error("show configuration not found for channel");
    return configuration;
  }
}
