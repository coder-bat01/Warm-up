# Contributing to Warmup

Thank you for your interest in improving Warmup! We welcome bug reports, performance enhancements, and code contributions.

---

## 1. Core Architectural Invariants

Before proposing changes, please keep in mind the core principles that define Warmup:

1. **Local-First & Zero Telemetry:**
   - Warmup must never send telemetry, analytics, or user behavior tracking to any server.
   - All user data must remain in client-side storage (`localStorage`) or memory.
2. **Decoupled Game Loop:**
   - High-frequency game rendering belongs to the DOM engines (`PracticeEngine` and `TileGame`), not React state cycles.
   - Frame steps run on `requestAnimationFrame` using `performance.now()`. Do not introduce state hooks that trigger React reconciliation on every frame.
3. **No Heavyweight 3D Engines:**
   - Warmup is deliberately lightweight and starts instantly. Do not introduce Three.js, Babylon.js, Canvas overhead, or external asset packs.
4. **Resilient Storage Fallbacks:**
   - Never assume `localStorage` is accessible. All writes must tolerate `SecurityError` and fallback gracefully to in-memory state.

---

## 2. Development Setup

### Prerequisites
- Node.js 22 LTS or newer
- npm (bundled with Node.js)

### Local Workflow
```bash
# Clone your fork
git clone https://github.com/<your-username>/Warm-up.git
cd Warm-up

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be live at `http://localhost:5173/`.

### Windows / WSL Note
If you are developing in WSL against files mounted on `/mnt/c/`, file changes may not trigger Vite's file watcher. In that case, use:
```bash
CHOKIDAR_USEPOLLING=true npm run dev
```

---

## 3. Pull Request Guidelines

1. **Type Checking:** Ensure the project builds cleanly without TypeScript or bundler errors:
   ```bash
   npm run build
   ```
2. **Browser Verification:**
   - Test your changes in a modern browser (Chrome, Firefox, or Edge).
   - Test mouse and keyboard navigation.
   - For tile game modifications, verify native touch behavior on mobile viewports (e.g., 320 px and 390 px widths).
3. **Commit Messages:**
   Use clear, conventional commit messages:
   - `feat:` for new capabilities
   - `fix:` for bug fixes
   - `perf:` for latency or framerate improvements
   - `docs:` for documentation updates
   - `refactor:` for code restructuring without behavioral change

---

## 4. Reporting Issues

If you find a bug or performance bottleneck:
- Open an issue on GitHub with steps to reproduce.
- Include your operating system, browser version, and monitor refresh rate (Hz).
- If reporting a timing or score discrepancy, mention whether the issue occurs during pauses or tab switches.
