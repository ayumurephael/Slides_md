const katex = require('katex');

const latex = '\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i \\\\ j & k & l\\end{pmatrix}';
const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, output: 'html' });

console.log('=== Full HTML Structure Analysis ===\n');

// Extract key style values
const strutMatch = html.match(/class="strut"[^>]*style="([^"]+)"/);
console.log('Strut style:', strutMatch ? strutMatch[1] : 'not found');

// Find the mopen (left delimiter) structure
const mopenMatch = html.match(/class="mopen"([^]*?)class="mord"/);
if (mopenMatch) {
  const mopenHtml = mopenMatch[1];
  
  // Extract vlist height
  const vlistHeightMatch = mopenHtml.match(/class="vlist"[^>]*style="height:([^;]+);/);
  console.log('\nvlist height:', vlistHeightMatch ? vlistHeightMatch[1] : 'not found');
  
  // Extract top offset
  const topMatch = mopenHtml.match(/top:-([^;]+)em/);
  console.log('top offset (em):', topMatch ? topMatch[1] : 'not found');
  
  // Extract pstrut height
  const pstrutMatch = mopenHtml.match(/class="pstrut"[^>]*style="height:([^;]+)em/);
  console.log('pstrut height (em):', pstrutMatch ? pstrutMatch[1] : 'not found');
  
  // Extract SVG height
  const svgHeightMatch = mopenHtml.match(/height="([^"]+)"/);
  console.log('SVG height attr:', svgHeightMatch ? svgHeightMatch[1] : 'not found');
  
  // Extract viewBox
  const viewBoxMatch = mopenHtml.match(/viewBox="([^"]+)"/);
  console.log('viewBox:', viewBoxMatch ? viewBoxMatch[1] : 'not found');
  
  // Extract inline span style
  const spanStyleMatch = mopenHtml.match(/<span style="width:([^;]+);height:([^;]+);"/);
  if (spanStyleMatch) {
    console.log('Span width:', spanStyleMatch[1]);
    console.log('Span height:', spanStyleMatch[2]);
  }
}

// Calculate the positioning
console.log('\n=== Positioning Analysis ===');
// strut height = 4.8em, vertical-align = -2.15em
// This means: total height = 4.8em, below baseline = 2.15em, above baseline = 4.8 - 2.15 = 2.65em
// vlist height = 2.65em (above baseline)
// top offset = -4.65em (relative to pstrut of 6.8em)
// SVG height = 4.8em

// The issue: SVG is positioned at top:-4.65em from a pstrut of 6.8em
// So SVG top is at: 6.8em - 4.65em = 2.15em above the baseline
// SVG height is 4.8em, so SVG bottom is at: 2.15em - 4.8em = -2.65em below baseline
// But the vlist only has height 2.65em, so the bottom part gets clipped!

console.log('Key insight:');
console.log('- strut height: 4.8em (total content height)');
console.log('- vertical-align: -2.15em (content below baseline)');
console.log('- vlist height: 2.65em (content above baseline)');
console.log('- SVG height: 4.8em (full delimiter height)');
console.log('- SVG top offset: -4.65em (from pstrut top)');
console.log('');
console.log('Problem: SVG needs 4.8em vertical space, but vlist only provides 2.65em');
console.log('The SVG extends 2.15em below the vlist, causing bottom clipping!');

// Print the mopen structure
console.log('\n=== mopen HTML snippet ===');
const mopenStart = html.indexOf('class="mopen"');
const mopenEnd = html.indexOf('class="mord"');
if (mopenStart !== -1 && mopenEnd !== -1) {
  console.log(html.substring(mopenStart - 10, mopenEnd + 200));
}
