import Link from "next/link"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Event } from "@/lib/types"

export function EventsTable({ events }: { events: (Event & { vendorName?: string })[] }) {
  return (
    <div className="overflow-x-auto border-x">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time (UTC)</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs whitespace-nowrap">{e.at.slice(0, 19).replace("T", " ")}</TableCell>
              <TableCell>
                {e.assessmentId ? <Link href={`/assessments/${e.assessmentId}`} className="hover:underline">{e.vendorName ?? e.vendorId}</Link> : <Link href={`/vendors/${e.vendorId}`} className="hover:underline">{e.vendorName ?? e.vendorId}</Link>}
              </TableCell>
              <TableCell className="font-mono text-xs">{e.actor}</TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell className="max-w-md text-xs whitespace-normal">{e.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
