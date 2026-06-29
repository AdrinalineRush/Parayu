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
  pill.classList.remove('leaving', 'busy', 'done', 'error');
  if (state === 'listening') {
    label.textContent = 'Listening';
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
});
