import { db } from "../server/db";
import { contracts, contentItems } from "../shared/schema";

const partners = [
  "Netflix", "Amazon Prime", "Hulu", "Disney+", "HBO Max", "Apple TV+", 
  "Paramount+", "Peacock", "Roku Channel", "Tubi", "Pluto TV", "Crackle",
  "Vudu", "FuboTV", "Sling TV", "Discovery+", "BritBox", "Acorn TV",
  "Shudder", "AMC+", "Starz", "Showtime", "Epix", "MGM+", "Criterion"
];

const licensees = [
  "Trinity Broadcasting", "Daystar Television", "CBN", "EWTN", 
  "God TV", "Hillsong Channel", "TBN UK", "Smile of a Child",
  "JUCE TV", "Enlace", "TBN Africa", "TBN Asia", "TBN Nejat",
  "Positiv", "TBN Nordic", "TBN Polska"
];

const territories = ["Global", "US", "Canada", "UK", "US, Canada", "UK, Global", "US, UK", "Canada, UK"];
const platforms = ["SVOD", "TVOD", "AVOD", "FAST", "Linear", "VOD", "SVOD, AVOD", "FAST, Linear"];
const statuses: ("Active" | "Expired" | "In Perpetuity" | "Terminated")[] = ["Active", "Active", "Active", "Expired", "In Perpetuity"];
const royaltyTypes: ("Revenue Share" | "Flat Fee")[] = ["Revenue Share", "Revenue Share", "Flat Fee"];
const exclusivities: ("Exclusive" | "Non-Exclusive" | "Limited Exclusive")[] = ["Exclusive", "Non-Exclusive", "Limited Exclusive"];
const reportingFrequencies: ("Monthly" | "Quarterly" | "Annually" | "None")[] = ["Monthly", "Quarterly", "Annually", "None"];
const paymentTerms: ("Net 30" | "Net 60" | "Net 90")[] = ["Net 30", "Net 60", "Net 90"];

const filmTitles = [
  "The Last Miracle", "Heaven's Gate", "Beyond the Cross", "Faith Rising", "The Prodigal Son",
  "Wings of Grace", "Divine Encounter", "The Shepherd's Call", "Eternal Promise", "Light in Darkness",
  "The Prayer Room", "Redeemed", "Amazing Grace Story", "The Chosen Path", "Forgiven",
  "Breakthrough", "Believe", "The Nativity", "Noah's Journey", "David and Goliath",
  "The Apostle Paul", "Moses Returns", "Ruth's Story", "Esther's Courage", "Daniel's Lions"
];

const tvSeriesTitles = [
  "Kingdom Chronicles", "The Bible Project", "Faith & Family", "Touched by Angels", 
  "Praise the Lord Live", "Behind the Faith", "Ministry Matters", "Holy Land Adventures",
  "Scripture Study", "Children of Promise", "Youth Revival", "Marriage Today",
  "Life Today with James", "Hillsong Worship Hour", "Joel Osteen Presents",
  "Women of Faith", "Men of Valor", "Family Matters", "Teen Talk", "Kids Corner"
];

const fastTitles = [
  "24/7 Worship", "Classic Sermons", "Bible Stories for Kids", "Christian Music Mix",
  "Prayer & Meditation", "Faith News Network", "Inspirational Movies", "Gospel Classics",
  "Sunday Service Replay", "Testimony Time", "Hymns of Hope", "Devotional Daily"
];

const genres = ["Drama", "Documentary", "Family", "Inspirational", "Musical", "Biography", "Animation", "Talk Show"];

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedContracts(count: number = 100) {
  console.log(`Creating ${count} mock contracts...`);
  
  const contractsToInsert: (typeof contracts.$inferInsert)[] = [];
  
  for (let i = 1; i <= count; i++) {
    const startDate = randomDate(new Date(2022, 0, 1), new Date(2025, 11, 31));
    const endDate = randomDate(new Date(startDate), new Date(2028, 11, 31));
    const royaltyType = randomItem(royaltyTypes);
    const autoRenew = Math.random() > 0.7;
    
    contractsToInsert.push({
      partner: `${randomItem(partners)} Deal ${i}`,
      licensor: "TBN Networks",
      licensee: randomItem(licensees),
      territory: randomItem(territories),
      platform: randomItem(platforms),
      startDate,
      endDate: autoRenew ? null : endDate,
      autoRenew,
      royaltyType,
      royaltyRate: royaltyType === "Revenue Share" ? (Math.floor(Math.random() * 50) + 10).toString() : null,
      flatFeeAmount: royaltyType === "Flat Fee" ? (Math.floor(Math.random() * 50000) + 5000).toString() : null,
      exclusivity: randomItem(exclusivities),
      status: randomItem(statuses),
      reportingFrequency: randomItem(reportingFrequencies),
      paymentTerms: randomItem(paymentTerms),
      minimumPayment: Math.random() > 0.5 ? (Math.floor(Math.random() * 10000) + 1000).toString() : null,
    });
  }
  
  await db.insert(contracts).values(contractsToInsert);
  console.log(`Successfully created ${count} mock contracts!`);
}

async function seedContent(count: number = 100) {
  console.log(`Creating ${count} mock content items...`);
  
  const contentToInsert: (typeof contentItems.$inferInsert)[] = [];
  
  const filmsCount = Math.floor(count * 0.3);
  const seriesCount = Math.floor(count * 0.3);
  const tbnFastCount = Math.floor(count * 0.2);
  const tbnLinearCount = Math.floor(count * 0.1);
  const wofFastCount = count - filmsCount - seriesCount - tbnFastCount - tbnLinearCount;
  
  // Films
  for (let i = 0; i < filmsCount; i++) {
    contentToInsert.push({
      title: `${filmTitles[i % filmTitles.length]}${i >= filmTitles.length ? ` ${Math.floor(i / filmTitles.length) + 1}` : ''}`,
      type: "Film" as const,
      description: `A powerful ${randomItem(["inspirational", "dramatic", "heartwarming", "uplifting"])} film about faith and redemption.`,
      releaseYear: randomInt(2015, 2025),
      genre: randomItem(genres),
      duration: randomInt(90, 180),
    });
  }
  
  // TV Series
  for (let i = 0; i < seriesCount; i++) {
    contentToInsert.push({
      title: `${tvSeriesTitles[i % tvSeriesTitles.length]}${i >= tvSeriesTitles.length ? ` Season ${Math.floor(i / tvSeriesTitles.length) + 1}` : ''}`,
      type: "TV Series" as const,
      description: `An engaging series exploring themes of faith, family, and spiritual growth.`,
      season: randomInt(1, 8),
      episodeCount: randomInt(6, 24),
      releaseYear: randomInt(2018, 2025),
      genre: randomItem(genres),
      duration: randomInt(22, 60),
    });
  }
  
  // TBN FAST
  for (let i = 0; i < tbnFastCount; i++) {
    contentToInsert.push({
      title: `TBN ${fastTitles[i % fastTitles.length]}${i >= fastTitles.length ? ` ${Math.floor(i / fastTitles.length) + 1}` : ''}`,
      type: "TBN FAST" as const,
      description: `24/7 streaming channel featuring ${randomItem(["worship", "sermons", "family content", "inspirational programming"])}.`,
      releaseYear: randomInt(2020, 2025),
      genre: randomItem(genres),
    });
  }
  
  // TBN Linear
  for (let i = 0; i < tbnLinearCount; i++) {
    contentToInsert.push({
      title: `TBN Linear Channel ${i + 1}`,
      type: "TBN Linear" as const,
      description: `Traditional linear broadcast channel with scheduled programming.`,
      releaseYear: randomInt(2010, 2025),
      genre: randomItem(genres),
    });
  }
  
  // WoF FAST
  for (let i = 0; i < wofFastCount; i++) {
    contentToInsert.push({
      title: `Word of Faith Channel ${i + 1}`,
      type: "WoF FAST" as const,
      description: `Faith-based streaming content focused on teaching and ministry.`,
      releaseYear: randomInt(2021, 2025),
      genre: randomItem(genres),
    });
  }
  
  await db.insert(contentItems).values(contentToInsert);
  console.log(`Successfully created ${count} mock content items!`);
}

async function main() {
  const args = process.argv.slice(2);
  const contractCount = parseInt(args[0]) || 100;
  const contentCount = parseInt(args[1]) || 100;
  
  console.log("=== Promissio Mock Data Seeder ===\n");
  
  try {
    await seedContracts(contractCount);
    console.log("");
    await seedContent(contentCount);
    console.log("\n=== Seeding Complete ===");
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
