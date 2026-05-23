import type { Metadata } from "next";
import { CreateWizard } from "@/components/create/wizard";

export const metadata: Metadata = { title: "Create a jar — jarfi" };

export default function CreatePage() {
  return <CreateWizard />;
}
