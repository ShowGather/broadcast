import type { AdminRoute } from "../routing.js";
import type { Channel, Production, Rundown } from "../types.js";

interface AdminContextProps {
  route: AdminRoute;
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  channelId: string;
  productionId: string;
  rundownId: string;
  productionSwitchLocked: boolean;
  selectionError: string;
  onChannelChange: (channelId: string) => void;
  onProductionChange: (productionId: string) => void;
  onRundownChange: (rundownId: string) => void;
}

export function AdminContext({
  route,
  channels,
  productions,
  rundowns,
  channelId,
  productionId,
  rundownId,
  productionSwitchLocked,
  selectionError,
  onChannelChange,
  onProductionChange,
  onRundownChange,
}: AdminContextProps) {
  const isProductionsHome = route.workspace === "productions";
  if (isProductionsHome) return null;

  const workspace = route.workspace;
  const selectedProduction = productions.find(
    (p) => p.id === productionId,
  );

  return (
    <section className="section admin-context">
      <h2>
        {route.workspace === "productions"
          ? "Choose a production"
          : `${workspace} · ${selectedProduction?.title ?? "Loading production"}`}
      </h2>
      <div className="form">
        <label>
          <span>Channel</span>
          <select
            disabled={productionSwitchLocked}
            value={channelId}
            onChange={(event) => onChannelChange(event.target.value)}
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Production</span>
          <select
            disabled={productionSwitchLocked}
            value={productionId}
            onChange={(event) => {
              onProductionChange(event.target.value);
            }}
          >
            {productions.map((production) => (
              <option key={production.id} value={production.id}>
                {production.title}
              </option>
            ))}
          </select>
        </label>
        {route.workspace !== "productions" && (
          <label>
            <span>Rundown</span>
            <select
              disabled={productionSwitchLocked}
              value={rundownId}
              onChange={(event) => onRundownChange(event.target.value)}
            >
              {rundowns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {productionSwitchLocked && (
        <p className="hint">
          Production context is locked for this active live session. Complete
          or abandon the session before switching.
        </p>
      )}
      {selectionError && (
        <p className="error-msg" role="alert">
          {selectionError}
        </p>
      )}
    </section>
  );
}
