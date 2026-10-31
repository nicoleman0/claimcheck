import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={FileQuestionIcon}
      title="Page not found"
      description="The page you asked for does not exist."
      action={<Button nativeButton={false} render={<Link href="/" />}>Back to overview</Button>}
    />
  );
}
