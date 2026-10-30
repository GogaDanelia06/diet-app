import Foundation
import Capacitor
import HealthKit

/// Reads one day of Apple Health data for Plate: steps, active calories, workouts and weight.
/// Totals come from statistics queries, which merge iPhone and Apple Watch samples, so nothing is counted twice.
@objc(PlateHealthPlugin)
public class PlateHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PlateHealthPlugin"
    public let jsName = "PlateHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDay", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    private let steps = HKObjectType.quantityType(forIdentifier: .stepCount)!
    private let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    private let bodyMass = HKObjectType.quantityType(forIdentifier: .bodyMass)!

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    /// Shows Apple's permission sheet the first time; later calls return straight away.
    @objc func requestAccess(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        let read: Set<HKObjectType> = [steps, activeEnergy, bodyMass, HKObjectType.workoutType()]
        store.requestAuthorization(toShare: nil, read: read) { ok, error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["granted": ok])
            }
        }
    }

    /// Reads the day given as "yyyy-MM-dd" in the phone's time zone.
    @objc func readDay(_ call: CAPPluginCall) {
        guard let key = call.getString("date"), let start = Self.day.date(from: key) else {
            call.reject("date must be yyyy-MM-dd")
            return
        }
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start)!
        let range = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let group = DispatchGroup()
        var stepCount = 0.0
        var activeKcal = 0.0
        var weightKg: Double?
        var workouts: [[String: Any]] = []

        group.enter()
        sum(steps, unit: .count(), in: range) { value in
            stepCount = value
            group.leave()
        }
        group.enter()
        sum(activeEnergy, unit: .kilocalorie(), in: range) { value in
            activeKcal = value
            group.leave()
        }
        group.enter()
        let latestFirst = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
        store.execute(HKSampleQuery(sampleType: bodyMass, predicate: range, limit: 1, sortDescriptors: latestFirst) { _, samples, _ in
            weightKg = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
            group.leave()
        })
        group.enter()
        let earliestFirst = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
        store.execute(HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: range, limit: HKObjectQueryNoLimit, sortDescriptors: earliestFirst) { _, samples, _ in
            workouts = (samples as? [HKWorkout] ?? []).map { self.describe($0) }
            group.leave()
        })

        group.notify(queue: .main) {
            var day: [String: Any] = [
                "date": key,
                "steps": Int(stepCount.rounded()),
                "activeKcal": Int(activeKcal.rounded()),
                "workouts": workouts,
            ]
            if let kg = weightKg { day["weightKg"] = (kg * 10).rounded() / 10 }
            call.resolve(day)
        }
    }

    /// The day's total for a quantity; 0 when there is no data or no permission.
    private func sum(_ type: HKQuantityType, unit: HKUnit, in range: NSPredicate, done: @escaping (Double) -> Void) {
        store.execute(HKStatisticsQuery(quantityType: type, quantitySamplePredicate: range, options: .cumulativeSum) { _, stats, _ in
            done(stats?.sumQuantity()?.doubleValue(for: unit) ?? 0)
        })
    }

    private func describe(_ workout: HKWorkout) -> [String: Any] {
        var kcal = 0.0
        if #available(iOS 16.0, *) {
            kcal = workout.statistics(for: activeEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
        } else {
            kcal = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
        }
        // Apps can name a workout themselves (a padel app, say); otherwise use the activity type.
        let brand = workout.metadata?[HKMetadataKeyWorkoutBrandName] as? String
        var out: [String: Any] = [
            "id": workout.uuid.uuidString,
            "name": brand ?? Self.name(of: workout.workoutActivityType),
            "start": ISO8601DateFormatter().string(from: workout.startDate),
            "minutes": Int((workout.duration / 60).rounded()),
            "kcal": Int(kcal.rounded()),
        ]
        if let km = workout.totalDistance?.doubleValue(for: .meterUnit(with: .kilo)), km > 0 {
            out["distanceKm"] = (km * 100).rounded() / 100
        }
        return out
    }

    private static let day: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Names that match Plate's own exercise list where one exists, so they are translated the same way.
    private static func name(of type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking: return "Walking"
        case .running: return "Running"
        case .cycling: return "Cycling outdoors"
        case .hiking: return "Hiking"
        case .elliptical: return "Elliptical trainer"
        case .rowing: return "Rowing machine, moderate"
        case .stairClimbing, .stairs: return "Stair climber / stairs"
        case .jumpRope: return "Jump rope"
        case .swimming: return "Swimming laps, moderate"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Weight lifting, moderate"
        case .highIntensityIntervalTraining, .crossTraining: return "HIIT / circuit training"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .flexibility, .cooldown: return "Stretching"
        case .dance, .socialDance, .cardioDance: return "Dancing"
        case .boxing, .kickboxing: return "Boxing / kickboxing"
        case .martialArts: return "Martial arts"
        case .soccer: return "Football / soccer, casual"
        case .basketball: return "Basketball"
        case .volleyball: return "Volleyball"
        case .tennis: return "Tennis, singles"
        case .tableTennis: return "Table tennis"
        case .badminton: return "Badminton"
        case .climbing: return "Climbing / bouldering"
        case .downhillSkiing: return "Skiing, downhill"
        case .crossCountrySkiing: return "Skiing, cross-country"
        case .golf: return "Golf, walking"
        case .racquetball, .squash: return "Padel / racket sports"
        case .mixedCardio: return "Cardio workout"
        case .coreTraining: return "Core training"
        default: return "Workout"
        }
    }
}
