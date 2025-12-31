"use server";

import { HueBridge } from "./hue-service";
import dgram from "dgram";

export async function discoverBridgeAction(): Promise<HueBridge[]> {
  console.log("Starting Hue Bridge WiFi (SSDP) discovery...");
  
  try {
    const ssdpBridges = await discoverViaSSDP();
    if (ssdpBridges.length > 0) {
      console.log("Found bridges via SSDP:", ssdpBridges);
      return ssdpBridges;
    }
  } catch (e) {
    console.warn("SSDP discovery failed:", e);
  }

  return [];
}

async function discoverViaSSDP(timeoutMs = 5000): Promise<HueBridge[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const verifiedBridges: HueBridge[] = [];
    const checkedIPs = new Set<string>();
    
    // SSDP M-SEARCH packet for UPnP discovery
    // Use MAN without quotes (some devices prefer this)
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: ssdp:discover\r\n' +
      'MX: 3\r\n' +
      'ST: upnp:rootdevice\r\n' + 
      '\r\n'
    );

    socket.on("message", async (msg, rinfo) => {
      const response = msg.toString();
      const ip = rinfo.address;
      
      // Skip if we've already checked this IP
      if (checkedIPs.has(ip)) {
        return;
      }
      
      // Extract Location header from SSDP response
      const locationMatch = response.match(/Location:\s*(.+)/i);
      if (locationMatch) {
        const location = locationMatch[1].trim();
        
        // Check device description XML for Hue Bridge
        const isHueBridge = await checkDeviceDescription(location, ip);
        
        if (isHueBridge) {
          checkedIPs.add(ip);
          
          // Verify it's actually a Hue Bridge by checking the API
          const verifiedBridge = await checkHueBridge(ip);
          
          if (verifiedBridge) {
            verifiedBridges.push(verifiedBridge);
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.error("SSDP socket error:", err);
    });

    socket.bind(() => {
      try {
        socket.addMembership('239.255.255.250');
        socket.send(message, 0, message.length, 1900, "239.255.255.250");
      } catch (err) {
        console.error("Failed to send SSDP request:", err);
        socket.close();
        resolve([]);
      }
    });

    // Wait for responses
    setTimeout(() => {
      try {
        socket.close();
      } catch (e) {
        // Ignore close errors
      }
      resolve(verifiedBridges);
    }, timeoutMs);
  });
}

async function checkDeviceDescription(location: string, ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(location, {
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(id);
    
    if (response.ok) {
      const xml = await response.text();
      // Check for Hue Bridge identifiers in device description
      const isHueBridge = 
        xml.includes("IpBridge") ||
        xml.includes("Philips") ||
        xml.toLowerCase().includes("hue") ||
        xml.includes("hue-bridgeid") ||
        xml.includes("BSB002") || // Hue Bridge model ID
        xml.includes("BSB001");   // Older Hue Bridge model ID
      
      return isHueBridge;
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      // Silently fail - not all devices will have accessible XML
    }
  }
  return false;
}

async function checkHueBridge(ip: string, timeout = 3000): Promise<HueBridge | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`http://${ip}/api/config`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(id);

    if (response.status === 200) {
      const data = await response.json();
      if (data.name || data.modelid || data.swversion) {
        return {
          id: data.bridgeid || ip, // Fallback ID
          internalipaddress: ip,
          name: data.name || "Philips Hue",
        };
      }
    }
  } catch (e) {
    // Ignore fetch errors (timeouts, connection refused etc)
  }
  return null;
}

