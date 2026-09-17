/** Written to be warm and specific without assuming anything about the two people. */
export const QUESTION_CARDS: readonly string[] = [
  "What's one thing you miss about me right now?",
  'Where would we go if we could leave tomorrow?',
  "What's your favourite memory of us so far?",
  'What made you smile today?',
  "What's a small thing I do that you love?",
  'What song reminds you of me?',
  "What's the first thing we should do when we're together again?",
  'What are you looking forward to this month?',
  "What's something you've never told me about your day?",
  'If today had a colour, what would it be?',
  'What would our perfect lazy Sunday look like?',
  "What's a food we have to try together?",
  'What did you dream about last night?',
  "What's one thing you're proud of this week?",
  'Which photo of us is your favourite, and why?',
  'What do you want to learn together?',
  "What's a tiny tradition we should start?",
  'What was the best part of your week?',
  'When did you last laugh really hard?',
  "What's a place near you I have to see?",
  'What are you grateful for right now?',
  "What's one word for how you feel today?",
  'If we could time travel to one day of ours, which one?',
  "What's something you want to hear more often?",
  'What would you cook for me tonight?',
  "What's your favourite way to spend a rainy day with me?",
  'What are you reading, watching or listening to?',
  "What's a goal we could work on together?",
  'What smell reminds you of home?',
  'What should our next photo be?',
];

export interface TwoChoice {
  a: string;
  b: string;
}

export const THIS_OR_THAT: readonly TwoChoice[] = [
  { a: 'Coffee', b: 'Tea' },
  { a: 'Sunrise', b: 'Sunset' },
  { a: 'Mountains', b: 'Sea' },
  { a: 'Book', b: 'Film' },
  { a: 'Sweet', b: 'Savoury' },
  { a: 'Early bird', b: 'Night owl' },
  { a: 'Cats', b: 'Dogs' },
  { a: 'City break', b: 'Countryside' },
  { a: 'Cook at home', b: 'Eat out' },
  { a: 'Summer', b: 'Winter' },
  { a: 'Texting', b: 'Calling' },
  { a: 'Plan it', b: 'Wing it' },
  { a: 'Window seat', b: 'Aisle seat' },
  { a: 'Pancakes', b: 'Waffles' },
  { a: 'Museum', b: 'Market' },
  { a: 'Board games', b: 'Video games' },
];

export const WOULD_YOU_RATHER: readonly TwoChoice[] = [
  { a: 'Live by the sea', b: 'Live in the mountains' },
  { a: 'Travel for a year', b: 'Buy a home now' },
  { a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
  { a: 'Only ever eat breakfast foods', b: 'Only ever eat dinner foods' },
  { a: 'Speak every language', b: 'Play every instrument' },
  { a: 'Have a tiny garden', b: 'Have a huge kitchen' },
  { a: 'Relive our first date', b: 'Skip to our next trip' },
  { a: 'Road trip with no map', b: 'Trip planned to the minute' },
  { a: 'Watch the same film forever', b: 'Never rewatch anything' },
  { a: 'A cabin in the snow', b: 'A hut on the beach' },
  { a: 'Dance in the rain', b: 'Nap in the sun' },
  { a: 'Write letters', b: 'Send voice notes' },
];

export const MESSAGE_CARD_STYLES = ['soft', 'night', 'sun'] as const;
export type MessageCardStyle = (typeof MESSAGE_CARD_STYLES)[number];

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** A modest list; the point is a rough distance, not a gazetteer. */
export const CITIES: readonly City[] = [
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.37, lon: 4.9 },
  { name: 'Athens', country: 'Greece', lat: 37.98, lon: 23.73 },
  { name: 'Auckland', country: 'New Zealand', lat: -36.85, lon: 174.76 },
  { name: 'Bangalore', country: 'India', lat: 12.97, lon: 77.59 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.76, lon: 100.5 },
  { name: 'Barcelona', country: 'Spain', lat: 41.39, lon: 2.17 },
  { name: 'Beijing', country: 'China', lat: 39.9, lon: 116.4 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.4 },
  { name: 'Bogotá', country: 'Colombia', lat: 4.71, lon: -74.07 },
  { name: 'Boston', country: 'United States', lat: 42.36, lon: -71.06 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6, lon: -58.38 },
  { name: 'Cairo', country: 'Egypt', lat: 30.04, lon: 31.24 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.92, lon: 18.42 },
  { name: 'Chennai', country: 'India', lat: 13.08, lon: 80.27 },
  { name: 'Chicago', country: 'United States', lat: 41.88, lon: -87.63 },
  { name: 'Copenhagen', country: 'Denmark', lat: 55.68, lon: 12.57 },
  { name: 'Delhi', country: 'India', lat: 28.61, lon: 77.21 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2, lon: 55.27 },
  { name: 'Dublin', country: 'Ireland', lat: 53.35, lon: -6.26 },
  { name: 'Edinburgh', country: 'United Kingdom', lat: 55.95, lon: -3.19 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.03, lon: 105.85 },
  { name: 'Hong Kong', country: 'China', lat: 22.32, lon: 114.17 },
  { name: 'Hyderabad', country: 'India', lat: 17.39, lon: 78.49 },
  { name: 'Istanbul', country: 'Türkiye', lat: 41.01, lon: 28.98 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.21, lon: 106.85 },
  { name: 'Kolkata', country: 'India', lat: 22.57, lon: 88.36 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.52, lon: 3.38 },
  { name: 'Lima', country: 'Peru', lat: -12.05, lon: -77.04 },
  { name: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14 },
  { name: 'London', country: 'United Kingdom', lat: 51.51, lon: -0.13 },
  { name: 'Los Angeles', country: 'United States', lat: 34.05, lon: -118.24 },
  { name: 'Madrid', country: 'Spain', lat: 40.42, lon: -3.7 },
  { name: 'Manila', country: 'Philippines', lat: 14.6, lon: 120.98 },
  { name: 'Melbourne', country: 'Australia', lat: -37.81, lon: 144.96 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.43, lon: -99.13 },
  { name: 'Mumbai', country: 'India', lat: 19.08, lon: 72.88 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.29, lon: 36.82 },
  { name: 'New York', country: 'United States', lat: 40.71, lon: -74.01 },
  { name: 'Oslo', country: 'Norway', lat: 59.91, lon: 10.75 },
  { name: 'Paris', country: 'France', lat: 48.86, lon: 2.35 },
  { name: 'Prague', country: 'Czechia', lat: 50.08, lon: 14.44 },
  { name: 'Pune', country: 'India', lat: 18.52, lon: 73.86 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.91, lon: -43.17 },
  { name: 'Rome', country: 'Italy', lat: 41.9, lon: 12.5 },
  { name: 'San Francisco', country: 'United States', lat: 37.77, lon: -122.42 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.55, lon: -46.63 },
  { name: 'Seattle', country: 'United States', lat: 47.61, lon: -122.33 },
  { name: 'Seoul', country: 'South Korea', lat: 37.57, lon: 126.98 },
  { name: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Stockholm', country: 'Sweden', lat: 59.33, lon: 18.07 },
  { name: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.21 },
  { name: 'Tel Aviv', country: 'Israel', lat: 32.09, lon: 34.78 },
  { name: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69 },
  { name: 'Toronto', country: 'Canada', lat: 43.65, lon: -79.38 },
  { name: 'Vancouver', country: 'Canada', lat: 49.28, lon: -123.12 },
  { name: 'Vienna', country: 'Austria', lat: 48.21, lon: 16.37 },
  { name: 'Warsaw', country: 'Poland', lat: 52.23, lon: 21.01 },
  { name: 'Zürich', country: 'Switzerland', lat: 47.38, lon: 8.54 },
];
