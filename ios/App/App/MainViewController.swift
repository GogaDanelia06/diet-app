import UIKit
import Capacitor

/// Plate's web view controller: Capacitor's own, plus Plate's Apple Health plugin.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PlateHealthPlugin())
    }
}
