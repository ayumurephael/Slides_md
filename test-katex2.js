const katex = require('katex');

// Test very tall matrix (8 rows)
const latexTall = '\\begin{pmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h \\\\ i & j \\\\ k & l \\\\ m & n \\\\ o & p\\end{pmatrix}';

console.log('=== Test: Very tall 8x2 matrix ===');
const htmlTall = katex.renderToString(latexTall, { displayMode: true, throwOnError: false, output: 'html' });

// Extract SVG elements and their parents
const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/g;
const svgs = htmlTall.match(svgRegex) || [];
console.log('Number of SVGs:', svgs.length);

svgs.forEach((svg, i) => {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);
  const widthMatch = svg.match(/width="([^"]+)"/);
  console.log(`\nSVG ${i+1}:`);
  console.log('  viewBox:', viewBoxMatch ? viewBoxMatch[1] : 'N/A');
  console.log('  height:', heightMatch ? heightMatch[1] : 'N/A');
  console.log('  width:', widthMatch ? widthMatch[1] : 'N/A');
});

// Find the parent span structure
const parentRegex = /<span style="width:([^;]+);height:([^;]+);"/g;
let match;
console.log('\n=== Parent span dimensions ===');
while ((match = parentRegex.exec(htmlTall)) !== null) {
  console.log(`width: ${match[1]}, height: ${match[2]}`);
}

// Check strut height
const strutMatch = htmlTall.match(/strut" style="height:([^;]+);/);
console.log('\n=== Strut height ===');
console.log(strutMatch ? strutMatch[1] : 'N/A');

// Check vlist heights
const vlistRegex = /vlist" style="height:([^;]+);/g;
console.log('\n=== vlist heights ===');
while ((match = vlistRegex.exec(htmlTall)) !== null) {
  console.log('vlist height:', match[1]);
}

// Check pstrut heights
const pstrutRegex = /pstrut" style="height:([^;]+);/g;
console.log('\n=== pstrut heights ===');
while ((match = pstrutRegex.exec(htmlTall)) !== null) {
  console.log('pstrut height:', match[1]);
}

// Print relevant portion of HTML for delimsizing
const delimStart = htmlTall.indexOf('delimsizing mult');
if (delimStart > 0) {
  console.log('\n=== delimsizing mult HTML (500 chars) ===');
  console.log(htmlTall.substring(delimStart - 50, delimStart + 500));
}
