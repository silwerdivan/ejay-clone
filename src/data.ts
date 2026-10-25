export const LANES = ['drums', 'bass', 'synth', 'vocals'] as const
export type LaneId = (typeof LANES)[number]

export interface LoopMeta {
  id: string
  name: string
  detail: string
  lane: LaneId
  audio: string
  pattern: number[]
}

export interface Block {
  id: string
  loopId: string
  bar: number
}

const loop = (
  lane: LaneId,
  id: string,
  name: string,
  detail: string,
  pattern: number[],
): LoopMeta => ({ id, name, detail, lane, audio: `/audio/${id}.wav`, pattern })

export const LOOPS: LoopMeta[] = [
  loop('drums', 'night-drive', 'Night drive', 'Four on the floor', [2, 8, 3, 7, 2, 9, 3, 6, 2, 8, 4, 7, 2, 9, 5, 8]),
  loop('drums', 'after-hours', 'After hours', 'Loose & dusty', [7, 2, 3, 5, 8, 2, 4, 2, 7, 3, 2, 6, 9, 3, 5, 2]),
  loop('drums', 'silver-break', 'Silver break', 'Claps & hats', [5, 3, 7, 2, 8, 3, 5, 4, 6, 2, 8, 3, 9, 4, 6, 5]),
  loop('drums', 'soft-focus', 'Soft focus', 'Minimal pulse', [6, 1, 2, 1, 5, 1, 3, 1, 6, 1, 2, 2, 5, 1, 4, 1]),
  loop('bass', 'low-end-theory', 'Low end theory', 'Deep sub', [8, 7, 5, 3, 4, 2, 3, 2, 7, 6, 4, 2, 5, 3, 2, 1]),
  loop('bass', 'roller', 'Roller', 'Offbeat motion', [2, 3, 6, 2, 4, 6, 2, 3, 7, 2, 4, 5, 2, 6, 4, 2]),
  loop('bass', 'elastic', 'Elastic', 'Rubber bass', [7, 2, 5, 4, 3, 6, 2, 5, 8, 2, 4, 3, 6, 2, 5, 3]),
  loop('bass', 'sub-current', 'Sub current', 'Warm & round', [8, 5, 3, 2, 2, 3, 4, 2, 7, 5, 3, 2, 4, 3, 2, 2]),
  loop('synth', 'glass-city', 'Glass city', 'C minor keys', [5, 2, 6, 3, 7, 2, 4, 2, 5, 3, 8, 2, 6, 3, 4, 2]),
  loop('synth', 'neon-arc', 'Neon arc', 'Bright stabs', [7, 1, 3, 1, 8, 1, 4, 2, 7, 1, 5, 1, 9, 2, 4, 1]),
  loop('synth', 'slow-orbit', 'Slow orbit', 'Wide pad', [8, 7, 6, 5, 4, 4, 3, 3, 7, 6, 5, 4, 4, 3, 3, 2]),
  loop('synth', 'polaroid', 'Polaroid', 'Plucked chords', [6, 2, 4, 3, 5, 2, 7, 3, 6, 3, 4, 2, 8, 3, 5, 2]),
  loop('vocals', 'feel-the-night', 'Would you like to dance', 'Recorded CC0 hook', [3, 5, 7, 8, 6, 4, 3, 2, 3, 5, 8, 7, 5, 4, 3, 2]),
  loop('vocals', 'dont-stop', 'No, no, no', 'Recorded CC0 vocal', [4, 2, 6, 3, 5, 2, 7, 3, 4, 3, 6, 2, 8, 3, 5, 2]),
  loop('vocals', 'higher', 'Come with me', 'Recorded CC0 hook', [4, 5, 6, 7, 8, 7, 6, 5, 4, 5, 7, 8, 7, 6, 5, 4]),
  loop('vocals', 'echo-chop', 'Oh, oh, oh', 'Recorded CC0 vocal', [5, 2, 5, 3, 6, 2, 4, 2, 5, 3, 7, 2, 6, 3, 4, 2]),
]

export const loopById = (id: string) => LOOPS.find((item) => item.id === id)

const demoBlock = (loopId: string, bar: number): Block => ({ id: `demo-${loopId}-${bar}`, loopId, bar })
export const DEMO: Block[] = [
  demoBlock('night-drive', 0), demoBlock('after-hours', 2), demoBlock('night-drive', 4), demoBlock('silver-break', 6),
  demoBlock('low-end-theory', 0), demoBlock('roller', 2), demoBlock('low-end-theory', 4), demoBlock('elastic', 6),
  demoBlock('glass-city', 1), demoBlock('neon-arc', 3), demoBlock('slow-orbit', 5),
  demoBlock('feel-the-night', 0), demoBlock('dont-stop', 4), demoBlock('higher', 6),
]
export const freshDemo = () => DEMO.map((block) => ({ ...block }))

export const LANE_LABELS: Record<LaneId, string> = {
  drums: 'Drums', bass: 'Bass', synth: 'Synth', vocals: 'Vocals',
}
