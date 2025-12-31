#!/usr/bin/env node

/**
 * Test script for Hue Bridge WiFi (SSDP) discovery
 * Run with: npx tsx test-hue-discovery.ts
 */

import dgram from "dgram";

interface HueBridge {
  id: string;
  internalipaddress: string;
  name?: string;
}

async function discoverViaSSDP(timeoutMs = 5000): Promise<HueBridge[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const deviceLocations: Map<string, string> = new Map();
    const verifiedBridges: HueBridge[] = [];
    const checkedIPs = new Set<string>();
    
    // SSDP M-SEARCH packet for UPnP discovery
    // Try without quotes in MAN header (some devices prefer this)
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
        deviceLocations.set(ip, location);
        
        // Check device description XML for Hue Bridge
        const isHueBridge = await checkDeviceDescription(location, ip);
        
        if (isHueBridge) {
          checkedIPs.add(ip);
          console.log(`\n✅ Potential Hue Bridge found at ${ip}`);
          console.log(`   Location: ${location}`);
          
          // Verify it's actually a Hue Bridge by checking the API
          console.log(`🔍 Verifying bridge at ${ip}...`);
          const verifiedBridge = await checkHueBridge(ip);
          
          if (verifiedBridge) {
            console.log(`✅ Verified Hue Bridge: ${verifiedBridge.name || 'Philips Hue'} (${ip})`);
            verifiedBridges.push(verifiedBridge);
          } else {
            console.log(`❌ Verification failed for ${ip}`);
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.error("❌ Socket error:", err);
    });

    socket.bind(() => {
      try {
        socket.addMembership('239.255.255.250');
        console.log("🔍 Sending SSDP M-SEARCH request...");
        socket.send(message, 0, message.length, 1900, "239.255.255.250");
        console.log("⏳ Scanning network for Hue Bridges (timeout: 5s)...");
        console.log("   (Checking device descriptions for Hue Bridge identifiers)\n");
      } catch (err) {
        console.error("❌ Failed to send SSDP request:", err);
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
      console.log(`\n📊 Discovery complete. Found ${verifiedBridges.length} bridge(s).\n`);
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
      
      if (isHueBridge) {
        console.log(`   ✅ Device description indicates Hue Bridge`);
        return true;
      }
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
          id: data.bridgeid || ip,
          internalipaddress: ip,
          name: data.name || "Philips Hue",
        };
      }
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error(`   ⚠️  Error checking ${ip}:`, e.message);
    }
  }
  return null;
}

// Main execution
async function main() {
  console.log("🚀 Starting Hue Bridge WiFi (SSDP) Discovery Test\n");
  console.log("=" .repeat(50));
  
  const bridges = await discoverViaSSDP(5000);
  
  if (bridges.length > 0) {
    console.log("\n✅ Discovered Bridges:");
    bridges.forEach((bridge, index) => {
      console.log(`\n${index + 1}. ${bridge.name || 'Philips Hue'}`);
      console.log(`   IP: ${bridge.internalipaddress}`);
      console.log(`   ID: ${bridge.id}`);
    });
  } else {
    console.log("\n❌ No Hue Bridges found on the network.");
    console.log("\nTroubleshooting:");
    console.log("  - Make sure your Hue Bridge is powered on");
    console.log("  - Ensure your computer is on the same WiFi network");
    console.log("  - Check firewall settings (UDP port 1900)");
    console.log("  - Try running with sudo (may need network permissions)");
  }
  
  console.log("\n" + "=".repeat(50));
  process.exit(bridges.length > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
