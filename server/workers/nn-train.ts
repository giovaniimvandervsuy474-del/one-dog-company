import fs from 'node:fs'
import { input, log, done, progress, fmt } from './util.ts'

// A small, genuine multilayer perceptron (1-16-16-1, tanh) trained with SGD to approximate sin(x) on [-π, π].
// Weights persist between runs, so the loss curve is real continued learning. This is a toy task and is labelled as such in the UI.
const { weightsPath, epochs = 300, lr = 0.02 } = input<{ weightsPath: string; epochs: number; lr: number }>()
const H = 16
// Curriculum: when a level's target error is reached the net moves to a harder function and starts over, so learning never ends.
const CURRICULUM: Array<{ name: string; fn: (x: number) => number; target: number }> = [
  { name: 'sin(x)', fn: Math.sin, target: 0.0005 },
  { name: 'sin(2x)·0.8 + 0.3·cos(5x)', fn: x => Math.sin(2 * x) * 0.8 + 0.3 * Math.cos(5 * x), target: 0.002 },
  { name: 'sawtooth', fn: x => ((x / Math.PI) % 1 + 1) % 1 * 2 - 1, target: 0.01 },
  { name: 'square wave', fn: x => Math.sign(Math.sin(2 * x)) * 0.9, target: 0.02 },
  { name: 'x·sin(3x)/π', fn: x => (x * Math.sin(3 * x)) / Math.PI, target: 0.003 },
  { name: 'gaussian bumps', fn: x => Math.exp(-((x - 1.2) ** 2) * 4) - Math.exp(-((x + 1.5) ** 2) * 6), target: 0.001 },
]
type Net = { w1: number[]; b1: number[]; w2: number[][]; b2: number[]; w3: number[]; b3: number; totalEpochs: number; history: number[]; level?: number; levelEpochs?: number; levelsDone?: number }
function rnd(s = 0.5) { return (Math.random() * 2 - 1) * s }
function init(): Net {
  return { w1: Array.from({ length: H }, () => rnd(1)), b1: Array.from({ length: H }, () => rnd(0.1)),
    w2: Array.from({ length: H }, () => Array.from({ length: H }, () => rnd(0.5))), b2: Array.from({ length: H }, () => rnd(0.1)),
    w3: Array.from({ length: H }, () => rnd(0.5)), b3: 0, totalEpochs: 0, history: [] }
}
let net: Net = init()
if (fs.existsSync(weightsPath)) { try { net = JSON.parse(fs.readFileSync(weightsPath, 'utf8')) } catch {} }
net.level ??= 0; net.levelEpochs ??= 0; net.levelsDone ??= 0
let level: number = net.level
const lesson = CURRICULUM[Math.min(level, CURRICULUM.length - 1)]
const X = Array.from({ length: 64 }, (_, i) => -Math.PI + (2 * Math.PI * i) / 63)
const Y = X.map(lesson.fn)
log(`level ${net.level + 1}/${CURRICULUM.length}: learning ${lesson.name} (target mse ${lesson.target})`)
function forward(x: number) {
  const h1 = net.w1.map((w, i) => Math.tanh(w * x + net.b1[i]))
  const h2 = net.b2.map((b, j) => Math.tanh(h1.reduce((s, h, i) => s + h * net.w2[j][i], 0) + b))
  const y = h2.reduce((s, h, i) => s + h * net.w3[i], 0) + net.b3
  return { h1, h2, y }
}
let loss = 0
for (let ep = 0; ep < epochs; ep++) {
  loss = 0
  const order = X.map((_, i) => i).sort(() => Math.random() - 0.5)
  for (const i of order) {
    const x = X[i], t = Y[i]
    const { h1, h2, y } = forward(x)
    const err = y - t
    loss += err * err
    // backprop
    const g3 = h2.map(h => err * h)
    const gh2 = net.w3.map(w => err * w)
    const g2pre = gh2.map((g, j) => g * (1 - h2[j] * h2[j]))
    const gh1 = h1.map((_, i) => g2pre.reduce((s, g, j) => s + g * net.w2[j][i], 0))
    const g1pre = gh1.map((g, i) => g * (1 - h1[i] * h1[i]))
    for (let j = 0; j < H; j++) { net.w3[j] -= lr * g3[j]; net.b2[j] -= lr * g2pre[j]; for (let i = 0; i < H; i++) net.w2[j][i] -= lr * g2pre[j] * h1[i] }
    net.b3 -= lr * err
    for (let i = 0; i < H; i++) { net.w1[i] -= lr * g1pre[i] * x; net.b1[i] -= lr * g1pre[i] }
  }
  loss /= X.length
  net.totalEpochs++; net.levelEpochs = (net.levelEpochs ?? 0) + 1
  net.history.push(Number(loss.toExponential(3)))
  if (net.history.length > 400) net.history.shift()
  if (ep % 30 === 0) log(`epoch ${net.totalEpochs}: mse ${fmt(loss, 5)}`)
  progress((ep + 1) / epochs)
}
const preds = X.filter((_, i) => i % 4 === 0).map(x => ({ x: Number(x.toFixed(3)), y: Number(forward(x).y.toFixed(4)), t: Number(lesson.fn(x).toFixed(4)) }))
let levelUp = false
if (loss <= lesson.target && level < CURRICULUM.length - 1) {
  levelUp = true
  log(`level ${level + 1} mastered (${lesson.name}, mse ${loss.toExponential(2)} ≤ ${lesson.target}) after ${net.levelEpochs} epochs → next: ${CURRICULUM[level + 1].name}`)
  const fresh = init(); net = { ...fresh, totalEpochs: net.totalEpochs, history: net.history, level: level + 1, levelEpochs: 0, levelsDone: (net.levelsDone ?? 0) + 1 }
}
fs.writeFileSync(weightsPath, JSON.stringify(net))
log(`done: total epochs ${net.totalEpochs}, mse ${loss.toExponential(3)}`)
done({ totalEpochs: net.totalEpochs, mse: loss, mseText: loss.toExponential(3), epochsThisRun: epochs, lr, arch: '1-16-16-1 tanh', history: net.history.slice(-120), preds, level: lesson.name, levelIndex: level + 1, levels: CURRICULUM.length, target: lesson.target, levelUp, task: `curriculum level ${level + 1}/${CURRICULUM.length}: approximate ${lesson.name} on [-π, π] (toy task)` },
  { name: 'mse', value: Number(loss.toExponential(3)), unit: levelUp ? ' ↑level' : '' })
