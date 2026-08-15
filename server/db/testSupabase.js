import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

console.log("SUPABASE_URL loaded:", Boolean(process.env.SUPABASE_URL));
console.log("SUPABASE_KEY loaded:", Boolean(process.env.SUPABASE_KEY));

const { supabase } = await import("./supabase.js");

const { data, error } = await supabase
  .from("journals")
  .select("*")
  .limit(5);

if (error) {
  console.error("❌ Supabase error:", error);
  process.exit(1);
}

console.log("✅ Supabase connected!");
console.log(data);