import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function main() {
  const email = (process.env.SEED_USER_EMAIL ?? "admin@flo.finance")
    .toLowerCase()
    .trim();
  const password = process.env.SEED_USER_PASSWORD ?? "changeme123";
  const name = process.env.SEED_USER_NAME ?? "Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash },
  });
  console.log(`✓ Seeded user: ${user.email}`);

  await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("✓ Ensured settings singleton");
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    db.$disconnect();
    process.exit(1);
  });
