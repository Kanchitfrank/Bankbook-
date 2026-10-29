// Keep each SQL row below D1's 2 MB limit, including Thai text and emoji.
export function chunksFor(document){const raw=JSON.stringify(document),parts=[];let start=0;while(start<raw.length){let end=Math.min(start+250000,raw.length);const last=raw.charCodeAt(end-1);if(end<raw.length&&last>=0xD800&&last<=0xDBFF)end--;parts.push(raw.slice(start,end));start=end;}return parts;}
