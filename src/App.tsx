import { useEffect, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { StudioAudio } from './audio'
import { LANES, LANE_LABELS, LOOPS, freshDemo, loopById, type Block, type LaneId, type LoopMeta } from './data'
import { loadArrangement, saveArrangement } from './storage'

function Icon({ name }: { name: 'play' | 'pause' | 'stop' | 'restart' | 'reset' | 'copy' | 'trash' | 'plus' }) {
  const paths = {
    play: <path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M9 6v12M15 6v12" strokeWidth="3" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" />,
    restart: <><path d="M5 8V3m0 0h5M5 3l3.2 3.2a7 7 0 1 1-1.1 10.3" /></>,
    reset: <><path d="M4 11a8 8 0 1 1 2.3 6M4 11V6m0 5h5" /></>,
    copy: <><rect x="8" y="8" width="10" height="11" rx="2" /><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Waveform({ pattern }: { pattern: number[] }) {
  return <span className="waveform" aria-hidden="true">{[...pattern, ...pattern].map((height, index) => <i key={index} style={{ height: `${3 + height * 2}px` }} />)}</span>
}

function LibraryLoop({ loop, previewing, onAdd, onPreview }: {
  loop: LoopMeta
  previewing: boolean
  onAdd: (loopId: string) => void
  onPreview: (loopId: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${loop.id}`, data: { type: 'library', loopId: loop.id },
  })
  return (
    <div className={`library-loop ${previewing ? 'previewing' : ''} ${isDragging ? 'dragging' : ''}`} data-loop-id={loop.id}>
      <button
        ref={setNodeRef} {...listeners} {...attributes}
        className="library-loop-add" onClick={() => onAdd(loop.id)}
        aria-label={`Add ${loop.name} to ${LANE_LABELS[loop.lane]} lane`}
      >
        <span className={`lane-dot ${loop.lane}`} />
        <span className="library-loop-copy"><strong>{loop.name}</strong><small>{loop.detail}</small></span>
        <span className="add-hint"><Icon name="plus" /></span>
      </button>
      <button className="preview-button" onClick={() => onPreview(loop.id)} aria-label={`${previewing ? 'Stop' : 'Play'} ${loop.name} preview`}>
        <Icon name={previewing ? 'stop' : 'play'} />
      </button>
    </div>
  )
}

function TimelineBlock({ block, loop, selected, onSelect, onDuplicate, onDelete }: {
  block: Block
  loop: LoopMeta
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`, data: { type: 'block', blockId: block.id, loopId: loop.id },
  })
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={`timeline-block ${loop.lane} ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      data-testid="timeline-block" data-block-id={block.id} data-loop-id={loop.id} data-lane={loop.lane} data-bar={block.bar}
      role="button" tabIndex={0} aria-pressed={selected} aria-label={`${loop.name}, bar ${block.bar + 1}`}
      onClick={onSelect} onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete() }
      }}
    >
      <div className="block-title"><span>{loop.name}</span><span className="block-duration">1 bar</span></div>
      <Waveform pattern={loop.pattern} />
      <div className="block-actions" onPointerDown={(event) => event.stopPropagation()}>
        <button aria-label={`Duplicate ${loop.name} at bar ${block.bar + 1}`} title="Duplicate" onClick={(event) => { event.stopPropagation(); onDuplicate() }}><Icon name="copy" /></button>
        <button aria-label={`Delete ${loop.name} at bar ${block.bar + 1}`} title="Delete" onClick={(event) => { event.stopPropagation(); onDelete() }}><Icon name="trash" /></button>
      </div>
    </div>
  )
}

function occupiesSlot(blocks: Block[], lane: LaneId, bar: number, excludeId?: string) {
  return blocks.some((block) => block.id !== excludeId && block.bar === bar && loopById(block.loopId)?.lane === lane)
}

function BarSlot({ lane, bar, children }: { lane: LaneId; bar: number; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${lane}-${bar}`, data: { lane, bar } })
  return <div ref={setNodeRef} className={`bar-slot ${isOver ? 'over' : ''}`} data-testid={`bar-${lane}-${bar}`} data-lane={lane} data-bar={bar} aria-label={`${LANE_LABELS[lane]} bar ${bar + 1}`}>{children}</div>
}

export default function App() {
  const [arrangement, setArrangement] = useState<Block[]>(loadArrangement)
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('Choose a loop, then click or drag it into your track.')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(true)
  const [playhead, setPlayhead] = useState(0)
  const [activeLoop, setActiveLoop] = useState<LoopMeta | null>(null)
  const [previewLoop, setPreviewLoop] = useState<string | null>(null)
  const arrangementRef = useRef(arrangement)
  const audioRef = useRef<StudioAudio | null>(null)
  const playRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  arrangementRef.current = arrangement

  useEffect(() => { setIsSaved(saveArrangement(arrangement)) }, [arrangement])
  useEffect(() => {
    audioRef.current = new StudioAudio(() => arrangementRef.current)
    return () => {
      playRequestRef.current++
      previewRequestRef.current++
      audioRef.current?.dispose()
    }
  }, [])
  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const update = () => {
      setPlayhead(audioRef.current?.seconds() ?? 0)
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const firstFree = (lane: LaneId, blocks = arrangement) => {
    const occupied = new Set(blocks.filter((block) => loopById(block.loopId)?.lane === lane).map((block) => block.bar))
    return Array.from({ length: 8 }, (_, bar) => bar).find((bar) => !occupied.has(bar))
  }
  const newId = () => crypto.randomUUID()
  const stopPreview = () => {
    previewRequestRef.current++
    audioRef.current?.stopPreview()
    setPreviewLoop(null)
  }
  const togglePreview = async (loopId: string) => {
    if (previewLoop === loopId) { stopPreview(); return }
    const request = ++previewRequestRef.current
    audioRef.current?.stopPreview()
    setPreviewLoop(loopId)
    setNotice('')
    try {
      const started = await audioRef.current?.preview(loopId, () => request === previewRequestRef.current)
      if (!started && request === previewRequestRef.current) setPreviewLoop(null)
    } catch {
      if (request === previewRequestRef.current) {
        audioRef.current?.stopPreview()
        setPreviewLoop(null)
        setNotice('Audio couldn’t load. Check the bundled audio files and try again.')
      }
    }
  }
  const addLoop = (loopId: string, requestedBar?: number) => {
    const loop = loopById(loopId)
    if (!loop) return
    const bar = requestedBar ?? firstFree(loop.lane)
    if (bar === undefined) { setNotice(`${LANE_LABELS[loop.lane]} is full. Delete or move a block to make room.`); return }
    if (occupiesSlot(arrangement, loop.lane, bar)) {
      setNotice(`Bar ${bar + 1} is occupied. Choose an empty bar.`); return
    }
    const block = { id: newId(), loopId, bar }
    if (previewLoop === loopId) stopPreview()
    setArrangement((current) => [...current, block])
    setSelected(block.id)
    setNotice(`${loop.name} added to ${LANE_LABELS[loop.lane]}, bar ${bar + 1}.`)
  }
  const duplicateBlock = (block: Block) => {
    const loop = loopById(block.loopId)!
    const bar = firstFree(loop.lane)
    if (bar === undefined) { setNotice(`${LANE_LABELS[loop.lane]} is full. No free position for a duplicate.`); return }
    const duplicate = { ...block, id: newId(), bar }
    setArrangement((current) => [...current, duplicate])
    setSelected(duplicate.id)
    setNotice(`${loop.name} duplicated to bar ${bar + 1}.`)
  }
  const deleteBlock = (block: Block) => {
    audioRef.current?.stopLoop(block.loopId)
    setArrangement((current) => current.filter((item) => item.id !== block.id))
    setSelected(null)
    setNotice(`${loopById(block.loopId)?.name} deleted. Bar ${block.bar + 1} is now free.`)
  }
  const togglePlayback = async () => {
    if (isLoading) return
    if (isPlaying) {
      audioRef.current?.pause()
      setPlayhead(audioRef.current?.seconds() ?? 0)
      setIsPlaying(false)
      return
    }
    const request = ++playRequestRef.current
    setIsLoading(true)
    setNotice('')
    try {
      const started = await audioRef.current?.play(() => request === playRequestRef.current)
      if (started && request === playRequestRef.current) setIsPlaying(true)
    } catch {
      if (request === playRequestRef.current) setNotice('Audio couldn’t load. Check the bundled audio files and try again.')
    } finally {
      if (request === playRequestRef.current) setIsLoading(false)
    }
  }
  const restart = () => {
    audioRef.current?.restart()
    setPlayhead(0)
    setNotice('Back to bar one.')
  }
  const reset = () => {
    playRequestRef.current++
    previewRequestRef.current++
    audioRef.current?.reset()
    setPreviewLoop(null)
    setIsLoading(false)
    setIsPlaying(false)
    setPlayhead(0)
    setSelected(null)
    setArrangement(freshDemo())
    setNotice('Demo restored. Your eight-bar starting point is ready.')
  }
  const dragStart = ({ active }: DragStartEvent) => setActiveLoop(loopById(String(active.data.current?.loopId)) ?? null)
  const dragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLoop(null)
    if (!over) return
    const data = active.data.current
    const target = over.data.current as { lane: LaneId; bar: number } | undefined
    const loop = loopById(String(data?.loopId))
    if (!loop || !target) return
    if (loop.lane !== target.lane) { setNotice(`${loop.name} belongs in the ${LANE_LABELS[loop.lane]} lane.`); return }
    if (data?.type === 'block') {
      const current = arrangementRef.current
      const source = current.find((block) => block.id === data.blockId)
      if (!source || (source.bar === target.bar)) return
      if (occupiesSlot(current, target.lane, target.bar, source.id)) {
        setNotice(`Bar ${target.bar + 1} is occupied. Your block stayed where it was.`); return
      }
      audioRef.current?.stopLoop(source.loopId)
      setArrangement((current) => current.map((block) => block.id === source.id ? { ...block, bar: target.bar } : block))
      setNotice(`${loop.name} moved to bar ${target.bar + 1}.`)
    } else addLoop(loop.id, target.bar)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={dragStart} onDragEnd={dragEnd} onDragCancel={() => setActiveLoop(null)}>
      <div className="studio-shell">
        <header className="transport-bar">
          <a className="brand" href="#" aria-label="Pulse 08 home"><span className="brand-mark">P/</span><span>PULSE<em>/08</em></span></a>
          <div className="transport-controls">
            <button className="restart-button" onClick={restart} aria-label="Restart from bar one"><Icon name="restart" /><span>Restart</span></button>
            <button className="play-button" onClick={togglePlayback} disabled={isLoading} aria-label={isLoading ? 'Loading audio' : isPlaying ? 'Pause' : 'Play'}>
              <Icon name={isPlaying ? 'pause' : 'play'} /><span>{isLoading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          </div>
          <div className="session-spec"><span><i className={isPlaying ? 'live' : ''} />{isPlaying ? 'Playing' : 'Ready'}</span><strong>120 <small>BPM</small></strong><span>C minor</span><span>8 bars</span></div>
          <button className="reset-button" onClick={reset}><Icon name="reset" />Reset demo</button>
        </header>

        <main>
          <section className="intro">
            <div><p className="eyebrow">The eight-bar loop studio</p><h1>Find your groove.<br /><span>Keep the night moving.</span></h1></div>
            <p className="intro-note">Everything fits. Every loop is in key.<br />You bring the instinct.</p>
          </section>

          <section className="workspace" aria-label="Music studio">
            <aside className="library">
              <div className="panel-heading"><div><span className="section-kicker">Sound shelf</span><h2>Loop library</h2></div><span className="loop-count">16</span></div>
              <p className="library-help">Click to add or drag to a bar.</p>
              <div className="library-scroll">
                {LANES.map((lane) => <section className="library-group" key={lane} aria-labelledby={`library-${lane}`}>
                  <h3 id={`library-${lane}`}><span className={`lane-dot ${lane}`} />{LANE_LABELS[lane]}<span>1 bar</span></h3>
                  {LOOPS.filter((loop) => loop.lane === lane).map((loop) => <LibraryLoop key={loop.id} loop={loop} previewing={previewLoop === loop.id} onAdd={addLoop} onPreview={togglePreview} />)}
                </section>)}
              </div>
            </aside>

            <section className="arrangement" aria-label="Eight-bar arrangement">
              <div className="panel-heading arrangement-heading"><div><span className="section-kicker">Your arrangement</span><h2>Night session <span>01</span></h2></div><span className={`save-state ${isSaved ? '' : 'unsaved'}`}><i />{isSaved ? 'Saved locally' : 'Not saved'}</span></div>
              <div className="timeline-scroll">
                <div className="timeline">
                  <div className="lane-labels">
                    {LANES.map((lane, index) => <div className="lane-label" key={lane}><span className={`lane-icon ${lane}`}>{index + 1}</span><div><strong>{LANE_LABELS[lane]}</strong><small>{lane === 'vocals' ? 'Hooks & chops' : lane === 'drums' ? 'Rhythm section' : lane === 'bass' ? 'Low frequency' : 'Keys & texture'}</small></div></div>)}
                  </div>
                  <div className="tracks">
                    <div className="bar-ruler">{Array.from({ length: 8 }, (_, bar) => <div key={bar} className={bar % 2 === 0 ? 'major' : ''}><strong>0{bar + 1}</strong><span>{bar % 2 === 0 ? 'BAR' : ''}</span></div>)}</div>
                    {LANES.map((lane) => <div className={`lane-track ${lane}`} data-testid={`lane-${lane}`} key={lane}>
                      {Array.from({ length: 8 }, (_, bar) => {
                        const block = arrangement.find((item) => item.bar === bar && loopById(item.loopId)?.lane === lane)
                        return <BarSlot key={bar} lane={lane} bar={bar}>{block && <TimelineBlock block={block} loop={loopById(block.loopId)!} selected={selected === block.id} onSelect={() => setSelected(block.id)} onDuplicate={() => duplicateBlock(block)} onDelete={() => deleteBlock(block)} />}</BarSlot>
                      })}
                    </div>)}
                    <div className={`playhead ${isPlaying ? 'active' : ''}`} data-testid="playhead" data-position={playhead} style={{ left: `${Math.min(playhead / 16 * 100, 100)}%`, top: '30px' }}><span /></div>
                  </div>
                </div>
              </div>
              <div className="arrangement-footer"><span><kbd>Click</kbd> Select</span><span><kbd>Drag</kbd> Move</span><span><kbd>Delete</kbd> Remove</span><span className="key-note">All loops · 120 BPM · C minor</span></div>
            </section>
          </section>
        </main>
        <div className="status-bar" role="status" aria-live="polite"><span className="status-light" />{notice || (isSaved ? 'Your arrangement is saved in this browser.' : 'Changes are not saved. Check browser storage permissions.')}</div>
      </div>
      <DragOverlay>{activeLoop && <div className={`drag-card ${activeLoop.lane}`}><strong>{activeLoop.name}</strong><Waveform pattern={activeLoop.pattern} /></div>}</DragOverlay>
    </DndContext>
  )
}
