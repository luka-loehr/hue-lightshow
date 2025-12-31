//
//  HueBridge.swift
//  HueLightShowCreator
//
//  Bridge connection model
//

import Foundation

struct HueBridge: Codable {
    var ipAddress: String
    var username: String?
    var name: String?
    var authenticated: Bool
    
    init(ipAddress: String, username: String? = nil, name: String? = nil, authenticated: Bool = false) {
        self.ipAddress = ipAddress
        self.username = username
        self.name = name
        self.authenticated = authenticated
    }
    
    var baseURL: String? {
        guard let username = username else { return nil }
        return "http://\(ipAddress)/api/\(username)"
    }
}
