const pill = document.getElementById('pill');
const label = document.getElementById('label');
const bars = Array.from(document.querySelectorAll('.bar'));

// Each bar keeps its own smoothed height so the waveform ripples outward from
// the centre instead of every bar jumping in lockstep.
const NUM = bars.length;
const center = (NUM - 1) / 2;
const heights = new Array(NUM).fill(4);
let targetLevel = 0;

function frame() {
  for (let i = 0; i < NUM; i++) {
    // Bars near the centre react most strongly; edges stay subtler.
    const distance = Math.abs(i - center) / center;
    const falloff = 1 - distance * 0.55;
    // A little per-bar variance keeps it organic rather than a flat block.
    const jitter = 0.75 + Math.random() * 0.5;
    const target = 4 + targetLevel * 22 * falloff * jitter;
    // Smooth toward target: fast attack, slower release feels natural.
    const speed = target > heights[i] ? 0.55 : 0.22;
    heights[i] += (target - heights[i]) * speed;
    bars[i].style.height = heights[i].toFixed(1) + 'px';
  }
  // Decay the level so bars settle when you go quiet.
  targetLevel *= 0.9;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.parayuOverlay.onState((state) => {
  pill.classList.remove('leaving');
  if (state === 'listening') {
    pill.classList.remove('transcribing');
    label.textContent = 'Listening';
  } else if (state === 'transcribing') {
    pill.classList.add('transcribing');
    label.textContent = 'Transcribing';
    targetLevel = 0;
  } else if (state === 'leaving') {
    pill.classList.add('leaving');
  }
});

// Progress text (model download / load) shown while transcribing, so the first
// run doesn't look frozen. Only meaningful during the transcribing state.
window.parayuOverlay.onStatus((text) => {
  if (pill.classList.contains('transcribing')) label.textContent = text;
});

window.parayuOverlay.onLevel((level) => {
  targetLevel = Math.max(targetLevel, level);
});
