export const shortNumberFormatter = new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 3,
    notation: "compact",
    compactDisplay: "short",
});
