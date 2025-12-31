import { useHueStore } from "@/stores/hue-store";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HueService } from "@/lib/hue-service";
import { Loader2, RefreshCw, Lightbulb, LightbulbOff } from "lucide-react";
import { DraggableMediaItem } from "@/components/ui/draggable-item";
import { LightElement, LightItemDragData } from "@/types/timeline";

export function LightsView() {
  const { 
    bridge, 
    lights, 
    isConnected, 
    isAuthenticating, 
    isAuthenticated,
    error,
    connect, 
    authenticate, 
    loadSavedConnection, 
    disconnect,
    setLightState
  } = useHueStore();

  const [discoveredBridges, setDiscoveredBridges] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [hasAttemptedDiscovery, setHasAttemptedDiscovery] = useState(false);

  useEffect(() => {
    loadSavedConnection();
  }, []);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setHasAttemptedDiscovery(false);
    const bridges = await HueService.discoverBridge();
    setDiscoveredBridges(bridges);
    setIsDiscovering(false);
    setHasAttemptedDiscovery(true);
  };

  const handleConnect = async (bridge: any) => {
    await connect(bridge);
  };

  const toggleLight = async (id: string, currentState: boolean) => {
    await setLightState(id, { on: !currentState });
  };

  if (!isConnected) {
    return (
      <div className="h-full p-4 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Connect Hue Bridge</h2>
          <p className="text-sm text-muted-foreground">
            Connect to your Philips Hue Bridge to control lights.
          </p>
        </div>

        {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20">
                {error}
            </div>
        )}

        <div className="space-y-2">
            <h3 className="text-sm font-medium">Automatic Discovery</h3>
            <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleDiscover} 
                disabled={isDiscovering}
            >
                {isDiscovering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Discover Bridges
            </Button>
            {hasAttemptedDiscovery && discoveredBridges.length === 0 && (
                <div className="p-3 text-sm text-center text-muted-foreground bg-muted/50 rounded-md border border-border">
                    No Hue Bridges found. Try manual connection.
                </div>
            )}
        </div>

        {discoveredBridges.length > 0 && (
            <div className="space-y-2">
                {discoveredBridges.map(b => (
                    <Card key={b.id} className="p-3 flex items-center justify-between cursor-pointer hover:bg-accent" onClick={() => handleConnect(b)}>
                        <div className="text-sm">
                            <div className="font-medium">{b.name || "Hue Bridge"} ({b.internalipaddress})</div>
                            <div className="text-xs text-muted-foreground">ID: {b.id}</div>
                        </div>
                        <Button size="sm">Connect</Button>
                    </Card>
                ))}
            </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
      return (
          <div className="h-full p-4 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold">Link Bridge</h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                  Press the large button on your Hue Bridge, then click Authenticate below.
              </p>
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                    {error}
                </div>
               )}
              <Button onClick={authenticate} disabled={isAuthenticating}>
                  {isAuthenticating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Authenticate
              </Button>
              <Button variant="text" size="sm" onClick={disconnect}>
                  Cancel
              </Button>
          </div>
      )
  }

  return (
    <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm z-10">
            <h2 className="font-semibold">Lights ({lights.length})</h2>
            <div className="flex gap-2">
                <Button variant="text" size="icon" onClick={() => useHueStore.getState().fetchLights()}>
                    <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="text" size="icon" onClick={disconnect}>
                    <LightbulbOff className="w-4 h-4 text-red-500" />
                </Button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {lights.map(light => (
                <DraggableMediaItem
                    key={light.id}
                    name={light.name}
                    variant="card"
                    isDraggable={true}
                    dragData={{
                        id: light.id,
                        type: "light",
                        name: light.name,
                        color: light.state.on ? '#fbbf24' : '#71717a', // yellow-400 or zinc-500
                        brightness: light.state.bri,
                    } as LightItemDragData}
                    containerClassName="w-full h-auto"
                    className="p-0 border-0"
                    showPlusOnDrag={true}
                    preview={
                        <Card className="p-3 transition-colors hover:bg-accent/50 w-full">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div 
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${light.state.on ? 'bg-yellow-400 text-yellow-950 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-muted text-muted-foreground'}`}
                                >
                                    <Lightbulb className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium">{light.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {light.state.on ? `${Math.round((light.state.bri / 254) * 100)}% Brightness` : 'Off'}
                                    </span>
                                </div>
                            </div>
                            <Button 
                                variant={light.state.on ? "default" : "outline"} 
                                size="sm"
                                className={light.state.on ? "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600" : ""}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleLight(light.id, light.state.on);
                                }}
                            >
                                {light.state.on ? "On" : "Off"}
                            </Button>
                        </div>
                    </Card>
                    }
                />
            ))}
            {lights.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    No lights found. Check your Hue app.
                </div>
            )}
        </div>
    </div>
  );
}
