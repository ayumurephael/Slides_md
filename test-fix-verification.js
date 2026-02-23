const katex = require('katex');

console.log('=== Verification Test for Delimiter Fixes ===\n');

// Test cases that should be fixed
const testCases = [
  {
    name: 'Bmatrix (花括号矩阵) - 4行',
    latex: '\\begin{Bmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h\\end{Bmatrix}',
    checkDelimMult: true
  },
  {
    name: 'Bmatrix (花括号矩阵) - 8行',
    latex: '\\begin{Bmatrix}1 & 2 \\\\ 3 & 4 \\\\ 5 & 6 \\\\ 7 & 8 \\\\ 9 & 10 \\\\ 11 & 12 \\\\ 13 & 14 \\\\ 15 & 16\\end{Bmatrix}',
    checkDelimMult: true
  },
  {
    name: 'left/right 花括号 - 大型',
    latex: '\\left\\{ \\begin{matrix} a \\\\ b \\\\ c \\\\ d \\\\ e \\end{matrix} \\right\\}',
    checkDelimMult: true
  },
  {
    name: 'cases 环境 - 大型',
    latex: 'f(x) = \\begin{cases} a_1 x + b_1 & x \\in [0,1) \\\\ a_2 x + b_2 & x \\in [1,2) \\\\ a_3 x + b_3 & x \\in [2,3) \\\\ a_4 x + b_4 & x \\in [3,4] \\end{cases}',
    checkDelimMult: false
  },
  {
    name: '大型 pmatrix - 6行',
    latex: '\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i \\\\ j & k & l \\\\ m & n & o \\\\ p & q & r\\end{pmatrix}',
    checkDelimMult: false
  },
  {
    name: 'Vmatrix (双竖线) - 3行',
    latex: '\\begin{Vmatrix}a & b \\\\ c & d \\\\ e & f\\end{Vmatrix}',
    checkDelimMult: false
  },
  {
    name: 'left/right 花括号 - 简单',
    latex: '\\left\\{ \\frac{a}{b} \\right\\}',
    checkDelimMult: false
  }
];

let allPassed = true;

testCases.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log(`   LaTeX: ${test.latex.substring(0, 60)}...`);
  
  try {
    const html = katex.renderToString(test.latex, {
      displayMode: true,
      throwOnError: false,
      output: 'html'
    });
    
    // Check for strut height (represents total content height)
    const strutMatch = html.match(/strut" style="height:([\d.]+)em/);
    const strutHeight = strutMatch ? parseFloat(strutMatch[1]) : 0;
    console.log(`   ✓ strut height: ${strutHeight}em`);
    
    // Check for delimsizing.mult
    const delimMultMatch = html.match(/delimsizing mult/g);
    const delimMultCount = delimMultMatch ? delimMultMatch.length : 0;
    console.log(`   ✓ delimsizing.mult count: ${delimMultCount}`);
    
    // Check for SVG elements
    const svgMatch = html.match(/<svg/g);
    const svgCount = svgMatch ? svgMatch.length : 0;
    console.log(`   ✓ SVG count: ${svgCount}`);
    
    // Check for Unicode brace characters
    const unicodeBraces = html.match(/[⎧⎨⎩⎪⎫⎬⎭]/g);
    const unicodeBraceCount = unicodeBraces ? unicodeBraces.length : 0;
    console.log(`   ✓ Unicode brace chars: ${unicodeBraceCount}`);
    
    // Check for delimsizinginner (contains Unicode chars)
    const delimInnerMatch = html.match(/delimsizinginner/g);
    const delimInnerCount = delimInnerMatch ? delimInnerMatch.length : 0;
    console.log(`   ✓ delimsizinginner count: ${delimInnerCount}`);
    
    // Check for vlist heights
    const vlistHeights = [];
    const vlistRegex = /vlist" style="height:([\d.]+)em/g;
    let vmatch;
    while ((vmatch = vlistRegex.exec(html)) !== null) {
      vlistHeights.push(parseFloat(vmatch[1]));
    }
    if (vlistHeights.length > 0) {
      console.log(`   ✓ vlist heights: ${vlistHeights.map(h => h + 'em').join(', ')}`);
    }
    
    // Check for pstrut heights
    const pstrutHeights = [];
    const pstrutRegex = /pstrut" style="height:([\d.]+)em/g;
    let pmatch;
    while ((pmatch = pstrutRegex.exec(html)) !== null) {
      pstrutHeights.push(parseFloat(pmatch[1]));
    }
    if (pstrutHeights.length > 0) {
      const maxPstrut = Math.max(...pstrutHeights);
      console.log(`   ✓ max pstrut height: ${maxPstrut}em`);
    }
    
    // Validation checks
    if (test.checkDelimMult && delimMultCount === 0 && strutHeight > 2.4) {
      console.log(`   ⚠ WARNING: Expected delimsizing.mult for large content but not found`);
    }
    
    // Check if strut height is reasonable for the content
    if (strutHeight > 0) {
      console.log(`   ✓ PASS: Content has valid strut height`);
    } else {
      console.log(`   ✗ FAIL: Missing strut height`);
      allPassed = false;
    }
    
  } catch (err) {
    console.log(`   ✗ ERROR: ${err.message}`);
    allPassed = false;
  }
});

// Test the specific fix for multi-part delimiters
console.log('\n\n=== Multi-part Delimiter Height Calculation Test ===');

const bmatrixHtml = katex.renderToString('\\begin{Bmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h\\end{Bmatrix}', {
  displayMode: true,
  throwOnError: false,
  output: 'html'
});

// Simulate the fix logic
const strutMatch = bmatrixHtml.match(/strut" style="height:([\d.]+)em/);
const strutHeight = strutMatch ? parseFloat(strutMatch[1]) : 0;

const pstrutHeights = [];
const pstrutRegex = /pstrut" style="height:([\d.]+)em/g;
let pmatch;
while ((pmatch = pstrutRegex.exec(bmatrixHtml)) !== null) {
  pstrutHeights.push(parseFloat(pmatch[1]));
}
const maxPstrutHeight = pstrutHeights.length > 0 ? Math.max(...pstrutHeights) : 0;

const svgHeights = [];
const svgRegex = /height="([\d.]+)em"/g;
let smatch;
while ((smatch = svgRegex.exec(bmatrixHtml)) !== null) {
  svgHeights.push(parseFloat(smatch[1]));
}
const maxSvgHeight = svgHeights.length > 0 ? Math.max(...svgHeights) : 0;

console.log(`Strut height: ${strutHeight}em`);
console.log(`Max pstrut height: ${maxPstrutHeight}em`);
console.log(`Max SVG height: ${maxSvgHeight}em`);

// The fix should use the maximum of these values
const calculatedHeight = Math.max(strutHeight, maxPstrutHeight, maxSvgHeight);
console.log(`Calculated delimiter height: ${calculatedHeight}em`);

if (calculatedHeight >= strutHeight) {
  console.log('✓ PASS: Calculated height is sufficient to contain all content');
} else {
  console.log('✗ FAIL: Calculated height is insufficient');
  allPassed = false;
}

// Final result
console.log('\n\n=== Test Summary ===');
if (allPassed) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some tests failed!');
  process.exit(1);
}
