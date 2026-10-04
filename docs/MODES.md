# Warmup Game Modes & Scoring Specification

This document provides the complete functional and mathematical specification for each drill in the Warmup application.

---

## Mode Comparison Matrix

| Drill | Duration | Target Dimensions | Primary Scoring Metric | Sort Direction |
| --- | --- | --- | --- | --- |
| **Targets** | 30s / 60s | 76 / 52 / 32 px | Hits per active second (HPS) | Higher is better |
| **Reaction** | 5 rounds / 30s | Full arena | Median latency (ms) | Lower is better |
| **Flicks** | 30s / 60s | 76 / 52 / 32 px | Average time to hit (ms) | Lower is better |
| **Tracking** | 30s / 60s | 76 / 52 / 32 px | On-target time percentage (%) | Higher is better |
| **Don’t Tap (Frenzy)** | 30s | 4 × 4 grid | Total black tiles tapped | Higher is better |
| **Don’t Tap (Endurance)** | Variable | 4 × 4 grid | Total black tiles tapped | Higher is better |
| **Don’t Tap (Pattern)** | Variable | 4 × 4 grid | Complete-run time (seconds) | Lower is better |

---

## 1. Target Practice (Precision)

### Concept
Tests pure clicking speed and point-and-click accuracy under time pressure. A single circular target is active at any time. Clicking the target registers a hit, plays no distracting audio, and immediately spawns a new target in a random location within arena boundaries.

### Target Sizes
- **Easy:** 76 CSS pixels diameter
- **Medium (Default):** 52 CSS pixels diameter
- **Hard:** 32 CSS pixels diameter

### Mathematical Formulation
Given total active session time $T_{\text{active}}$ in seconds, successful hits $H$, and off-target misses $M$:

$$\text{Hits Per Second (HPS)} = \frac{H}{T_{\text{active}}}$$

$$\text{Accuracy (\%)} = \begin{cases} 0\% & \text{if } H + M = 0 \\ \left(\frac{H}{H + M}\right) \times 100\% & \text{if } H + M > 0 \end{cases}$$

### Personal Best Qualification
- Ranking is determined primarily by **HPS**.
- Tied HPS scores are broken by higher accuracy percentage.

---

## 2. Reaction Test (Reflexes)

### Concept
Measures neurological simple reaction time (visual stimulus to motor action).

### Signal States & Visual Accessibility
1. **Waiting State:** Screen displays green `#397b54` with a circular icon and bold text: **"Wait"**.
2. **Ready State:** After randomized delay, screen flashes red `#ac4f45` with a lightning bolt icon and text: **"Click now!"**.
3. **Premature Click State:** Clicking during the green state triggers an early warning: **"Too soon!"**, requiring another click to re-arm.

### Stimulus Timing Formula
The waiting duration $t_{\text{wait}}$ is randomly drawn from a continuous uniform distribution:

$$t_{\text{wait}} \sim \mathcal{U}(2000\text{ ms}, 5000\text{ ms})$$

### Formats
- **Standard (Solo):** 5 valid attempts. Early clicks do not count towards the 5 attempts.
- **Timed Sprint (Guided Warmup):** 30 seconds of continuous reaction testing.

### Mathematical Formulation
For $n$ sorted valid reaction times $R_1 \le R_2 \le \dots \le R_n$:

$$\text{Score} = \text{Median}(R) = \begin{cases} R_{(n+1)/2} & \text{if } n \text{ is odd} \\ \frac{R_{n/2} + R_{n/2+1}}{2} & \text{if } n \text{ is even} \end{cases}$$

Using the median prevents a single momentary distraction or an accidental click from distorting the overall benchmark.

---

## 3. Flick Practice (Speed)

### Concept
Measures rapid lateral target acquisition and crosshair recentering. Targets alternate strictly between the left half and right half of the arena:

$$\text{Target}_i \in \begin{cases} \text{Left Hemisphere } [0, 0.45 \times W] & \text{if } i \text{ is odd} \\ \text{Right Hemisphere } [0.55 \times W, W] & \text{if } i \text{ is even} \end{cases}$$

### Miss Handling
Clicks outside the target count as misses, but **the target does not move**. The player must correct their aim and hit the target to advance.

### Mathematical Formulation
For each hit $i$, let $t_{\text{spawn}, i}$ be the exact timestamp when the target appeared, and $t_{\text{hit}, i}$ be the timestamp when the hit was registered:

$$\text{Latency}_i = t_{\text{hit}, i} - t_{\text{spawn}, i}$$

$$\text{Average Flick Time} = \frac{1}{H} \sum_{i=1}^{H} \text{Latency}_i$$

Lower average flick time represents superior speed.

---

## 4. Tracking Practice (Control)

### Concept
Measures smooth continuous pursuit without clicking. Tests steady mouse pad control, wrist micro-adjustments, and tracking consistency.

### Movement Physics
The target traverses the arena following continuous parameterized sinusoidal velocity curves:

$$x(t) = x_0 + A_x \sin(\omega_x t + \phi_x), \quad y(t) = y_0 + A_y \cos(\omega_y t + \phi_y)$$

When nearing the arena boundary, velocity vectors reflect smoothly with randomized tangential perturbation.

### Speeds
- **Slow:** $\sim 220\text{ px/s}$
- **Steady (Default):** $\sim 380\text{ px/s}$
- **Fast:** $\sim 560\text{ px/s}$

### Mathematical Formulation
Let $\Delta t_k$ be the duration of frame $k$, and let $D_k$ be the Euclidean distance from the cursor position $(x_m, y_m)$ to target center $(x_t, y_t)$:

$$I_k = \begin{cases} 1 & \text{if } D_k \le \text{Radius} \\ 0 & \text{if } D_k > \text{Radius} \end{cases}$$

$$\text{Tracking Time} = \sum_{k=1}^{N} I_k \Delta t_k$$

$$\text{Coverage Percentage} = \min\left(100\%, \frac{\text{Tracking Time}}{T_{\text{active}}} \times 100\%\right)$$

---

## 5. Don’t Tap (Tile Agility)

A 4 × 4 interactive grid inspired by classic rhythm-reflex games.

```text
┌───┬───┬───┬───┐
│   │ ■ │   │   │
├───┼───┼───┼───┤
│   │   │ ■ │   │
├───┼───┼───┼───┤
│   │   │   │   │
├───┼───┼───┼───┤
│ ■ │   │   │   │
└───┴───┴───┴───┘
```

### Universal Rules
- Tapping a **black tile** registers a point or marks the cell cleared.
- Tapping any **white tile** ends the round immediately (`reason = 'white'`).

### Variant Specifications

#### A. Frenzy
- **Timer:** Fixed 30.0 active seconds.
- **Mechanics:** Exactly 1 black tile is present at any moment. Tapping it relocates it to any other unoccupied tile.
- **Score:** Total black tiles tapped ($N_{\text{taps}}$). Higher is better.

#### B. Endurance
- **Timer:** Starts at $10.0\text{ seconds}$.
- **Mechanics:** 1 black tile present. Every 40 successful taps grants $+10.0\text{ seconds}$ added to remaining time:
  $$T_{\text{remaining}} \leftarrow T_{\text{remaining}} + 10\,000\text{ ms} \quad (\forall N_{\text{taps}} \equiv 0 \pmod{40})$$
- **Deadline Guard:** If $T_{\text{remaining}} \le 0$, the round ends immediately. A tap made at or after $t = 0$ is rejected and cannot award bonus time.
- **Score:** Total black tiles tapped. Higher is better.

#### C. Pattern
- **Target:** 10 consecutive boards of 4 black tiles each (40 tiles total).
- **Mechanics:** All 4 black tiles can be tapped in any sequence. Tapped tiles turn green with a checkmark and cannot be retapped. Once all 4 are tapped, the next pattern renders instantly.
- **Score:** Elapsed time to complete all 40 tiles.
- **Eligibility:** Only complete 10-pattern runs (`reason = 'complete'`) set a personal best. Runs terminated early by white tile taps do not set a best time.

---

## 6. 3-Minute Warmup Routine

### Sequence & Configuration

```text
Stage 1: Reaction Test (30 seconds, continuous timed sprint)
   ↓ [3s Countdown]
Stage 2: Target Practice (60 seconds, Medium 52 px targets)
   ↓ [3s Countdown]
Stage 3: Flick Practice (30 seconds, Medium 52 px targets)
   ↓ [3s Countdown]
Stage 4: Tracking Practice (60 seconds, Medium 52 px targets, Steady speed)
```

- **Total Active Time:** $30 + 60 + 30 + 60 = 180\text{ seconds}$ (exactly 3 minutes).
- **Total Wall Time:** $\sim 192\text{ seconds}$ (accounting for four 3-second countdown intervals).
- **Persistence:** Each completed stage is saved individually into `warmup.sessions.v1` under its respective settings group, ensuring individual performance metrics contribute to long-term trend lines.
