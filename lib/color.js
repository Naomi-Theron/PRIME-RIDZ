
'use strict';

function tryRequire(name) {
  try {
    return require(name);
  } catch (e) {
    return null;
  }
}

const nativeChalk = tryRequire('chalk');
if (nativeChalk && typeof nativeChalk.hex === 'function' && typeof nativeChalk.bgHex === 'function') {
  module.exports = nativeChalk;
  return;
}

function hexToRgb(hex) {
  if (!hex) return null;
  hex = String(hex).trim().replace(/^#/, '');
  if (hex.length === 3) {

    hex = hex.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function fgAnsiRgb({ r, g, b }) {
  return `\x1b[38;2;${r};${g};${b}m`;
}
function bgAnsiRgb({ r, g, b }) {
  return `\x1b[48;2;${r};${g};${b}m`;
}
const RESET = '\x1b[0m';
const BLACK = '\x1b[30m';

function makeHexFn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    
    const fn = (text) => String(text);
    fn.format = fn;
    return fn;
  }
  const prefix = fgAnsiRgb(rgb);
  const fn = (text) => `${prefix}${String(text)}${RESET}`;
  fn.format = fn;
  return fn;
}

function makeBgHexFn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    const fn = (text) => String(text);
    fn.black = (text) => String(text);
    return fn;
  }
  const bgPrefix = bgAnsiRgb(rgb);
  const fn = (text) => `${bgPrefix}${String(text)}${RESET}`;
  fn.black = (text) => `${bgPrefix}${BLACK}${String(text)}${RESET}`;
  
  fn.format = fn;
  return fn;
}

const shim = {
  hex: (hex) => makeHexFn(hex),
  bgHex: (hex) => makeBgHexFn(hex),
  black: (text) => `${BLACK}${String(text)}${RESET}`,
  
  bold: (text) => `\x1b[1m${String(text)}${RESET}`,
  underline: (text) => `\x1b[4m${String(text)}${RESET}`,
  __raw: (text) => String(text)
};

module.exports = shim;