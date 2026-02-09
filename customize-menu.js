// New Customize Menu for About Me Page
// Features: live style editing, export to console, drag-and-drop for sections

// Ensure lil-gui is loaded
if (typeof lil === 'undefined' || typeof lil.GUI === 'undefined') {
  var script = document.createElement('script');
  script.src = 'libs/lil-gui.js';
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Section 1: Setup ---
  // Find all about-cv-section elements
  const sections = Array.from(document.querySelectorAll('.about-cv-section'));

  // --- Section 2: lil-gui Setup ---
  let gui;
  function setupGUI() {
    if (gui) gui.destroy();
    gui = new lil.GUI({
      width: 320,
      title: 'Customize About Me',
      closeFolders: true
    });
    gui.domElement.style.position = 'fixed';
    gui.domElement.style.top = '24px';
    gui.domElement.style.right = '24px';
    gui.domElement.style.zIndex = 1000;
    gui.domElement.style.background = '#fff';
    gui.domElement.style.borderRadius = '18px';
    gui.domElement.style.boxShadow = '0 4px 24px #232e5c33';
  }

  // --- Section 3: Customization Controls ---
  const styleSettings = {
    'Background Color': '#f7f6f2',
    'Section Color': '#dcdad5',
    'Section Border': '#353249',
    'Section Title Color': '#353249',
    'Section Title Border': '#353249',
    'Text Color': '#353249',
    'Shadow Color': '#353249',
    'Shadow Size': 8,
    'Border Radius': 35,
    'Section Spacing': 30
  };

  function applyStyles() {
    const shell = document.querySelector('.about-toon-bg');
    shell.style.background = styleSettings['Background Color'];
    shell.style.border = 'none'; // Remove outer border
    sections.forEach(section => {
      section.style.background = styleSettings['Section Color'];
      section.style.borderColor = styleSettings['Section Border'];
      section.style.borderRadius = styleSettings['Border Radius'] + 'px';
      section.style.boxShadow = `0 8px 0 ${styleSettings['Shadow Color']}, 0 16px 0 ${styleSettings['Shadow Color']}, 0 24px 0 ${styleSettings['Shadow Color']}`;
      section.querySelector('.about-cv-section-title').style.color = styleSettings['Section Title Color'];
      section.querySelector('.about-cv-section-title').style.borderBottom = `3px solid ${styleSettings['Section Title Border']}`;
      section.style.marginBottom = styleSettings['Section Spacing'] + 'px';
      section.style.borderBottom = 'none';
    });
    document.querySelectorAll('.about-cv-item').forEach(item => {
      item.style.color = styleSettings['Text Color'];
    });
  }

  // --- Section 4: Export Styles ---
  function exportStyles() {
    console.log('Exported About Me Styles:', JSON.stringify(styleSettings, null, 2));
    alert('Styles exported to console!');
  }

  // --- Section 5: Drag-and-Drop ---
  let dragSrc = null;
  sections.forEach(section => {
    section.draggable = true;
    section.addEventListener('dragstart', e => {
      dragSrc = section;
      section.style.opacity = 0.5;
    });
    section.addEventListener('dragend', e => {
      section.style.opacity = '';
    });
    section.addEventListener('dragover', e => {
      e.preventDefault();
    });
    section.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== section) {
        section.parentNode.insertBefore(dragSrc, section.nextSibling);
        dragSrc = null;
      }
    });
  });

  // --- Section 6: Initialize GUI ---
  setupGUI();
  gui.addColor(styleSettings, 'Background Color').onChange(applyStyles);
  gui.addColor(styleSettings, 'Section Color').onChange(applyStyles);
  gui.addColor(styleSettings, 'Section Border').onChange(applyStyles);
  gui.addColor(styleSettings, 'Section Title Color').onChange(applyStyles);
  gui.addColor(styleSettings, 'Section Title Border').onChange(applyStyles);
  // Ensure section title border is off by default
  styleSettings['Section Title Border'] = 'transparent';
  applyStyles();
  gui.addColor(styleSettings, 'Text Color').onChange(applyStyles);
  gui.addColor(styleSettings, 'Shadow Color').onChange(applyStyles);
  gui.add(styleSettings, 'Shadow Size', 0, 32, 1).onChange(applyStyles);
  gui.add(styleSettings, 'Border Radius', 0, 50, 1).onChange(applyStyles);
  gui.add(styleSettings, 'Section Spacing', 0, 48, 1).onChange(applyStyles);
  gui.add({ Export: exportStyles }, 'Export');
  // Move About Me section to top button
  gui.add({
    'Move About Me On Top': () => {
      const main = document.querySelector('.about-cv-main');
      const aboutSection = Array.from(main.children).find(sec => sec.querySelector('.about-cv-section-title')?.textContent?.toLowerCase().includes('about me'));
      if (aboutSection) main.insertBefore(aboutSection, main.firstChild);
    }
  }, 'Move About Me On Top');

  // Initial style application
  applyStyles();
});


  // Appearance controls for About Me
  const aboutStyles = {
    bg: getComputedStyle(document.querySelector('.about-toon-bg')).backgroundColor,
    sectionBg: getComputedStyle(document.querySelector('.about-cv-section')).backgroundColor,
    sectionBorder: getComputedStyle(document.querySelector('.about-cv-section')).borderColor,
    sectionRadius: parseInt(getComputedStyle(document.querySelector('.about-cv-section')).borderRadius),
    sectionShadow: getComputedStyle(document.querySelector('.about-cv-section')).boxShadow,
    nameColor: getComputedStyle(document.querySelector('.cv-name')).color,
    nameFont: getComputedStyle(document.querySelector('.cv-name')).fontFamily,
    nameSize: parseFloat(getComputedStyle(document.querySelector('.cv-name')).fontSize),
    titleColor: getComputedStyle(document.querySelector('.cv-title')).color,
    titleFont: getComputedStyle(document.querySelector('.cv-title')).fontFamily,
    titleSize: parseFloat(getComputedStyle(document.querySelector('.cv-title')).fontSize),
    itemBg: getComputedStyle(document.querySelector('.about-cv-item')).backgroundColor,
    itemBorder: getComputedStyle(document.querySelector('.about-cv-item')).borderColor,
    itemRadius: parseInt(getComputedStyle(document.querySelector('.about-cv-item')).borderRadius),
    itemShadow: getComputedStyle(document.querySelector('.about-cv-item')).boxShadow,
    itemFont: getComputedStyle(document.querySelector('.about-cv-item')).fontFamily,
    itemColor: getComputedStyle(document.querySelector('.about-cv-item')).color,
    itemSize: parseFloat(getComputedStyle(document.querySelector('.about-cv-item')).fontSize),
    sectionShadowSize: 8,
    sectionShadowColor: 'rgba(35,46,92,0.133)',
    sectionLine: true,
    sectionLineColor: '#7a6fc2',
  };

  // Declare gui before any gui.add calls
  const gui = new window.lil.GUI({
    container: document.getElementById('appearanceGuiContainer'),
    width: 320,
    title: 'About Me Appearance',
  });

  // All gui.add calls below
  gui.add(aboutStyles, 'sectionShadowSize', 0, 48).name('Shadow Size').onChange(v => {
    document.querySelectorAll('.about-cv-section').forEach(e => {
      e.style.boxShadow = `rgb(35,46,92) 0px 4px 0px 0px, ${aboutStyles.sectionShadowColor} 0px ${v}px ${2*v}px 0px`;
    });
  });
  gui.addColor(aboutStyles, 'sectionShadowColor').name('Shadow Color').onChange(v => {
    document.querySelectorAll('.about-cv-section').forEach(e => {
      e.style.boxShadow = `rgb(35,46,92) 0px 4px 0px 0px, ${v} 0px ${aboutStyles.sectionShadowSize}px ${2*aboutStyles.sectionShadowSize}px 0px`;
    });
  });
  gui.add(aboutStyles, 'sectionLine').name('Show Section Line').onChange(v => {
    document.querySelectorAll('.about-cv-section-title').forEach(e => {
      e.style.borderBottom = v ? `3px solid ${aboutStyles.sectionLineColor}` : 'none';
    });
  });
  gui.addColor(aboutStyles, 'sectionLineColor').name('Line Color').onChange(v => {
    document.querySelectorAll('.about-cv-section-title').forEach(e => {
      if (aboutStyles.sectionLine) e.style.borderBottom = `3px solid ${v}`;
    });
  });

  // Make sections draggable
  let dragSrc = null;
  document.querySelectorAll('.about-cv-section').forEach(section => {
    section.setAttribute('draggable', 'true');
    section.addEventListener('dragstart', e => {
      dragSrc = section;
      e.dataTransfer.effectAllowed = 'move';
      section.classList.add('dragging');
    });
    section.addEventListener('dragend', () => {
      dragSrc = null;
      section.classList.remove('dragging');
    });
    section.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    section.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== section) {
        section.parentNode.insertBefore(dragSrc, section.nextSibling);
      }
    });
  });

