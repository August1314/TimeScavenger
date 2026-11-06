// iphctl — 通过 iPhone 镜像窗口向 iPhone 注入点击/滑动的坐标工具（配合辅助功能权限）
// 用法:
//   iphctl click <x> <y>
//   iphctl drag <x1> <y1> <x2> <y2> [duration_ms]
//   iphctl scroll <x> <y> <amount>
import CoreGraphics
import Foundation

func post(_ type: CGEventType, _ loc: CGPoint, button: CGMouseButton = .left) {
  let down = CGEvent(
    mouseEventSource: nil, mouseType: type, mouseCursorPosition: loc, mouseButton: button)
  down?.post(tap: .cghidEventTap)
}

let args = CommandLine.arguments
guard args.count >= 4 else {
  FileHandle.standardError.write("usage: iphctl click|drag|scroll ...\n".data(using: .utf8)!)
  exit(2)
}

func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: y) }

func moveTo(_ p: CGPoint) {
  post(.mouseMoved, p)
  usleep(30_000)
}

switch args[1] {
case "click":
  let p = pt(Double(args[2])!, Double(args[3])!)
  moveTo(p)
  post(.leftMouseDown, p)
  usleep(60_000)
  post(.leftMouseUp, p)
case "drag":
  guard args.count >= 5 else { exit(2) }
  let a = pt(Double(args[2])!, Double(args[3])!)
  let b = pt(Double(args[4])!, Double(args[5])!)
  let dur = args.count > 6 ? Double(args[6])! : 400
  moveTo(a)
  post(.leftMouseDown, a)
  usleep(50_000)
  let steps = 20
  for i in 1...steps {
    let t = Double(i) / Double(steps)
    let p = pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    post(.leftMouseDragged, p)
    usleep(UInt32(dur * 1000 / Double(steps)))
  }
  usleep(50_000)
  post(.leftMouseUp, b)
case "scroll":
  guard args.count >= 5 else { exit(2) }
  let p = pt(Double(args[2])!, Double(args[3])!)
  let amount = Int32(Double(args[4])!)
  moveTo(p)
  if let e = CGEvent(
    scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: amount, wheel2: 0,
    wheel3: 0)
  {
    e.location = p
    e.post(tap: .cghidEventTap)
  }
default:
  exit(2)
}
