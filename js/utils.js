// js/utils.js

function extractVideoID(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

async function fetchVideoInfo(url) {
  try {
    const id = extractVideoID(url);
    if (!id) return {};
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`
    );
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("Fetch info error", e);
    return {};
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
