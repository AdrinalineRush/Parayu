const pill = document.getElementById('pill');
const label = document.getElementById('label');
const bars = Array.from(document.querySelectorAll('.bar'));

// Each bar keeps its own smoothed height so the waveform ripples outward from
// the centre instead of every bar jumping in lockstep.
const NUM = bars.length;
const center = (NUM - 1) / 2;
const heights = new Array(NUM).fill(4);
let targetLevel = 0;

let currentState = '';
let listeningStartTime = 0;
let averageLevel = 0.15; // Start with a healthy initial baseline so it doesn't trigger "Come closer" instantly

function frame() {
  const time = Date.now() * 0.007; // Control speed of the idle breathing wave
  
  // Interactive Volume Check: if the speaker is too quiet, prompt them to speak louder or come closer.
  if (currentState === 'listening') {
    // If they start speaking, instantly clear any warnings
    if (targetLevel > 0.06) {
      averageLevel = 0.15; // Reset average level tracking
      label.textContent = 'Listening';
      label.style.color = '';
    } else {
      const elapsed = Date.now() - listeningStartTime;
      if (elapsed > 1800) {
        if (averageLevel < 0.04) {
          if (elapsed > 6000) {
            label.textContent = "I can't hear you...";
            label.style.color = '#ff6a3d';
          } else if (elapsed > 3800) {
            label.textContent = 'Move closer...';
            label.style.color = '#ff6a3d';
          } else {
            label.textContent = 'Speak louder...';
            label.style.color = '#ff6a3d';
          }
        } else {
          label.textContent = 'Listening';
          label.style.color = '';
        }
      }
    }
  }

  for (let i = 0; i < NUM; i++) {
    // Bars near the centre react most strongly; edges stay subtler.
    const distance = Math.abs(i - center) / center;
    const falloff = 1 - distance * 0.55;
    // A little per-bar variance keeps it organic rather than a flat block.
    const jitter = 0.75 + Math.random() * 0.5;
    
    // Idle wave: smooth, organic breathing wave when silent (height: 0px to 8px)
    const idleWave = Math.sin(time + i * 0.9) * 4 + 4;
    // Dampen the idle wave as targetLevel increases (speech starts driving the wave)
    const speechActiveFactor = Math.min(1, targetLevel * 6);
    const idleTerm = idleWave * (1 - speechActiveFactor);
    
    // Taller active scale (targetLevel * 45 instead of 22) for high visual feedback when speaking
    const target = 4 + (targetLevel * 45 * falloff * jitter) + idleTerm;
    
    // Smooth toward target: fast attack (0.65), slightly slower release (0.25)
    const speed = target > heights[i] ? 0.65 : 0.25;
    heights[i] += (target - heights[i]) * speed;
    bars[i].style.height = heights[i].toFixed(1) + 'px';
  }
  
  // Decay the level so bars settle when you go quiet. Faster decay for crisper spikes.
  targetLevel *= 0.88;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.parayuOverlay.onState((state) => {
  currentState = state;
  pill.classList.remove('leaving', 'busy', 'done', 'error');
  if (state === 'listening') {
    label.textContent = 'Listening';
    label.style.color = '';
    listeningStartTime = Date.now();
    averageLevel = 0.15; // Reset average level tracking
  } else if (state === 'transcribing') {
    pill.classList.add('busy');
    label.textContent = 'Transcribing';
    targetLevel = 0;
  } else if (state === 'processing') {
    pill.classList.add('busy');
    label.textContent = 'Processing Audio';
    targetLevel = 0;
  } else if (state === 'cleaning') {
    pill.classList.add('busy');
    label.textContent = 'Cleaning Text';
    targetLevel = 0;
  } else if (state === 'formatting') {
    pill.classList.add('busy');
    label.textContent = 'Formatting';
    targetLevel = 0;
  } else if (state === 'pasting') {
    pill.classList.add('busy');
    label.textContent = 'Pasting';
    targetLevel = 0;
  } else if (state === 'done') {
    pill.classList.add('done');
    label.textContent = 'Done';
  } else if (state === 'error') {
    pill.classList.add('error');
    label.textContent = 'Error';
  } else if (state === 'leaving') {
    pill.classList.add('leaving');
  }
});

// Progress text (model download / load) shown while transcribing, so the first
// run doesn't look frozen. Only meaningful during the transcribing state.
window.parayuOverlay.onStatus((text) => {
  if (pill.classList.contains('busy')) label.textContent = text;
});

window.parayuOverlay.onLevel((level) => {
  targetLevel = Math.max(targetLevel, level);
  if (currentState === 'listening') {
    // Keep a running exponential moving average of the input levels
    averageLevel = averageLevel * 0.92 + level * 0.08;
  }
});
