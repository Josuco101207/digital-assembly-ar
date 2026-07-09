const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
files.push('./index.html');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Backgrounds (From dark to light/vibrant)
    content = content.replace(/bg-industrial-dark/g, 'bg-white'); 
    content = content.replace(/bg-industrial-base/g, 'bg-slate-50');
    content = content.replace(/bg-industrial-light/g, 'bg-slate-100');
    
    // Accents
    content = content.replace(/bg-industrial-accent/g, 'bg-dicrejart-red');
    content = content.replace(/text-industrial-accent/g, 'text-dicrejart-violet');
    content = content.replace(/border-industrial-accent/g, 'border-dicrejart-red');
    content = content.replace(/ring-industrial-accent/g, 'ring-dicrejart-red');
    
    // Texts (since background is now light, text needs to be dark)
    content = content.replace(/text-slate-200/g, 'text-slate-800');
    content = content.replace(/text-slate-300/g, 'text-slate-700');
    content = content.replace(/text-slate-400/g, 'text-slate-600');
    content = content.replace(/text-white/g, 'text-dicrejart-violet'); // white text to deep violet
    
    // Dark mode borders to light
    content = content.replace(/border-slate-700/g, 'border-slate-300');
    content = content.replace(/border-slate-600/g, 'border-slate-200');
    
    // Background slate
    content = content.replace(/bg-slate-900/g, 'bg-white');
    content = content.replace(/bg-slate-800/g, 'bg-slate-100');
    content = content.replace(/bg-slate-700/g, 'bg-slate-200');
    
    if(original !== content) {
        fs.writeFileSync(file, content);
        console.log('Updated', file);
    }
});
