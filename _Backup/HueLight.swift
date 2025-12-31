//
//  HueLight.swift
//  HueLightShowCreator
//
//  Hue light model with capabilities
//

import Foundation

struct HueLight: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var reachable: Bool
    var on: Bool
    var brightness: Int
    var capabilities: LightCapabilities
    
    init(id: String, name: String, reachable: Bool = true, on: Bool = false, brightness: Int = 254, capabilities: LightCapabilities = LightCapabilities()) {
        self.id = id
        self.name = name
        self.reachable = reachable
        self.on = on
        self.brightness = brightness
        self.capabilities = capabilities
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: HueLight, rhs: HueLight) -> Bool {
        lhs.id == rhs.id
    }
}

struct LightCapabilities: Codable {
    var supportsColor: Bool
    var supportsColorTemperature: Bool
    var supportsBrightness: Bool
    var minBrightness: Int
    var maxBrightness: Int
    var minColorTemperature: Int
    var maxColorTemperature: Int
    
    init(
        supportsColor: Bool = true,
        supportsColorTemperature: Bool = true,
        supportsBrightness: Bool = true,
        minBrightness: Int = 1,
        maxBrightness: Int = 254,
        minColorTemperature: Int = 153,
        maxColorTemperature: Int = 500
    ) {
        self.supportsColor = supportsColor
        self.supportsColorTemperature = supportsColorTemperature
        self.supportsBrightness = supportsBrightness
        self.minBrightness = minBrightness
        self.maxBrightness = maxBrightness
        self.minColorTemperature = minColorTemperature
        self.maxColorTemperature = maxColorTemperature
    }
}
