const screenImage = document.getElementById('screen');
const selection = document.getElementById('selection');
const memoPanel = document.getElementById('memoPanel');
const preview = document.getElementById('preview');
const memo = document.getElementById('memo');
const error = document.getElementById('error');
let start = null;
let region = null;
let croppedImage = null;

window.contextyCapture.onSource(source => { screenImage.src = source; });

function rectFromPoints(first, second) {
  return {
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    width: Math.abs(first.x - second.x),
    height: Math.abs(first.y - second.y)
  };
}

function showSelection(rect) {
  document.getElementById('shade').hidden = true;
  selection.hidden = false;
  Object.assign(selection.style, {
    left: `${rect.x}px`, top: `${rect.y}px`,
    width: `${rect.width}px`, height: `${rect.height}px`
  });
}

function crop(rect) {
  const xRatio = screenImage.naturalWidth / window.innerWidth;
  const yRatio = screenImage.naturalHeight / window.innerHeight;
  const sourceWidth = Math.round(rect.width * xRatio);
  const sourceHeight = Math.round(rect.height * yRatio);
  const factor = Math.min(1, 1400 / sourceWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * factor));
  canvas.height = Math.max(1, Math.round(sourceHeight * factor));
  canvas.getContext('2d').drawImage(
    screenImage,
    Math.round(rect.x * xRatio), Math.round(rect.y * yRatio),
    sourceWidth, sourceHeight,
    0, 0, canvas.width, canvas.height
  );
  return canvas.toDataURL('image/jpeg', .8);
}

window.addEventListener('pointerdown', event => {
  if (memoPanel.hidden && screenImage.complete && screenImage.naturalWidth) {
    start = { x: event.clientX, y: event.clientY };
    document.body.setPointerCapture(event.pointerId);
    showSelection({ x: start.x, y: start.y, width: 0, height: 0 });
  }
});
window.addEventListener('pointermove', event => {
  if (start) showSelection(rectFromPoints(start, { x: event.clientX, y: event.clientY }));
});
window.addEventListener('pointerup', event => {
  if (!start) return;
  region = rectFromPoints(start, { x: event.clientX, y: event.clientY });
  start = null;
  if (region.width < 12 || region.height < 12) { selection.hidden = true; document.getElementById('shade').hidden = false; return; }
  croppedImage = crop(region);
  preview.src = croppedImage;
  selection.hidden = true;
  document.getElementById('shade').hidden = false;
  document.getElementById('shade').style.background = '#08131d88';
  document.getElementById('hint').hidden = true;
  memoPanel.hidden = false;
  memo.focus();
});

function retry() {
  memoPanel.hidden = true;
  document.getElementById('hint').hidden = false;
  document.getElementById('shade').hidden = false;
  document.getElementById('shade').style.background = '';
  region = null;
  croppedImage = null;
  error.textContent = '';
}

document.getElementById('retry').onclick = retry;
document.getElementById('cancel').onclick = () => window.contextyCapture.cancel();
document.getElementById('send').onclick = async () => {
  const text = memo.value.trim();
  if (!text) { error.textContent = '请先写下此刻的想法。'; memo.focus(); return; }
  const button = document.getElementById('send');
  button.disabled = true;
  error.textContent = '';
  try { await window.contextyCapture.save({ image: croppedImage, memo: text }); }
  catch (failure) { error.textContent = failure.message; button.disabled = false; }
};
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); window.contextyCapture.cancel(); }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !memoPanel.hidden) document.getElementById('send').click();
});
