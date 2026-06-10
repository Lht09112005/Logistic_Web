import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SVG_PATH = join(__dirname, "..", "public", "icons", "icon.svg");
const OUT_DIR = join(__dirname, "..", "public", "icons");

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const svgBuffer = readFileSync(SVG_PATH);

async function generate() {
  for (const size of SIZES) {
    const outPath = join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ Generated ${outPath} (${size}x${size})`);
  }
  console.log("\n🎉 All icons generated successfully!");
}

generate().catch((err) => {
  console.error("❌ Failed to generate icons:", err);
  process.exit(1);
});
