import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import * as crypto from "node:crypto";

const prisma = new PrismaClient();

/**
 * ---- User helpers (kept from previous seed) ----
 */
export async function createUser(email: string, password: string): Promise<void> {
  const { salt, passwordHash } = hashPassword(password);
  const userType = "ADMIN";
  await prisma.user.create({
    data: { email, passwordHash, salt, userType },
  });
}

export async function validateLogin(email: string, password: string): Promise<boolean> {
  const userLookup = await prisma.user.findFirst({ where: { email } });
  if (!userLookup?.salt) return false;
  return hashMatch(password, userLookup.salt, userLookup.passwordHash);
}

interface EncryptedPassword {
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string): EncryptedPassword {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return { passwordHash, salt };
}

export function hashMatch(password: string, salt: string, hash: string): boolean {
  const rehash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return rehash === hash;
}

/**
 * ---- SeatMapping seed (new) ----
 * Expects CSV at prisma/seed-data/Seat_Mapping.csv
 * Columns (header names must match): seat_no,row,screen_id,section
 */

type SeatRow = {
  seat_no: string; // numeric string
  row: string;     // can be empty
  screen_id: string; // numeric string
  section: string; // left|center|right|Box|UNKNOWN
};

async function seedSeatMapping(): Promise<void> {
  const csvPath = path.resolve(__dirname, "seed-data/Seat_Mapping.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  SeatMapping CSV not found at ${csvPath}. Skipping SeatMapping seeding.`);
    return;
  }

  const csv = fs.readFileSync(csvPath, "utf8");
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as SeatRow[];

  // Basic validation & coercion
  const data = records.map((r, idx) => {
    const seat_no = Number(r.seat_no);
    const screen_id = Number(r.screen_id);
    if (!Number.isFinite(seat_no) || !Number.isFinite(screen_id)) {
      throw new Error(`Invalid numeric value at row ${idx + 1}: seat_no='${r.seat_no}', screen_id='${r.screen_id}'`);
    }
    const row = r.row?.trim() || null;
    const section = (r.section || "UNKNOWN").trim();
    return { screen_id, seat_no, row, section } as const;
  });

  // Clear and insert
  console.log(`Seeding SeatMapping: ${data.length} rows from CSV...`);
  await prisma.seatMapping.deleteMany({});
  // Use batching if needed; for this dataset createMany is fine
  await prisma.seatMapping.createMany({ data, skipDuplicates: true });
  console.log("✅ SeatMapping import complete");
}

async function seed(): Promise<void> {
  console.log("🌱 Begin seed...");

  // 1) SeatMapping data (from CSV)
  await seedSeatMapping();

  // 2) (Optional) create an admin user for local testing
  try {
    const email = "spencer@mail.com";
    const pass = "test";
    // Only create if does not exist
    const exists = await prisma.user.findUnique({ where: { email } }).catch(() => null);
    if (!exists) {
      await createUser(email, pass);
      const loginOk = await validateLogin(email, pass);
      console.log(loginOk ? `👤 Admin user '${email}' ready` : `⚠️ Failed login check for '${email}'`);
    } else {
      console.log(`👤 Admin user '${email}' already exists — skipping`);
    }
  } catch (e) {
    console.warn("⚠️ User seed skipped or failed (this is non-fatal for SeatMapping).", e);
  }

  console.log("✅ Seed done");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
