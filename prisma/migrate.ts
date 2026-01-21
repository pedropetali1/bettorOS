import { execSync } from "node:child_process";

try {
  execSync("npx prisma migrate dev --name init", { stdio: "inherit" });
} catch (error) {
  console.error("Prisma migration failed.", error);
  process.exit(1);
}
