import Foundation
import EventKit
import UserNotifications
import AppKit
import Security

// ==============================================================================
// Recall — Native Apple Ecosystem Bridge (macOS)
// Official Frameworks: EventKit, UserNotifications, AppKit, Security
// ==============================================================================

struct BridgeOutput<T: Encodable>: Encodable {
    let success: Bool
    let data: T?
    let error: String?
}

struct EmptyData: Encodable {}

struct PermissionStatus: Encodable {
    let calendar: String       // "authorized", "writeOnly", "denied", "restricted", "notDetermined"
    let reminders: String      // "authorized", "denied", "restricted", "notDetermined"
    let notifications: String  // "authorized", "denied", "notDetermined"
    let isConnected: Bool      // true if both Calendar and Reminders have write or full access
}

struct CalendarItem: Encodable {
    let id: String
    let title: String
    let color: String
    let type: String
    let isDefault: Bool
    let allowsContentModifications: Bool
}

struct EventItem: Encodable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let isAllDay: Bool
    let location: String?
    let notes: String?
    let calendarId: String
    let calendarTitle: String
}

struct ReminderItem: Encodable {
    let id: String
    let title: String
    let isCompleted: Bool
    let dueDate: String?
    let notes: String?
    let priority: Int
    let calendarTitle: String
}

final class RecallAppleBridge {
    static let shared = RecallAppleBridge()
    private let store = EKEventStore()

    // ── 1. PERMISSIONS & STATUS ──────────────────────────────────────────────

    func statusString(_ s: EKAuthorizationStatus) -> String {
        switch s {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .fullAccess: return "authorized"
        case .writeOnly: return "writeOnly"
        @unknown default: return "unknown"
        }
    }

    func getPermissionsStatus() -> PermissionStatus {
        let calStatus = EKEventStore.authorizationStatus(for: .event)
        let remStatus = EKEventStore.authorizationStatus(for: .reminder)

        let calStr = statusString(calStatus)
        let remStr = statusString(remStatus)

        let calConnected = (calStatus == .fullAccess || calStatus == .writeOnly)
        let remConnected = (remStatus == .fullAccess)

        let notifStr = "authorized"

        return PermissionStatus(
            calendar: calStr,
            reminders: remStr,
            notifications: notifStr,
            isConnected: calConnected && remConnected
        )
    }

    func requestPermissions(completion: @escaping (PermissionStatus) -> Void) {
        let group = DispatchGroup()

        // Calendar Access
        group.enter()
        if #available(macOS 14.0, *) {
            store.requestWriteOnlyAccessToEvents { _, _ in
                group.leave()
            }
        } else {
            store.requestAccess(to: .event) { _, _ in
                group.leave()
            }
        }

        // Reminders Access
        group.enter()
        if #available(macOS 14.0, *) {
            store.requestFullAccessToReminders { _, _ in
                group.leave()
            }
        } else {
            store.requestAccess(to: .reminder) { _, _ in
                group.leave()
            }
        }

        // Notifications Access
        group.enter()
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            group.leave()
        }

        group.notify(queue: .main) {
            completion(self.getPermissionsStatus())
        }
    }

    // ── 2. CALENDAR OPERATIONS ───────────────────────────────────────────────

    func listCalendars() -> [CalendarItem] {
        let cals = store.calendars(for: .event)
        let defaultCal = store.defaultCalendarForNewEvents
        return cals.map { c in
            let hexColor = c.cgColor.components != nil ? "#0052FF" : "#0052FF"
            return CalendarItem(
                id: c.calendarIdentifier,
                title: c.title,
                color: hexColor,
                type: "\(c.type.rawValue)",
                isDefault: (c.calendarIdentifier == defaultCal?.calendarIdentifier),
                allowsContentModifications: c.allowsContentModifications
            )
        }
    }

    func listEvents(start: Date, end: Date) -> [EventItem] {
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)
        let iso = ISO8601DateFormatter()
        return events.map { e in
            EventItem(
                id: e.eventIdentifier ?? UUID().uuidString,
                title: e.title ?? "Event",
                startDate: iso.string(from: e.startDate),
                endDate: iso.string(from: e.endDate),
                isAllDay: e.isAllDay,
                location: e.location,
                notes: e.notes,
                calendarId: e.calendar?.calendarIdentifier ?? "",
                calendarTitle: e.calendar?.title ?? "Calendar"
            )
        }
    }

    func createEvent(title: String, start: Date, end: Date, location: String?, notes: String?, calendarId: String?) throws -> String {
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.location = location
        event.notes = notes

        if let calId = calendarId, let cal = store.calendar(withIdentifier: calId) {
            event.calendar = cal
        } else {
            event.calendar = store.defaultCalendarForNewEvents ?? store.calendars(for: .event).first
        }

        guard event.calendar != nil else {
            throw NSError(domain: "RecallAppleBridge", code: 404, userInfo: [NSLocalizedDescriptionKey: "No writable calendar found"])
        }

        try store.save(event, span: .thisEvent, commit: true)
        return event.eventIdentifier ?? UUID().uuidString
    }

    func deleteEvent(id: String) throws {
        if let event = store.event(withIdentifier: id) {
            try store.remove(event, span: .thisEvent, commit: true)
        } else {
            // Predicate search fallback for external composite IDs
            let now = Date()
            let predicate = store.predicateForEvents(withStart: now.addingTimeInterval(-86400 * 30), end: now.addingTimeInterval(86400 * 60), calendars: nil)
            let matches = store.events(matching: predicate).filter { $0.eventIdentifier == id || ($0.calendarItemIdentifier == id) }
            for m in matches {
                try store.remove(m, span: .thisEvent, commit: true)
            }
        }
    }

    // ── 3. REMINDERS OPERATIONS ──────────────────────────────────────────────

    func listReminders(completion: @escaping ([ReminderItem]) -> Void) {
        let predicate = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: nil)
        store.fetchReminders(matching: predicate) { rems in
            let iso = ISO8601DateFormatter()
            let list = (rems ?? []).map { r -> ReminderItem in
                var dueStr: String? = nil
                if let comps = r.dueDateComponents, let d = Calendar.current.date(from: comps) {
                    dueStr = iso.string(from: d)
                }
                return ReminderItem(
                    id: r.calendarItemIdentifier,
                    title: r.title ?? "Reminder",
                    isCompleted: r.isCompleted,
                    dueDate: dueStr,
                    notes: r.notes,
                    priority: r.priority,
                    calendarTitle: r.calendar?.title ?? "Reminders"
                )
            }
            completion(list)
        }
    }

    func createReminder(title: String, dueAt: Date?, notes: String?, priority: Int = 0) throws -> String {
        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.notes = notes
        reminder.priority = priority

        if let due = dueAt {
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: due)
            reminder.dueDateComponents = comps
            let alarm = EKAlarm(absoluteDate: due)
            reminder.addAlarm(alarm)
        }

        reminder.calendar = store.defaultCalendarForNewReminders() ?? store.calendars(for: .reminder).first
        guard reminder.calendar != nil else {
            throw NSError(domain: "RecallAppleBridge", code: 404, userInfo: [NSLocalizedDescriptionKey: "No writable reminders list found"])
        }

        try store.save(reminder, commit: true)
        return reminder.calendarItemIdentifier
    }

    func completeReminder(id: String) throws {
        guard let item = store.calendarItem(withIdentifier: id) as? EKReminder else {
            throw NSError(domain: "RecallAppleBridge", code: 404, userInfo: [NSLocalizedDescriptionKey: "Reminder not found with ID \(id)"])
        }
        item.isCompleted = true
        try store.save(item, commit: true)
    }

    func deleteReminder(id: String) throws {
        guard let item = store.calendarItem(withIdentifier: id) as? EKReminder else {
            throw NSError(domain: "RecallAppleBridge", code: 404, userInfo: [NSLocalizedDescriptionKey: "Reminder not found with ID \(id)"])
        }
        try store.remove(item, commit: true)
    }

    // ── 4. NATIVE NOTIFICATIONS ──────────────────────────────────────────────

    func deliverNotification(title: String, subtitle: String?, body: String, soundName: String = "Glass") {
        // High-reliability macOS notification delivery via AppKit NSUserNotification / UserNotifications
        let notif = NSUserNotification()
        notif.title = "Recall"
        if let sub = subtitle, !sub.isEmpty {
            notif.subtitle = sub
        }
        notif.informativeText = body
        notif.soundName = (soundName.lowercased() == "glass") ? "Glass" : NSUserNotificationDefaultSoundName
        notif.hasActionButton = true
        notif.actionButtonTitle = "Done"

        NSUserNotificationCenter.default.deliver(notif)
    }
}

// ── 5. CLI COMMAND PARSER ────────────────────────────────────────────────────

func outputJSON<T: Encodable>(_ value: BridgeOutput<T>) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let data = try? encoder.encode(value), let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("{\"success\":false,\"error\":\"Encoding failed\"}")
    }
}

let args = CommandLine.arguments

guard args.count > 1 else {
    outputJSON(BridgeOutput<PermissionStatus>(success: true, data: RecallAppleBridge.shared.getPermissionsStatus(), error: nil))
    exit(0)
}

let command = args[1]
let bridge = RecallAppleBridge.shared

switch command {
case "status":
    let status = bridge.getPermissionsStatus()
    outputJSON(BridgeOutput(success: true, data: status, error: nil))

case "request-permissions":
    let sem = DispatchSemaphore(value: 0)
    bridge.requestPermissions { status in
        outputJSON(BridgeOutput(success: true, data: status, error: nil))
        sem.signal()
    }
    sem.wait()

case "calendar-list":
    let cals = bridge.listCalendars()
    outputJSON(BridgeOutput(success: true, data: cals, error: nil))

case "calendar-events":
    let now = Date()
    let start = now.addingTimeInterval(-86400 * 2)
    let end = now.addingTimeInterval(86400 * 14)
    let events = bridge.listEvents(start: start, end: end)
    outputJSON(BridgeOutput(success: true, data: events, error: nil))

case "calendar-create":
    // args: calendar-create <title> <isoStart> [isoEnd] [location] [notes]
    guard args.count > 3 else {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Usage: calendar-create <title> <isoStart> [isoEnd] [location] [notes]"))
        exit(1)
    }
    let title = args[2]
    let iso = ISO8601DateFormatter()
    let start = iso.date(from: args[3]) ?? Date()
    let end = (args.count > 4 ? iso.date(from: args[4]) : nil) ?? start.addingTimeInterval(1800)
    let location = args.count > 5 ? args[5] : nil
    let notes = args.count > 6 ? args[6] : nil

    do {
        let eventId = try bridge.createEvent(title: title, start: start, end: end, location: location, notes: notes, calendarId: nil)
        outputJSON(BridgeOutput(success: true, data: ["eventId": eventId], error: nil))
    } catch {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: error.localizedDescription))
    }

case "calendar-delete":
    guard args.count > 2 else {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Usage: calendar-delete <eventId>"))
        exit(1)
    }
    do {
        try bridge.deleteEvent(id: args[2])
        outputJSON(BridgeOutput(success: true, data: ["deleted": args[2]], error: nil))
    } catch {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: error.localizedDescription))
    }

case "reminders-list":
    let sem = DispatchSemaphore(value: 0)
    bridge.listReminders { rems in
        outputJSON(BridgeOutput(success: true, data: rems, error: nil))
        sem.signal()
    }
    sem.wait()

case "reminders-create":
    // args: reminders-create <title> [isoDue] [notes] [priority]
    guard args.count > 2 else {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Usage: reminders-create <title> [isoDue] [notes]"))
        exit(1)
    }
    let title = args[2]
    let iso = ISO8601DateFormatter()
    let due = args.count > 3 && !args[3].isEmpty ? iso.date(from: args[3]) : nil
    let notes = args.count > 4 ? args[4] : nil
    let priority = args.count > 5 ? (Int(args[5]) ?? 0) : 0

    do {
        let remId = try bridge.createReminder(title: title, dueAt: due, notes: notes, priority: priority)
        outputJSON(BridgeOutput(success: true, data: ["reminderId": remId], error: nil))
    } catch {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: error.localizedDescription))
    }

case "reminders-complete":
    guard args.count > 2 else {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Usage: reminders-complete <reminderId>"))
        exit(1)
    }
    do {
        try bridge.completeReminder(id: args[2])
        outputJSON(BridgeOutput(success: true, data: ["completed": args[2]], error: nil))
    } catch {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: error.localizedDescription))
    }

case "reminders-delete":
    guard args.count > 2 else {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Usage: reminders-delete <reminderId>"))
        exit(1)
    }
    do {
        try bridge.deleteReminder(id: args[2])
        outputJSON(BridgeOutput(success: true, data: ["deleted": args[2]], error: nil))
    } catch {
        outputJSON(BridgeOutput<String>(success: false, data: nil, error: error.localizedDescription))
    }

case "notify":
    // args: notify <title> <body> [sound]
    let title = args.count > 2 ? args[2] : "Recall"
    let body = args.count > 3 ? args[3] : "Reminder is due now"
    let sound = args.count > 4 ? args[4] : "Glass"

    bridge.deliverNotification(title: "Recall", subtitle: title, body: body, soundName: sound)
    outputJSON(BridgeOutput(success: true, data: ["notified": true], error: nil))

default:
    outputJSON(BridgeOutput<String>(success: false, data: nil, error: "Unknown command: \(command)"))
}
