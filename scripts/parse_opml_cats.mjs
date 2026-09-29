import fs from 'fs';

const xml = fs.readFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/CyberSecurityRSS.opml', 'utf8');

// Parse outlines with parent category
const lines = xml.split('\n');
let currentCategory = 'General';
const categorizedFeeds = [];

for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('<outline') && !trimmed.includes('xmlUrl=')) {
        const catMatch = trimmed.match(/text="([^"]+)"/);
        if (catMatch) currentCategory = catMatch[1];
    } else if (trimmed.startsWith('<outline') && trimmed.includes('xmlUrl=')) {
        const nameMatch = trimmed.match(/text="([^"]+)"/);
        const urlMatch = trimmed.match(/xmlUrl="([^"]+)"/);
        const htmlMatch = trimmed.match(/htmlUrl="([^"]+)"/);
        if (nameMatch && urlMatch) {
            categorizedFeeds.push({
                name: nameMatch[1],
                feedUrl: urlMatch[1],
                websiteUrl: htmlMatch ? htmlMatch[1] : null,
                category: currentCategory
            });
        }
    }
}

console.log('Total categorized feeds:', categorizedFeeds.length);
const catSummary = {};
categorizedFeeds.forEach(f => {
    catSummary[f.category] = (catSummary[f.category] || 0) + 1;
});
console.log('Categories:', catSummary);
fs.writeFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/categorized_opml_feeds.json', JSON.stringify(categorizedFeeds, null, 2));
