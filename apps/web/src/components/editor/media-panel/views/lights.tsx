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
  const [waitingForButtonPress, setWaitingForButtonPress] = useState(false);

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
    setWaitingForButtonPress(true);
    await connect(bridge);
  };

  const handleConfirmButtonPressed = async () => {
    await authenticate();
  };

  // Reset waiting state when authentication completes (success or failure)
  useEffect(() => {
    if (isAuthenticated) {
      setWaitingForButtonPress(false);
    }
  }, [isAuthenticated]);

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
                    No Hue Bridges found on your network.
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

  // Show instruction screen when waiting for button press
  if (waitingForButtonPress && !isAuthenticated) {
    return (
      <div className="h-full p-4 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
          <Lightbulb className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-bold">Press the Bridge Button</h2>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Locate your Hue Bridge and press the large circular button on top of it. This will enable pairing mode.
        </p>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md max-w-[280px]">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <Button 
            onClick={handleConfirmButtonPressed} 
            disabled={isAuthenticating}
            className="w-full"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "I've Pressed the Button"
            )}
          </Button>
          <Button 
            variant="text" 
            size="sm" 
            onClick={() => {
              setWaitingForButtonPress(false);
              disconnect();
            }}
            disabled={isAuthenticating}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !waitingForButtonPress) {
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
    );
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
        <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                            color: light.state.on ? '#fbbf24' : '#71717a',
                            brightness: light.state.bri,
                        } as LightItemDragData}
                        containerClassName="w-full"
                        className="p-0 border-0"
                        showPlusOnDrag={true}
                        showLabel={false}
                        preview={
                            <div
                                className={`
                                    aspect-square rounded-md border-2 transition-all cursor-pointer
                                    relative flex flex-col items-center justify-center p-2
                                    ${light.state.on 
                                        ? 'bg-yellow-400 border-yellow-500 text-yellow-950 shadow-[0_0_8px_rgba(250,204,21,0.4)]' 
                                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:border-border/80'
                                    }
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleLight(light.id, light.state.on);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleLight(light.id, light.state.on);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex flex-col items-center justify-center gap-2 flex-1">
                                    <Lightbulb 
                                        className={`w-6 h-6 flex-shrink-0 ${light.state.on ? 'text-yellow-950' : 'text-muted-foreground'}`}
                                    />
                                    <span 
                                        className="text-xs font-medium text-center w-full overflow-hidden text-ellipsis whitespace-nowrap px-1"
                                        style={{ maxWidth: '100%' }}
                                    >
                                        {light.name}
                                    </span>
                                </div>
                            </div>
                        }
                    />
                ))}
            </div>
            {lights.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    No lights found. Check your Hue app.
                </div>
            )}
        </div>
    </div>
  );
}
