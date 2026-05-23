const ADJECTIVES = [
  "Cheerful", "Brave", "Gentle", "Cosmic", "Sunny",
  "Clever", "Kind", "Swift", "Lucky", "Bright",
  "Bold", "Calm", "Cozy", "Daring", "Eager",
  "Fancy", "Glad", "Happy", "Jolly", "Lively",
  "Merry", "Noble", "Peppy", "Plucky", "Quirky",
  "Rosy", "Snowy", "Tender", "Warm", "Witty",
  "Zesty", "Fluffy", "Golden", "Humble", "Jazzy",
  "Loyal", "Mighty", "Nimble", "Proud", "Radiant",
  "Shy", "Tiny", "Vivid", "Wild", "Zen",
  "Cuddly", "Dreamy", "Funky", "Groovy", "Starry",
];

const ANIMALS = [
  "Capybara", "Penguin", "Otter", "Axolotl", "Quokka",
  "Panda", "Koala", "Bunny", "Dolphin", "Fox",
  "Owl", "Hedgehog", "Sloth", "Seal", "Duckling",
  "Kitten", "Puppy", "Hamster", "Raccoon", "Deer",
  "Flamingo", "Narwhal", "Chameleon", "Puffin", "Alpaca",
  "Corgi", "Meerkat", "Chinchilla", "Manatee", "Parrot",
  "Jellyfish", "Starfish", "Ladybug", "Firefly", "Sparrow",
  "Peacock", "Gecko", "Toucan", "Bison", "Wombat",
  "Lemur", "Beaver", "Badger", "Falcon", "Crane",
  "Turtle", "Rabbit", "Moose", "Finch", "Shrimp",
];

function hashAddr(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function funName(walletAddress: string): string {
  const h = hashAddr(walletAddress);
  const adj = ADJECTIVES[h % ADJECTIVES.length]!;
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]!;
  return `${adj} ${animal}`;
}
