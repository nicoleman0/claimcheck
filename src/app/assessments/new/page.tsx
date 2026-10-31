import type { Metadata } from "next"

import { Panel } from "@/components/data"
import { PageHeader } from "@/components/shell/page-header"
import { NewAssessmentForm } from "./form"

export const metadata: Metadata = { title: "New assessment" }

export default function NewAssessmentPage() {
  return (
    <>
      <PageHeader title="New assessment" description="Supplier domain, completed security questionnaire (CSV) and SOC 2 report (PDF), each up to 4 MB." />
      <Panel label="Supplier evidence" className="max-w-xl">
        <NewAssessmentForm />
      </Panel>
    </>
  )
}
