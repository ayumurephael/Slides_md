const katex = require('katex');

console.log('=== KaTeX Delimiter Analysis ===\n');

// Test cases
const testCases = [
  {
    name: 'Bmatrix (花括号矩阵)',
    latex: '\\begin{Bmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h\\end{Bmatrix}'
  },
  {
    name: 'left/right 花括号',
    latex: '\\left\\{ \\begin{matrix} a & b \\\\ c & d \\end{matrix} \\right\\}'
  },
  {
    name: 'cases 环境',
    latex: 'f(x) = \\begin{cases} x^2 & x > 0 \\\\ -x^2 & x < 0 \\end{cases}'
  },
  {
    name: '大型 pmatrix',
    latex: '\\begin{pmatrix}a & b & c \\\\ d & e & f \\\\ g & h & i \\\\ j & k & l \\\\ m & n & o \\\\ p & q & r\\end{pmatrix}'
  },
  {
    name: 'left/right 圆括号',
    latex: '\\left( \\begin{matrix} a \\\\ b \\\\ c \\\\ d \\\\ e \\end{matrix} \\right)'
  },
  {
    name: 'Vmatrix (双竖线)',
    latex: '\\begin{Vmatrix}a & b \\\\ c & d \\\\ e & f\\end{Vmatrix}'
  }
];

testCases.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log(`   LaTeX: ${test.latex.substring(0, 60)}...`);
  
  try {
    const html = katex.renderToString(test.latex, {
      displayMode: true,
      throwOnError: false,
      output: 'html'
    });
    
    // Count SVG elements
    const svgCount = (html.match(/<svg/g) || []).length;
    console.log(`   SVG elements: ${svgCount}`);
    
    // Check for delimsizing
    const delimCount = (html.match(/delimsizing/g) || []).length;
    console.log(`   delimsizing elements: ${delimCount}`);
    
    // Check for mopen/mclose
    const mopenCount = (html.match(/class="mopen"/g) || []).length;
    const mcloseCount = (html.match(/class="mclose"/g) || []).length;
    console.log(`   mopen: ${mopenCount}, mclose: ${mcloseCount}`);
    
    // Extract viewBox and height from SVGs
    const svgRegex = /<svg[^>]*>/g;
    let svgMatch;
    let svgNum = 0;
    while ((svgMatch = svgRegex.exec(html)) !== null) {
      svgNum++;
      const svgTag = svgMatch[0];
      const viewBoxMatch = svgTag.match(/viewBox="([^"]+)"/);
      const heightMatch = svgTag.match(/height="([^"]+)"/);
      const widthMatch = svgTag.match(/width="([^"]+)"/);
      
      if (viewBoxMatch || heightMatch) {
        console.log(`   SVG ${svgNum}: viewBox=${viewBoxMatch ? viewBoxMatch[1] : 'N/A'}, height=${heightMatch ? heightMatch[1] : 'N/A'}`);
      }
    }
    
    // Check for negative top values
    const negativeTopMatches = html.match(/top:-[\d.]+em/g);
    if (negativeTopMatches) {
      console.log(`   Negative top values: ${negativeTopMatches.join(', ')}`);
    }
    
    // Check for vlist heights
    const vlistHeightMatches = html.match(/vlist"[^>]*style="height:([\d.]+)em/g);
    if (vlistHeightMatches) {
      console.log(`   vlist heights: ${vlistHeightMatches.map(m => m.match(/height:([\d.]+)em/)[1] + 'em').join(', ')}`);
    }
    
    // Check strut height
    const strutMatch = html.match(/strut" style="height:([\d.]+)em/);
    if (strutMatch) {
      console.log(`   strut height: ${strutMatch[1]}em`);
    }
    
    // Check vertical-align
    const valignMatch = html.match(/vertical-align:-([\d.]+)em/);
    if (valignMatch) {
      console.log(`   vertical-align: -${valignMatch[1]}em`);
    }
    
    // For Bmatrix and left/right braces, check the actual SVG content
    if (test.name.includes('花括号') || test.name.includes('Bmatrix') || test.name.includes('cases')) {
      const svgPathMatches = html.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);
      if (svgPathMatches) {
        svgPathMatches.forEach((svg, i) => {
          const hasBracePath = svg.includes('brace') || svg.includes('curly');
          const pathCount = (svg.match(/<path/g) || []).length;
          console.log(`   SVG ${i + 1} has ${pathCount} paths, brace-related: ${hasBracePath}`);
          
          // Check for specific path data that might indicate brace rendering
          if (svg.includes('M') && svg.includes('C')) {
            // SVG path commands present
            console.log(`   SVG ${i + 1} contains bezier curves (likely brace shape)`);
          }
        });
      }
    }
    
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
});

// Detailed analysis of one specific case
console.log('\n\n=== Detailed Analysis: Bmatrix ===');
const bmatrixLatex = '\\begin{Bmatrix}a & b \\\\ c & d \\\\ e & f \\\\ g & h\\end{Bmatrix}';
const bmatrixHtml = katex.renderToString(bmatrixLatex, {
  displayMode: true,
  throwOnError: false,
  output: 'html'
});

// Find the mopen (left brace) structure
const mopenIdx = bmatrixHtml.indexOf('class="mopen"');
if (mopenIdx > 0) {
  const snippet = bmatrixHtml.substring(mopenIdx - 20, mopenIdx + 800);
  console.log('\nmopen structure (first 800 chars):');
  console.log(snippet);
}

// Check for any encoding issues in SVG paths
const svgPaths = bmatrixHtml.match(/<path[^>]*>/g);
if (svgPaths) {
  console.log(`\nFound ${svgPaths.length} path elements`);
  svgPaths.slice(0, 3).forEach((path, i) => {
    console.log(`Path ${i + 1}: ${path.substring(0, 100)}...`);
  });
}
