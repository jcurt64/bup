import AVFoundation
import AppKit

// frame.swift <video> <secondes> <sortie.jpg>
let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
let seconds = Double(args[2])!
let out = URL(fileURLWithPath: args[3])

let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video).first!
let size = track.naturalSize.applying(track.preferredTransform)
let dur = CMTimeGetSeconds(asset.duration)
print("dimensions: \(abs(Int(size.width)))x\(abs(Int(size.height)))  durée: \(String(format: "%.1f", dur))s")

let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let cg = try gen.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
let rep = NSBitmapImageRep(cgImage: cg)
let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82])!
try data.write(to: out)
print("écrit: \(out.lastPathComponent) — \(data.count / 1024) Ko")
