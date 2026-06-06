// Tiny country → ISO code lookup so we can render a flag for any country name
// stored on a city.
const FLAGS = {
  india: "🇮🇳", "united states": "🇺🇸", usa: "🇺🇸", "united kingdom": "🇬🇧", uk: "🇬🇧", england: "🇬🇧",
  france: "🇫🇷", italy: "🇮🇹", spain: "🇪🇸", germany: "🇩🇪", japan: "🇯🇵", china: "🇨🇳",
  "south korea": "🇰🇷", korea: "🇰🇷", thailand: "🇹🇭", vietnam: "🇻🇳", indonesia: "🇮🇩",
  australia: "🇦🇺", "new zealand": "🇳🇿", canada: "🇨🇦", mexico: "🇲🇽", brazil: "🇧🇷",
  argentina: "🇦🇷", "united arab emirates": "🇦🇪", uae: "🇦🇪", turkey: "🇹🇷", greece: "🇬🇷",
  portugal: "🇵🇹", netherlands: "🇳🇱", belgium: "🇧🇪", switzerland: "🇨🇭", sweden: "🇸🇪",
  norway: "🇳🇴", denmark: "🇩🇰", finland: "🇫🇮", ireland: "🇮🇪", "south africa": "🇿🇦",
  egypt: "🇪🇬", morocco: "🇲🇦", singapore: "🇸🇬", malaysia: "🇲🇾", philippines: "🇵🇭",
  "sri lanka": "🇱🇰", nepal: "🇳🇵", bhutan: "🇧🇹", maldives: "🇲🇻",
};

export function flagForCountry(country) {
  if (!country) return "🌍";
  return FLAGS[country.toLowerCase()] || "🌍";
}
