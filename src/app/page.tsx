import { NavigationWorkspace } from "@/components/navigation-workspace";
import { connection } from "next/server";

export default async function Home() {
  await connection();

  return <NavigationWorkspace />;
}
