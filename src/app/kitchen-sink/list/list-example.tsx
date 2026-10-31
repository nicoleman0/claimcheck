"use client";

import { toast } from "sonner";

import { ConfidenceMeter } from "@/components/data";
import { BulkBar, KeyHints, rowStateClass, useRowKeys, useRowSelection } from "@/components/list-controls";
import { ariaSort, SortHeader } from "@/components/list-filters";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ListQuery } from "@/lib/list-query";
import type { SampleRow, Verdict } from "./sample";

const tone: Record<Verdict, Tone> = { contradicts: "warning", no_evidence: "neutral", agrees: "info" };

export function ListExample({ rows, query, path }: { rows: SampleRow[]; query: ListQuery; path: string }) {
  const selection = useRowSelection(rows.map((r) => r.id));
  // Stand-ins for API calls; a real app posts the ids, then router.refresh().
  const act = (verb: string, ids: string[]) => toast.success(`${ids.length} ${ids.length === 1 ? "finding" : "findings"} ${verb}`);
  const keys = useRowKeys(rows.length, {
    x: (i) => selection.toggle(rows[i].id),
    a: (i) => act("accepted", [rows[i].id]),
    d: (i) => act("dismissed", [rows[i].id]),
  });

  const sortable = (column: string, label: string) => (
    <TableHead aria-sort={ariaSort(query, column)}>
      <SortHeader query={query} path={path} column={column}>{label}</SortHeader>
    </TableHead>
  );

  return (
    <>
      <div className="mb-2 flex justify-end">
        <KeyHints hints={[["j", "down"], ["k", "up"], ["x", "select"], ["a", "accept"], ["d", "dismiss"]]} />
      </div>
      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button size="sm" onClick={() => { act("accepted", [...selection.selected]); selection.clear(); }}>accept</Button>
        <Button size="sm" variant="outline" onClick={() => { act("dismissed", [...selection.selected]); selection.clear(); }}>dismiss</Button>
      </BulkBar>
      <div className="overflow-x-auto border-x">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all on this page"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onCheckedChange={selection.toggleAll}
                />
              </TableHead>
              {sortable("id", "ID")}
              {sortable("claim", "Claim")}
              {sortable("verdict", "Verdict")}
              {sortable("confidence", "Confidence")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id} {...keys.rowProps(i)} aria-selected={selection.isSelected(r.id)} className={rowStateClass}>
                <TableCell>
                  <Checkbox aria-label={`Select ${r.id}`} checked={selection.isSelected(r.id)} onCheckedChange={() => selection.toggle(r.id)} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                <TableCell>{r.claim}</TableCell>
                <TableCell><StatusBadge tone={tone[r.verdict]}>{r.verdict.replace("_", " ")}</StatusBadge></TableCell>
                <TableCell><ConfidenceMeter value={r.confidence} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
