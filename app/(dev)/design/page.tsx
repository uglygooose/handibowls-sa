import { notFound } from "next/navigation";

import { DesignShowcase } from "./DesignShowcase";

// Dev-only storybook-lite. 404s in production.
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DesignShowcase />;
}
