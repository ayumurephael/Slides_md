const katex = require('katex');

console.log('=== Deep Analysis: left/right braces ===\n');

// Test different brace scenarios
const braceTests = [
  {
    name: 'left/right 花括号 - 小型',
    latex: '\\left\\{ a \\right\\}'
  },
  {
    name: 'left/right 花括号 - 中型',
    latex: '\\left\\{ \\frac{a}{b} \\right\\}'
  },
  {
    name: 'left/right 花括号 - 大型',
    latex: '\\left\\{ \\begin{matrix} a \\\\ b \\\\ c \\end{matrix} \\right\\}'
  },
  {
    name: 'Bmatrix',
    latex: '\\begin{Bmatrix} a \\\\ b \\\\ c \\end{Bmatrix}'
  },
  {
    name: 'cases',
    latex: '\\begin{cases} a & x > 0 \\\\ b & x < 0 \\end{cases}'
  }
];

braceTests.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log(`   LaTeX: ${test.latex}`);
  
  const html = katex.renderToString(test.latex, {
    displayMode: true,
    throwOnError: false,
    output: 'html'
  });
  
  // Check for delimsizing
  const delimMultMatch = html.match(/delimsizing mult/g);
  const delimMatch = html.match(/delimsizing(?!"\s|inner)/g);
  console.log(`   delimsizing mult: ${delimMultMatch ? delimMultMatch.length : 0}`);
  console.log(`   delimsizing (non-mult): ${delimMatch ? delimMatch.length : 0}`);
  
  // Check for SVG
  const svgMatch = html.match(/<svg/g);
  console.log(`   SVG elements: ${svgMatch ? svgMatch.length : 0}`);
  
  // Check for Unicode brace characters
  const unicodeBraces = html.match(/[⎧⎨⎩⎪⎫⎬⎭]/g);
  console.log(`   Unicode brace chars: ${unicodeBraces ? unicodeBraces.join(' ') : 'none'}`);
  
  // Check for font-based delimiters (delimsizinginner)
  const delimInnerMatch = html.match(/delimsizinginner/g);
  console.log(`   delimsizinginner: ${delimInnerMatch ? delimInnerMatch.length : 0}`);
  
  // Check the actual delimiter content
  const mopenMatch = html.match(/class="mopen"[^]*?class="mord/);
  if (mopenMatch) {
    const mopenContent = mopenMatch[0];
    // Check what's inside the mopen
    const hasSvg = mopenContent.includes('<svg');
    const hasUnicode = /[⎧⎨⎩⎪]/.test(mopenContent);
    const hasFontDelim = mopenContent.includes('delimsizinginner');
    console.log(`   mopen content: SVG=${hasSvg}, Unicode=${hasUnicode}, FontDelim=${hasFontDelim}`);
  }
  
  // For debugging: print a snippet of the delimiter structure
  const delimStart = html.indexOf('delimsizing');
  if (delimStart > 0) {
    console.log(`   Delimiter snippet: ${html.substring(delimStart - 10, delimStart + 200)}`);
  }
});

// Now let's check what happens with the actual rendering
console.log('\n\n=== Checking KaTeX delimiter sizing logic ===');

// Test with different content heights
const heightTests = [
  '\\left\\{ x \\right\\}',
  '\\left\\{ \\frac{x}{y} \\right\\}',
  '\\left\\{ \\frac{\\frac{a}{b}}{\\frac{c}{d}} \\right\\}',
  '\\left\\{ \\begin{matrix} a \\\\ b \\end{matrix} \\right\\}',
  '\\left\\{ \\begin{matrix} a \\\\ b \\\\ c \\\\ d \\end{matrix} \\right\\}',
];

heightTests.forEach((latex, idx) => {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, output: 'html' });
  const strutMatch = html.match(/strut" style="height:([\d.]+)em/);
  const svgMatch = html.match(/<svg/g);
  const delimMultMatch = html.match(/delimsizing mult/g);
  
  console.log(`\nTest ${idx + 1}: ${latex.substring(0, 50)}...`);
  console.log(`  strut height: ${strutMatch ? strutMatch[1] + 'em' : 'N/A'}`);
  console.log(`  SVG count: ${svgMatch ? svgMatch.length : 0}`);
  console.log(`  delimsizing mult: ${delimMultMatch ? delimMultMatch.length : 0}`);
});

// Check the specific case that might cause garbled output
console.log('\n\n=== Checking for potential garbled output ===');
const garbledTest = '\\left\\{ \\begin{matrix} a & b \\\\ c & d \\end{matrix} \\right\\}';
const garbledHtml = katex.renderToString(garbledTest, { displayMode: true, throwOnError: false, output: 'html' });

// Look for any character that might be rendered incorrectly
const specialChars = garbledHtml.match(/[^\x00-\x7F]/g);
if (specialChars) {
  console.log('Non-ASCII characters found:');
  const uniqueChars = [...new Set(specialChars)];
  uniqueChars.forEach(char => {
    console.log(`  "${char}" (U+${char.charCodeAt(0).toString(16).toUpperCase()})`);
  });
}

// Check if the delimiter uses font characters vs SVG
const leftDelimMatch = garbledHtml.match(/mopen[^]*?mord/);
if (leftDelimMatch) {
  const leftDelim = leftDelimMatch[0];
  console.log('\nLeft delimiter structure:');
  console.log(leftDelim.substring(0, 500));
}
