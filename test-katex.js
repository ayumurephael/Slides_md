const katex = require('katex');

// Test large matrix
const latex1 = '\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i \\\\ j & k & l\\end{pmatrix}';
const latex2 = '\\left|\\begin{array}{ccc}a & b & c \\\\ d & e & f \\\\ g & h & i\\end{array}\\right|';
const latex3 = '\\left(\\begin{matrix}a \\\\ b \\\\ c \\\\ d \\\\ e\\end{matrix}\\right)';

console.log('=== Test 1: Large pmatrix ===');
const html1 = katex.renderToString(latex1, { displayMode: true, throwOnError: false, output: 'html' });
console.log('SVG elements:', (html1.match(/<svg/g) || []).length);
console.log('delimsizing elements:', (html1.match(/delimsizing/g) || []).length);
console.log('stretchy elements:', (html1.match(/stretchy/g) || []).length);

console.log('\n=== Test 2: Determinant with array ===');
const html2 = katex.renderToString(latex2, { displayMode: true, throwOnError: false, output: 'html' });
console.log('SVG elements:', (html2.match(/<svg/g) || []).length);
console.log('delimsizing elements:', (html2.match(/delimsizing/g) || []).length);

console.log('\n=== Test 3: Tall matrix with left/right ===');
const html3 = katex.renderToString(latex3, { displayMode: true, throwOnError: false, output: 'html' });
console.log('SVG elements:', (html3.match(/<svg/g) || []).length);
console.log('delimsizing elements:', (html3.match(/delimsizing/g) || []).length);

// Check viewBox attributes
const viewBoxMatches = html1.match(/viewBox="[^"]+"/g);
console.log('\n=== viewBox values in pmatrix ===');
if (viewBoxMatches) {
  viewBoxMatches.forEach((v, i) => console.log(`SVG ${i+1}: ${v}`));
}

// Print a snippet of the HTML to understand the structure
console.log('\n=== HTML snippet for pmatrix (first 2000 chars) ===');
console.log(html1.substring(0, 2000));
