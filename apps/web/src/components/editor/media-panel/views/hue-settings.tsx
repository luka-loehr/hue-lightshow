import { useHueStore } from "@/stores/hue-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PropertyItem, PropertyItemLabel, PropertyItemValue } from "../../properties-panel/property-item";
import { Lightbulb, Wifi, Link2, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function HueSettings() {
    const { 
        bridge, 
        isConnected, 
        isAuthenticated, 
        disconnect, 
        lights
    } = useHueStore();

    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const handleDisconnect = () => {
        setIsDisconnecting(true);
        disconnect();
        toast.info("Disconnected from Hue Bridge");
        setIsDisconnecting(false);
    };

    if (!isConnected || !bridge) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
                <div className="p-4 rounded-full bg-muted">
                    <Link2Off className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">No Bridge Connected</h3>
                    <p className="text-sm text-muted-foreground">
                        Connect to a Philips Hue Bridge in the Lights panel to configure settings.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-1">
            <div className="flex flex-col gap-4">
                 <PropertyItem direction="column">
                    <PropertyItemLabel>Bridge IP Address</PropertyItemLabel>
                    <PropertyItemValue>
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 w-full">
                            <Wifi className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-mono">{bridge.internalipaddress}</span>
                        </div>
                    </PropertyItemValue>
                </PropertyItem>

                <PropertyItem direction="column">
                    <PropertyItemLabel>Bridge ID</PropertyItemLabel>
                    <PropertyItemValue>
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 w-full">
                            <span className="text-sm font-mono">{bridge.id}</span>
                        </div>
                    </PropertyItemValue>
                </PropertyItem>

                <PropertyItem direction="column">
                    <PropertyItemLabel>Connection Status</PropertyItemLabel>
                    <PropertyItemValue>
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className="text-sm">
                                {isAuthenticated ? "Connected & Authenticated" : "Connected (Login Required)"}
                            </span>
                        </div>
                    </PropertyItemValue>
                </PropertyItem>

                <PropertyItem direction="column">
                    <PropertyItemLabel>Controlled Lights</PropertyItemLabel>
                    <PropertyItemValue>
                        <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{lights.length} lights found</span>
                        </div>
                    </PropertyItemValue>
                </PropertyItem>

                <div className="pt-4">
                    <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                    >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect Bridge"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        This will remove the saved connection. You will need to press the Link button on the bridge to reconnect.
                    </p>
                </div>
            </div>
        </div>
    );
}
