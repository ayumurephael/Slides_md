const katex = require('katex');

console.log('=== Simulating html2canvas Clipping Issue ===\n');

// This simulates what happens during html2canvas rendering
// The key issue: SVG delimiters are positioned with negative top values
// which causes them to extend beyond their parent containers

const testLatex = '\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i \\\\ j & k & l \\\\ m & n & o \\\\ p & q & r\\end{pmatrix}';
const html = katex.renderToString(testLatex, {
  displayMode: true,
  throwOnError: false,
  output: 'html'
});

// Extract key measurements
const strutMatch = html.match(/strut" style="height:([\d.]+)em/);
const strutHeight = strutMatch ? parseFloat(strutMatch[1]) : 0;

const valignMatch = html.match(/vertical-align:-([\d.]+)em/);
const valign = valignMatch ? parseFloat(valignMatch[1]) : 0;

// Content above baseline = strutHeight - valign
const contentAboveBaseline = strutHeight - valign;
const contentBelowBaseline = valign;

console.log('Content measurements:');
console.log(`  Total height (strut): ${strutHeight}em`);
console.log(`  Below baseline: ${valign}em`);
console.log(`  Above baseline: ${contentAboveBaseline}em`);

// Find SVG dimensions
const svgMatches = html.match(/<svg[^>]*>/g);
if (svgMatches) {
  svgMatches.forEach((svgTag, i) => {
    const heightMatch = svgTag.match(/height="([\d.]+)em"/);
    const viewBoxMatch = svgTag.match(/viewBox="([\d\s.]+)"/);
    
    if (heightMatch && viewBoxMatch) {
      const svgHeight = parseFloat(heightMatch[1]);
      const viewBox = viewBoxMatch[1].split(' ').map(Number);
      const vbHeight = viewBox[3];
      
      console.log(`\nSVG ${i + 1}:`);
      console.log(`  Height: ${svgHeight}em`);
      console.log(`  viewBox height: ${vbHeight}`);
    }
  });
}

// Find the vlist that contains the SVG
const vlistMatches = html.match(/vlist" style="height:([\d.]+)em/g);
if (vlistMatches) {
  console.log('\nvlist heights:');
  vlistMatches.forEach((m, i) => {
    const h = m.match(/height:([\d.]+)em/)[1];
    console.log(`  vlist ${i + 1}: ${h}em`);
  });
}

// Find negative top values and their associated pstrut heights
const topMatches = html.matchAll(/top:-([\d.]+)em;[^>]*><span class="pstrut" style="height:([\d.]+)em/g);
console.log('\nNegative top positions with pstrut heights:');
let match;
let idx = 0;
while ((match = topMatches.next()) && !match.done) {
  const m = match.value;
  const top = parseFloat(m[1]);
  const pstrut = parseFloat(m[2]);
  const svgTop = pstrut - top; // SVG top position relative to pstrut container
  console.log(`  ${++idx}: top=-${top}em, pstrut=${pstrut}em, SVG top at ${svgTop}em from container top`);
}

// Now let's analyze the clipping issue
console.log('\n=== Clipping Analysis ===');

// For the left delimiter (mopen):
const mopenIdx = html.indexOf('class="mopen"');
if (mopenIdx > 0) {
  const mopenEnd = html.indexOf('class="mord', mopenIdx);
  const mopenHtml = html.substring(mopenIdx, mopenEnd);
  
  // Get the vlist height inside mopen
  const vlistHMatch = mopenHtml.match(/vlist" style="height:([\d.]+)em/);
  const vlistH = vlistHMatch ? parseFloat(vlistHMatch[1]) : 0;
  
  // Get the SVG height
  const svgHMatch = mopenHtml.match(/height="([\d.]+)em"/);
  const svgH = svgHMatch ? parseFloat(svgHMatch[1]) : 0;
  
  // Get the top offset
  const topMatch = mopenHtml.match(/top:-([\d.]+)em/);
  const topOffset = topMatch ? parseFloat(topMatch[1]) : 0;
  
  console.log(`\nLeft delimiter (mopen):`);
  console.log(`  vlist height: ${vlistH}em`);
  console.log(`  SVG height: ${svgH}em`);
  console.log(`  SVG top offset: -${topOffset}em`);
  
  // Calculate how much SVG extends beyond vlist
  const svgBottom = svgH - topOffset; // SVG bottom position (positive = below container top)
  const overflowBottom = svgBottom - vlistH;
  
  console.log(`  SVG bottom position: ${svgBottom}em from container top`);
  console.log(`  Overflow below vlist: ${overflowBottom > 0 ? overflowBottom.toFixed(2) + 'em' : 'none'}`);
  
  if (overflowBottom > 0) {
    console.log(`  ⚠️ CLIPPING ISSUE: SVG extends ${overflowBottom.toFixed(2)}em below vlist boundary!`);
  }
}

// Check the same for Bmatrix
console.log('\n\n=== Bmatrix Analysis ===');
const bmatrixLatex = '\\begin{Bmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h\\end{Bmatrix}';
const bmatrixHtml = katex.renderToString(bmatrixLatex, {
  displayMode: true,
  throwOnError: false,
  output: 'html'
});

const bmMopenIdx = bmatrixHtml.indexOf('class="mopen"');
if (bmMopenIdx > 0) {
  const bmMopenEnd = bmatrixHtml.indexOf('class="mord', bmMopenIdx);
  const bmMopenHtml = bmatrixHtml.substring(bmMopenIdx, bmMopenEnd);
  
  // Get all vlist heights
  const vlistHeights = [];
  const vlistRegex = /vlist" style="height:([\d.]+)em/g;
  let vmatch;
  while ((vmatch = vlistRegex.exec(bmMopenHtml)) !== null) {
    vlistHeights.push(parseFloat(vmatch[1]));
  }
  
  // Get SVG heights
  const svgHeights = [];
  const svgRegex = /height="([\d.]+)em"/g;
  let smatch;
  while ((smatch = svgRegex.exec(bmMopenHtml)) !== null) {
    svgHeights.push(parseFloat(smatch[1]));
  }
  
  // Get negative top values
  const topValues = [];
  const topRegex = /top:-([\d.]+)em/g;
  let tmatch;
  while ((tmatch = topRegex.exec(bmMopenHtml)) !== null) {
    topValues.push(parseFloat(tmatch[1]));
  }
  
  console.log('Bmatrix mopen structure:');
  console.log(`  vlist heights: ${vlistHeights.map(h => h + 'em').join(', ')}`);
  console.log(`  SVG heights: ${svgHeights.map(h => h + 'em').join(', ')}`);
  console.log(`  Negative tops: ${topValues.map(t => '-' + t + 'em').join(', ')}`);
  
  // The key issue: SVGs are positioned with negative top values
  // and the vlist doesn't have enough height to contain them
  const totalSvgHeight = svgHeights.reduce((a, b) => a + b, 0);
  const maxVlistHeight = Math.max(...vlistHeights);
  
  console.log(`\n  Total SVG height: ${totalSvgHeight.toFixed(2)}em`);
  console.log(`  Max vlist height: ${maxVlistHeight}em`);
  
  if (totalSvgHeight > maxVlistHeight) {
    console.log(`  ⚠️ POTENTIAL CLIPPING: SVGs may overflow vlist boundary`);
  }
}

// Print the actual mopen HTML structure for debugging
console.log('\n\n=== Bmatrix mopen HTML (first 1000 chars) ===');
const bmMopenStart = bmatrixHtml.indexOf('class="mopen"');
console.log(bmatrixHtml.substring(bmMopenStart - 10, bmMopenStart + 1000));
