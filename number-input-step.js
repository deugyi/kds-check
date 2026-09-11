/* Keep native number spinners on a lattice through the current value.
 * HTML uses min as its step base: min=1, step=50 otherwise snaps 600 to 601.
 * The lowest reachable value stays at or above the original minimum.
 */
(function(){
'use strict';
const limits=new WeakMap();
function align(input){
  if(!input?.matches?.('input[type="number"]'))return;
  const step=Number(input.getAttribute('step'));
  if(!Number.isFinite(step)||step<=1||!input.hasAttribute('min'))return;
  if(!limits.has(input))limits.set(input,input.getAttribute('min'));
  const original=limits.get(input),minimum=Number(original),value=input.valueAsNumber;
  if(!Number.isFinite(minimum))return;
  if(!Number.isFinite(value)||value<minimum){input.min=original;return;}
  const remainder=((value-minimum)%step+step)%step;
  input.min=String(Number((minimum+remainder).toPrecision(14)));
}
document.querySelectorAll('input[type="number"]').forEach(align);
// Capture before page calculators run. Focus/pointer/key events also cover
// dynamically generated stage fields and programmatically selected RH sizes.
for(const event of ['focusin','pointerdown','keydown','input'])
  document.addEventListener(event,e=>align(e.target),true);
})();
