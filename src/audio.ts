import * as Tone from 'tone'
import { LOOPS, type Block } from './data'

export class StudioAudio {
  private players = new Map<string, Tone.Player>()
  private loading?: Promise<void>
  private scheduled?: number

  constructor(private getArrangement: () => Block[]) {}

  private load() {
    if (!this.loading) {
      const transport = Tone.getTransport()
      transport.bpm.value = 120
      transport.timeSignature = 4
      transport.loop = true
      transport.loopStart = 0
      transport.loopEnd = '8m'
      this.loading = Promise.all(LOOPS.map(async (meta) => {
        const player = new Tone.Player({ volume: meta.lane === 'vocals' ? -5 : -2 }).toDestination()
        this.players.set(meta.id, player)
        await player.load(meta.audio)
      })).then(() => undefined).catch((error) => {
        this.loading = undefined
        this.disposePlayers()
        throw error
      })
    }
    return this.loading
  }

  async play() {
    await Tone.start()
    await this.load()
    const transport = Tone.getTransport()
    if (this.scheduled === undefined) {
      this.scheduled = transport.scheduleRepeat((time) => {
        const bar = Math.floor(transport.getTicksAtTime(time) / (transport.PPQ * 4)) % 8
        for (const block of this.getArrangement()) {
          if (block.bar === bar) this.players.get(block.loopId)?.start(time)
        }
      }, '1m')
    }
    transport.start()
  }

  pause() {
    Tone.getTransport().pause()
    this.stopPlayers()
  }

  restart() {
    Tone.getTransport().position = 0
    this.stopPlayers()
  }

  reset() {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    this.stopPlayers()
  }

  seconds() {
    return Tone.getTransport().seconds
  }

  private stopPlayers() {
    this.players.forEach((player) => {
      try { player.stop() } catch { /* A loaded player may not be started yet. */ }
    })
  }

  private disposePlayers() {
    this.players.forEach((player) => player.dispose())
    this.players.clear()
  }

  dispose() {
    this.reset()
    if (this.scheduled !== undefined) Tone.getTransport().clear(this.scheduled)
    this.disposePlayers()
  }
}
