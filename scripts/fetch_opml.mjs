import fs from 'fs';

async function fetchOpml() {
    console.log('Downloading CyberSecurityRSS.opml...');
    const res = await fetch('https://raw.githubusercontent.com/zer0yu/CyberSecurityRSS/master/CyberSecurityRSS.opml');
    const text = await res.text();
    fs.writeFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/CyberSecurityRSS.opml', text);
    console.log('Saved CyberSecurityRSS.opml, bytes:', text.length);

    // Extract outlines
    const outlineRegex = /<outline[^>]+text="([^"]*)"[^>]+xmlUrl="([^"]*)"[^>]*(htmlUrl="([^"]*)")?[^>]*>/gi;
    let match;
    const items = [];
    while ((match = outlineRegex.exec(text)) !== null) {
        items.push({
            name: match[1],
            feedUrl: match[2],
            htmlUrl: match[4] || null
        });
    }
    console.log('Total extracted feeds from OPML:', items.length);
    fs.writeFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/opml_extracted.json', JSON.stringify(items, null, 2));
}

fetchOpml().catch(console.error);
