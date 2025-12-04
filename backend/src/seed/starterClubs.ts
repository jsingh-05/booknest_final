import dotenv from "dotenv";
import { connectDB } from "../config/db"; // use your db connect util
import { ClubModel } from "../models/club.model";

dotenv.config();

const STARTERS = [
  { name: "Mystery Lovers", description: "For fans of psychological thrillers and mystery novels", tags: ["Mystery"], isPublic: true, schedule: "Every Tuesday" },
  { name: "Classic Literature", description: "Exploring timeless literary masterpieces", tags: ["Classic"], isPublic: true, schedule: "Every Sunday" },
  { name: "Sci-Fi Explorers", description: "Journey through space, time, and imagination", tags: ["Sci-Fi"], isPublic: true, schedule: "Every Wednesday" },
  { name: "Romance Readers", description: "Love stories that warm the heart", tags: ["Romance"], isPublic: true, schedule: "Every Friday" },
];

async function seed() {
  await connectDB();

  for (const s of STARTERS) {
    const exists = await ClubModel.findOne({ name: s.name }).lean();
    if (!exists) {
      await ClubModel.create({ ...s, starterClub: true });
      console.log("Seeded", s.name);
    } else {
      console.log("Already exists", s.name);
    }
  }
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
