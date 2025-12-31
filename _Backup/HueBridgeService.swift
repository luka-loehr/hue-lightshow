//
//  HueBridgeService.swift
//  HueLightShowCreator
//
//  Native Hue Bridge discovery and API service
//

import Foundation
import Network
import Combine
import Darwin

@MainActor
class HueBridgeService: ObservableObject {
    @Published var bridge: HueBridge?
    @Published var lights: [HueLight] = []
    @Published var isDiscovering = false
    @Published var isAuthenticating = false
    @Published var errorMessage: String?
    
    private var discoveryTask: Task<Void, Never>?
    private let session = URLSession.shared
    
    init() {
        // Try to load saved bridge configuration
        loadSavedBridge()
    }
    
    // MARK: - Bridge Discovery
    
    func discoverBridge() async {
        isDiscovering = true
        errorMessage = nil
        
        // Method 1: Try Philips cloud discovery service
        if let bridge = await discoverViaCloud() {
            self.bridge = bridge
            isDiscovering = false
            await getLights()
            return
        }
        
        // Method 2: SSDP/UPnP discovery
        if let bridge = await discoverViaSSDP() {
            self.bridge = bridge
            isDiscovering = false
            await getLights()
            return
        }
        
        // Method 3: Network scan
        if let bridge = await discoverViaNetworkScan() {
            self.bridge = bridge
            isDiscovering = false
            await getLights()
            return
        }
        
        isDiscovering = false
        errorMessage = "Bridge not found. Please check your network connection."
    }
    
    private func discoverViaCloud() async -> HueBridge? {
        guard let url = URL(string: "https://discovery.meethue.com/") else { return nil }
        
        do {
            let (data, response) = try await session.data(from: url)
            
            // Check if we got a valid response
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  !data.isEmpty else {
                return nil
            }
            
            // Try to decode the response
            let bridges = try JSONDecoder().decode([[String: String]].self, from: data)
            
            if let bridgeData = bridges.first,
               let ipAddress = bridgeData["internalipaddress"],
               !ipAddress.isEmpty {
                return HueBridge(ipAddress: ipAddress)
            }
        } catch {
            // Silently fail - cloud discovery is optional
            // Other discovery methods will be tried
        }
        
        return nil
    }
    
    private func discoverViaSSDP() async -> HueBridge? {
        // SSDP multicast address and port
        let ssdpAddr = "239.255.255.250"
        let ssdpPort: UInt16 = 1900
        let ssdpMX = 3
        
        // Create SSDP discovery message
        let ssdpRequest = """
        M-SEARCH * HTTP/1.1\r
        HOST: \(ssdpAddr):\(ssdpPort)\r
        MAN: "ssdp:discover"\r
        MX: \(ssdpMX)\r
        ST: ssdp:all\r
        \r
        """
        
        // Create UDP socket
        var sockfd: Int32 = -1
        
        // Create socket
        sockfd = socket(AF_INET, SOCK_DGRAM, 0)
        guard sockfd >= 0 else { return nil }
        defer { close(sockfd) }
        
        // Set socket options
        var reuse: Int32 = 1
        setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
        
        // Set timeout
        var timeout = timeval(tv_sec: Int(ssdpMX + 1), tv_usec: 0)
        setsockopt(sockfd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        
        // Setup multicast address
        var multicastAddr = sockaddr_in()
        multicastAddr.sin_family = sa_family_t(AF_INET)
        multicastAddr.sin_port = ssdpPort.bigEndian
        inet_pton(AF_INET, ssdpAddr, &multicastAddr.sin_addr)
        
        // Send multicast discovery
        let requestData = ssdpRequest.data(using: .utf8)!
        requestData.withUnsafeBytes { bytes in
            withUnsafePointer(to: &multicastAddr) { addrPtr in
                let sockaddrPtr = UnsafeRawPointer(addrPtr).assumingMemoryBound(to: sockaddr.self)
                sendto(sockfd, bytes.baseAddress, bytes.count, 0, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        
        // Listen for responses
        let startTime = Date()
        let timeoutInterval = TimeInterval(ssdpMX + 1)
        
        while Date().timeIntervalSince(startTime) < timeoutInterval {
            var buffer = [UInt8](repeating: 0, count: 1024)
            var fromAddr = sockaddr_in()
            let fromLen: socklen_t = socklen_t(MemoryLayout<sockaddr_in>.size)
            
            var len = fromLen
            let bytesReceived = withUnsafeMutablePointer(to: &fromAddr) { addrPtr in
                let sockaddrPtr = UnsafeMutableRawPointer(addrPtr).assumingMemoryBound(to: sockaddr.self)
                return recvfrom(sockfd, &buffer, buffer.count, 0, sockaddrPtr, &len)
            }
            
            guard bytesReceived > 0 else {
                // Timeout or error, continue waiting
                continue
            }
            
            // Convert response to string
            if let response = String(data: Data(buffer.prefix(bytesReceived)), encoding: .utf8) {
                // Check if it's a Hue Bridge response
                let lowerResponse = response.lowercased()
                if response.contains("IpBridge") || response.contains("Philips") || lowerResponse.contains("hue") {
                    // Extract IP address
                    var ipString = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                    inet_ntop(AF_INET, &fromAddr.sin_addr, &ipString, socklen_t(INET_ADDRSTRLEN))
                    let ip = String(cString: ipString)
                    
                    // Verify it's actually a Hue Bridge
                    if await checkHueBridge(at: ip) {
                        return HueBridge(ipAddress: ip)
                    }
                }
            }
        }
        
        return nil
    }
    
    private func discoverViaNetworkScan() async -> HueBridge? {
        // Network scan with timeout - check common IP ranges
        guard let localIP = getLocalIP() else { return nil }
        let baseIP = localIP.components(separatedBy: ".").dropLast().joined(separator: ".")
        
        return await withTaskGroup(of: HueBridge?.self) { group in
            // Add tasks for all IPs in range
            for i in 1...254 {
                let ip = "\(baseIP).\(i)"
                group.addTask {
                    // Use shorter timeout for network scan (0.5 seconds like Python)
                    if await self.checkHueBridge(at: ip, timeout: 0.5) {
                        return HueBridge(ipAddress: ip)
                    }
                    return nil
                }
            }
            
            // Wait for first result with overall timeout
            let startTime = Date()
            let overallTimeout: TimeInterval = 10.0 // 10 second overall timeout like Python
            
            for await result in group {
                if Date().timeIntervalSince(startTime) > overallTimeout {
                    group.cancelAll()
                    break
                }
                
                if let bridge = result {
                    group.cancelAll()
                    return bridge
                }
            }
            
            return nil
        }
    }
    
    func checkHueBridge(at ip: String, timeout: TimeInterval = 1.0) async -> Bool {
        guard let url = URL(string: "http://\(ip)/api/config") else { return false }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = timeout
        
        do {
            let (data, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                // Check for valid status code
                guard httpResponse.statusCode == 200 || httpResponse.statusCode == 401 else {
                    return false
                }
                
                // Verify it's actually a Hue Bridge by checking response content
                if httpResponse.statusCode == 200,
                   let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // Hue bridges have specific identifiers
                    return config["name"] != nil || config["modelid"] != nil || config["swversion"] != nil
                }
                
                return true // 401 means it's a bridge but not authenticated
            }
        } catch {
            // Not a Hue bridge or timeout
        }
        
        return false
    }
    
    private func getLocalIP() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        guard getifaddrs(&ifaddr) == 0 else { return nil }
        guard let firstAddr = ifaddr else { return nil }
        
        for ifptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
            let interface = ifptr.pointee
            let addrFamily = interface.ifa_addr.pointee.sa_family
            
            if addrFamily == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)
                if name == "en0" || name.hasPrefix("en") {
                    var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                               &hostname, socklen_t(hostname.count),
                               nil, socklen_t(0), NI_NUMERICHOST)
                    address = String(cString: hostname)
                    break
                }
            }
        }
        
        freeifaddrs(ifaddr)
        return address
    }
    
    // MARK: - Authentication
    
    func authenticate(deviceName: String = "HueLightShowCreator") async -> Bool {
        guard let bridge = bridge else { return false }
        isAuthenticating = true
        errorMessage = nil
        
        let urlString = "http://\(bridge.ipAddress)/api"
        guard let url = URL(string: urlString) else {
            isAuthenticating = false
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload = ["devicetype": deviceName]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        do {
            let (data, _) = try await session.data(for: request)
            if let response = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
               let result = response.first,
               let success = result["success"] as? [String: String],
               let username = success["username"] {
                
                var authenticatedBridge = bridge
                authenticatedBridge.username = username
                authenticatedBridge.authenticated = true
                self.bridge = authenticatedBridge
                
                saveBridge()
                isAuthenticating = false
                await getLights()
                return true
            } else if let response = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                      let result = response.first,
                      let error = result["error"] as? [String: Any],
                      let errorType = error["type"] as? Int {
                
                if errorType == 101 {
                    errorMessage = "Please press the button on your Hue Bridge, then try again."
                } else {
                    errorMessage = error["description"] as? String ?? "Authentication failed"
                }
            }
        } catch {
            errorMessage = "Authentication error: \(error.localizedDescription)"
        }
        
        isAuthenticating = false
        return false
    }
    
    // MARK: - Light Management
    
    func getLights() async {
        guard let bridge = bridge,
              let _ = bridge.username,
              let baseURL = bridge.baseURL else { return }
        
        guard let url = URL(string: "\(baseURL)/lights") else { return }
        
        do {
            let (data, _) = try await session.data(from: url)
            if let lightsDict = try JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] {
                var lights: [HueLight] = []
                
                for (id, lightData) in lightsDict {
                    let name = lightData["name"] as? String ?? "Unknown"
                    let state = lightData["state"] as? [String: Any] ?? [:]
                    let reachable = state["reachable"] as? Bool ?? false
                    let on = state["on"] as? Bool ?? false
                    let brightness = state["bri"] as? Int ?? 254
                    
                    // Determine capabilities
                    let colormode = state["colormode"] as? String
                    let supportsColor = colormode != nil && colormode != "none"
                    let supportsCT = state["ct"] != nil
                    
                    let capabilities = LightCapabilities(
                        supportsColor: supportsColor,
                        supportsColorTemperature: supportsCT,
                        supportsBrightness: true
                    )
                    
                    let light = HueLight(
                        id: id,
                        name: name,
                        reachable: reachable,
                        on: on,
                        brightness: brightness,
                        capabilities: capabilities
                    )
                    
                    lights.append(light)
                }
                
                self.lights = lights.sorted { $0.name < $1.name }
            }
        } catch {
            errorMessage = "Failed to get lights: \(error.localizedDescription)"
        }
    }
    
    func setLightState(_ lightID: String, state: [String: Any]) async -> Bool {
        guard let bridge = bridge,
              let baseURL = bridge.baseURL else { return false }
        
        guard let url = URL(string: "\(baseURL)/lights/\(lightID)/state") else { return false }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: state)
        
        do {
            let (_, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
        } catch {
            errorMessage = "Failed to set light state: \(error.localizedDescription)"
        }
        
        return false
    }
    
    // MARK: - Persistence

    /// Saves the bridge configuration to disk
    /// This includes the IP address, authentication token (username), and bridge name
    /// The configuration is stored in ~/Library/Application Support/HueLightShowCreator/bridge_config.json
    /// This allows the app to automatically reconnect on next launch without re-authentication
    private func saveBridge() {
        guard let bridge = bridge else { return }
        let config = [
            "ipAddress": bridge.ipAddress,
            "username": bridge.username ?? "",
            "name": bridge.name ?? ""
        ]

        if let data = try? JSONSerialization.data(withJSONObject: config),
           let url = getConfigURL() {
            try? data.write(to: url)
        }
    }

    /// Loads the saved bridge configuration from disk
    /// Called automatically during initialization
    /// If a valid configuration is found, it will attempt to reconnect and fetch lights
    private func loadSavedBridge() {
        guard let url = getConfigURL(),
              let data = try? Data(contentsOf: url),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let ipAddress = config["ipAddress"] else { return }

        let username = config["username"]?.isEmpty == false ? config["username"] : nil
        let name = config["name"]?.isEmpty == false ? config["name"] : nil

        bridge = HueBridge(
            ipAddress: ipAddress,
            username: username,
            name: name,
            authenticated: username != nil
        )

        Task {
            await getLights()
        }
    }

    /// Disconnects from the bridge and removes all saved configuration
    /// This will require the user to reconnect and re-authenticate on next use
    func disconnect() {
        // Clear bridge and lights
        bridge = nil
        lights = []
        errorMessage = nil

        // Delete saved configuration
        if let url = getConfigURL() {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func getConfigURL() -> URL? {
        let fileManager = FileManager.default
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }

        let appFolder = appSupport.appendingPathComponent("HueLightShowCreator", isDirectory: true)
        try? fileManager.createDirectory(at: appFolder, withIntermediateDirectories: true)

        return appFolder.appendingPathComponent("bridge_config.json")
    }
}

// Required for network interfaces
#if canImport(ifaddrs)
import ifaddrs
#endif

#if canImport(Foundation)
import Foundation
#endif
