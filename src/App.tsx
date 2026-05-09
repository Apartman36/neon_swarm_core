import { useEffect, useRef, useState } from "react";
import { GameAudio } from "./game/audio";
import { DEFAULT_SEED, FIXED_DT, STORAGE_HIGH_SCORE } from "./game/constants";
import { canvasPointerToWorld } from "./game/input";
import { makeSeed } from "./game/random";
import { renderSimulation } from "./game/render";
import { Simulation } from "./game/simulation";
import type { ScreenState, SimulationSnapshot, UpgradeId } from "./game/types";

const SPEED_MULTIPLIERS = [1, 2, 3, 4] as const;

function readHighScore(): number {
  try {
    const value = localStorage.getItem(STORAGE_HIGH_SCORE);
    return value ? Number.parseFloat(value) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeHighScore(value: number): void {
  try {
    localStorage.setItem(STORAGE_HIGH_SCORE, value.toFixed(2));
  } catch {
    // Local storage can be blocked in private browser contexts.
  }
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const simulationRef = useRef<Simulation | null>(null);
  if (!audioRef.current) {
    audioRef.current = new GameAudio();
  }
  if (!simulationRef.current) {
    simulationRef.current = new Simulation(DEFAULT_SEED, false);
  }

  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [screen, setScreen] = useState<ScreenState>("menu");
  const [cinematic, setCinematic] = useState(false);
  const [debug, setDebug] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<(typeof SPEED_MULTIPLIERS)[number]>(1);
  const [muted, setMuted] = useState(false);
  const [highScore, setHighScore] = useState(readHighScore);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => simulationRef.current!.getSnapshot());

  const seedRef = useRef(seed);
  const screenRef = useRef(screen);
  const cinematicRef = useRef(cinematic);
  const debugRef = useRef(debug);
  const speedMultiplierRef = useRef(speedMultiplier);
  const mutedRef = useRef(muted);
  const highScoreRef = useRef(highScore);
  const audioSnapshotRef = useRef(snapshot);

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    cinematicRef.current = cinematic;
  }, [cinematic]);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  const setScreenState = (next: ScreenState) => {
    screenRef.current = next;
    setScreen(next);
  };

  const setCinematicState = (next: boolean) => {
    cinematicRef.current = next;
    setCinematic(next);
  };

  const startGame = (nextCinematic: boolean) => {
    const sim = simulationRef.current!;
    void audioRef.current?.resume();
    setCinematicState(nextCinematic);
    sim.reset(seedRef.current, nextCinematic);
    const nextSnapshot = sim.getSnapshot();
    audioSnapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    setScreenState("playing");
  };

  const restartCurrentSeed = () => {
    const sim = simulationRef.current!;
    void audioRef.current?.resume();
    sim.reset(seedRef.current, cinematicRef.current);
    const nextSnapshot = sim.getSnapshot();
    audioSnapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    setScreenState("playing");
  };

  const randomizeSeed = () => {
    const nextSeed = makeSeed();
    const sim = simulationRef.current!;
    seedRef.current = nextSeed;
    setSeed(nextSeed);
    sim.reset(nextSeed, cinematicRef.current);
    const nextSnapshot = sim.getSnapshot();
    audioSnapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    if (screenRef.current !== "menu") {
      setScreenState("playing");
    }
  };

  const togglePause = () => {
    if (screenRef.current === "playing") setScreenState("paused");
    else if (screenRef.current === "paused") setScreenState("playing");
  };

  const cycleSpeed = () => {
    setSpeedMultiplier((current) => {
      const currentIndex = SPEED_MULTIPLIERS.indexOf(current);
      return SPEED_MULTIPLIERS[(currentIndex + 1) % SPEED_MULTIPLIERS.length];
    });
  };

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      audioRef.current?.setMuted(next);
      if (!next && screenRef.current !== "menu") void audioRef.current?.resume();
      return next;
    });
  };

  const toggleCinematic = () => {
    const next = !cinematicRef.current;
    setCinematicState(next);
    if (screenRef.current === "menu" || screenRef.current === "coreDestroyed") {
      const sim = simulationRef.current!;
      sim.reset(seedRef.current, next);
      setSnapshot(sim.getSnapshot());
      setScreenState("playing");
    }
  };

  const triggerShockwave = () => {
    if (screenRef.current !== "playing") return;
    void audioRef.current?.resume();
    simulationRef.current?.triggerShockwave(false);
  };

  const purchaseUpgrade = (id: UpgradeId) => {
    if (screenRef.current !== "playing" && screenRef.current !== "paused") return;
    const sim = simulationRef.current;
    if (!sim?.buyUpgrade(id)) return;
    setSnapshot(sim.getSnapshot());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        event.preventDefault();
        triggerShockwave();
      } else if (key === "r") {
        restartCurrentSeed();
      } else if (key === "n") {
        randomizeSeed();
      } else if (key === "c") {
        toggleCinematic();
      } else if (key === "f") {
        cycleSpeed();
      } else if (key === "m") {
        toggleMute();
      } else if (key === "d") {
        setDebug((value) => !value);
      } else if (key === "1") {
        purchaseUpgrade("swarmSpeed");
      } else if (key === "2") {
        purchaseUpgrade("nodeFireRate");
      } else if (key === "3") {
        purchaseUpgrade("coreShield");
      } else if (key === "4") {
        purchaseUpgrade("repairPower");
      } else if (key === "5") {
        purchaseUpgrade("workerSystems");
      } else if (key === "6") {
        purchaseUpgrade("shockPower");
      } else if (key === "p" || key === "escape") {
        togglePause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sim = simulationRef.current;
    if (!canvas || !sim) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastSnapshot = 0;

    const frame = (now: number) => {
      const frameDt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      if (screenRef.current !== "paused") {
        const simSpeed = speedMultiplierRef.current;
        accumulator += frameDt * simSpeed;
        let steps = 0;
        const maxSteps = simSpeed >= 4 ? 8 : simSpeed >= 3 ? 7 : 5;
        while (accumulator >= FIXED_DT && steps < maxSteps) {
          sim.update(FIXED_DT, {
            cinematic: cinematicRef.current,
            screen: screenRef.current,
          });
          accumulator -= FIXED_DT;
          steps += 1;
        }
        if (steps >= maxSteps) accumulator = 0;
      }

      if (sim.destroyed) {
        if (cinematicRef.current) {
          if (screenRef.current !== "cinematicAutoRestart") {
            setScreenState("cinematicAutoRestart");
          }
          if (sim.core.collapseTimer > 3.25) {
            const nextSeed = makeSeed();
            seedRef.current = nextSeed;
            setSeed(nextSeed);
            sim.reset(nextSeed, true);
            setScreenState("playing");
          }
        } else if (screenRef.current === "playing") {
          setScreenState("coreDestroyed");
        }
      }

      renderSimulation(ctx, sim, {
        screen: screenRef.current,
        cinematic: cinematicRef.current,
        debug: debugRef.current,
        highScore: highScoreRef.current,
      });

      if (now - lastSnapshot > 120) {
        lastSnapshot = now;
        const nextSnapshot = sim.getSnapshot();
        playSnapshotAudio(audioSnapshotRef.current, nextSnapshot);
        audioSnapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        if (
          screenRef.current !== "menu" &&
          nextSnapshot.time > highScoreRef.current &&
          !Number.isNaN(nextSnapshot.time)
        ) {
          highScoreRef.current = nextSnapshot.time;
          setHighScore(nextSnapshot.time);
          writeHighScore(nextSnapshot.time);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== "playing" && screenRef.current !== "cinematicAutoRestart") return;
    void audioRef.current?.resume();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = canvasPointerToWorld(canvas, event.clientX, event.clientY);
    simulationRef.current?.addBeacon(pos);
  };

  const hudVisible = !cinematic && screen !== "menu";
  const overlayVisible = screen === "menu" || screen === "paused" || screen === "coreDestroyed";
  const upgradeViews = simulationRef.current?.getUpgradeViews() ?? [];

  const playSnapshotAudio = (previous: SimulationSnapshot, next: SimulationSnapshot) => {
    if (screenRef.current === "menu") return;
    const audio = audioRef.current;
    if (!audio) return;
    if (next.wave > previous.wave) audio.wave();
    if (next.shocksUsed > previous.shocksUsed) audio.shock();
    if (next.upgradesPurchased > previous.upgradesPurchased) audio.upgrade();
    if (next.energyCollected > previous.energyCollected + 0.5) audio.energy();
    if (next.shotsFired > previous.shotsFired) audio.laser();
    if (next.coreHealth < previous.coreHealth - 0.35) audio.damage();
  };

  return (
    <div className={`app ${cinematic ? "is-cinematic" : ""} state-${screen}`}>
      <main className="game-shell">
        <div className="frame-wrap">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            aria-label="Neon Swarm Core simulation"
            onPointerDown={handlePointerDown}
          />

          {hudVisible && (
            <div className="hud hud-top">
              <div className="stat">
                <span>Time</span>
                <strong>{formatTime(snapshot.time)}</strong>
              </div>
              <div className="stat">
                <span>Wave</span>
                <strong>{snapshot.wave}</strong>
              </div>
              <div className="stat">
                <span>Core</span>
                <strong>{percent(snapshot.coreHealth / 100)}</strong>
              </div>
              <div className="stat">
                <span>Upgrade</span>
                <strong>{snapshot.upgradePoints}</strong>
              </div>
            </div>
          )}

          {hudVisible && (
            <div className="hud hud-bottom">
              <div className="stat">
                <span>Energy</span>
                <strong>{Math.round(snapshot.coreEnergy)}</strong>
              </div>
              <div className="stat">
                <span>Infection</span>
                <strong>{percent(snapshot.infection)}</strong>
              </div>
              <div className="stat">
                <span>Workers</span>
                <strong>
                  {snapshot.workers}/{snapshot.workerCapacity}
                </strong>
              </div>
              <div className="stat">
                <span>Nodes</span>
                <strong>{snapshot.nodes}</strong>
              </div>
              <div className="stat">
                <span>Shock</span>
                <strong>{percent(snapshot.shockCharge)}</strong>
                <small>Power {percent(snapshot.shockPower)}</small>
              </div>
            </div>
          )}

          {hudVisible && (screen === "playing" || screen === "paused") && (
            <section className="upgrades-panel" aria-label="Upgrades">
              <header>
                <span>Upgrades</span>
                <strong>{snapshot.upgradePoints} pts</strong>
              </header>
              <div className="upgrade-list">
                {upgradeViews.map((upgrade) => (
                  <button
                    key={upgrade.id}
                    type="button"
                    onClick={() => purchaseUpgrade(upgrade.id)}
                    disabled={!upgrade.canBuy || screen !== "playing"}
                    title={`${upgrade.description} Shortcut ${upgrade.shortcut}.`}
                  >
                    <span className="upgrade-name">{upgrade.shortLabel}</span>
                    <span className="upgrade-value">{upgrade.valueLabel}</span>
                    <span className="upgrade-level">Lv {upgrade.level}</span>
                    <span className="upgrade-cost">{upgrade.maxed ? "MAX" : `${upgrade.cost} pt`}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {cinematic && screen !== "menu" && (
            <div className="cinematic-status">
              <span>{formatTime(snapshot.time)}</span>
              <span>{speedMultiplier}x</span>
              {snapshot.eventText && <strong>{snapshot.eventText}</strong>}
            </div>
          )}

          {cinematic && screen !== "menu" && (
            <div className="cinematic-tools">
              <button type="button" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" onClick={cycleSpeed}>
                {speedMultiplier}x
              </button>
            </div>
          )}

          {debug && (
            <div className="debug-panel">
              <span>{snapshot.seed}</span>
              <span>virus {snapshot.viruses}</span>
              <span>infection {percent(snapshot.infection)}</span>
              <span>mode {cinematic ? "cinematic" : "normal"}</span>
            </div>
          )}

          {overlayVisible && (
            <div className={`overlay overlay-${screen}`}>
              {screen === "menu" && (
                <section className="menu-panel">
                  <p className="eyebrow">Synthetic colony defense</p>
                  <h1>Neon Swarm Core</h1>
                  <p className="menu-copy">
                    Protect the Core while workers collect energy and defense nodes fight the virus on their own. Spend Upgrade Points to strengthen the colony, trigger Shock as an emergency pulse, and use Speed to accelerate the run. Cinematic Mode keeps the swarm clean and meditative for background watching or capture.
                  </p>
                  <div className="seed-row">
                    <span>Seed</span>
                    <strong>{seed}</strong>
                  </div>
                  <div className="menu-actions">
                    <button type="button" className="primary" onClick={() => startGame(false)}>
                      Start
                    </button>
                    <button type="button" onClick={() => startGame(true)}>
                      Cinematic
                    </button>
                    <button type="button" onClick={randomizeSeed}>
                      New Seed
                    </button>
                    <button type="button" onClick={toggleMute}>
                      {muted ? "Unmute" : "Mute"}
                    </button>
                  </div>
                </section>
              )}

              {screen === "paused" && (
                <section className="dialog-panel">
                  <p className="eyebrow">Simulation paused</p>
                  <h2>{formatTime(snapshot.time)}</h2>
                  <div className="menu-actions">
                    <button type="button" className="primary" onClick={togglePause}>
                      Resume
                    </button>
                    <button type="button" onClick={restartCurrentSeed}>
                      Restart
                    </button>
                  </div>
                </section>
              )}

              {screen === "coreDestroyed" && (
                <section className="dialog-panel danger">
                  <p className="eyebrow">Core collapsed</p>
                  <h2>{formatTime(snapshot.time)}</h2>
                  <div className="run-summary" aria-label="Run summary">
                    <div>
                      <span>Best</span>
                      <strong>{formatTime(highScore)}</strong>
                    </div>
                    <div>
                      <span>Wave</span>
                      <strong>{snapshot.wave}</strong>
                    </div>
                    <div>
                      <span>Max Infection</span>
                      <strong>{percent(snapshot.maxInfection)}</strong>
                    </div>
                    <div>
                      <span>Nodes Built</span>
                      <strong>{snapshot.nodesBuilt}</strong>
                    </div>
                    <div>
                      <span>Energy</span>
                      <strong>{Math.round(snapshot.energyCollected)}</strong>
                    </div>
                    <div>
                      <span>Upgrades</span>
                      <strong>{snapshot.upgradesPurchased}</strong>
                    </div>
                    <div>
                      <span>Shocks</span>
                      <strong>{snapshot.shocksUsed}</strong>
                    </div>
                  </div>
                  <div className="menu-actions">
                    <button type="button" className="primary" onClick={restartCurrentSeed}>
                      Restart
                    </button>
                    <button type="button" onClick={randomizeSeed}>
                      New Seed
                    </button>
                    <button type="button" onClick={() => startGame(true)}>
                      Cinematic
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {!cinematic && (
          <nav className="controls" aria-label="Simulation controls">
            <button type="button" onClick={triggerShockwave} disabled={snapshot.shockCharge < 1 || screen !== "playing"}>
              Shock
            </button>
            <button type="button" onClick={cycleSpeed}>
              Speed {speedMultiplier}x
            </button>
            <button type="button" onClick={toggleMute}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={togglePause} disabled={screen === "menu" || screen === "coreDestroyed"}>
              {screen === "paused" ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={restartCurrentSeed}>
              Restart
            </button>
            <button type="button" onClick={randomizeSeed}>
              Seed
            </button>
            <button type="button" onClick={toggleCinematic}>
              Cinema
            </button>
            <button type="button" onClick={() => setDebug((value) => !value)}>
              Debug
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}
