import type { Metadata } from "next";

import { CheckLine, ConfidenceMeter, Panel, ProbabilityBars, RiskScale } from "@/components/data";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Overlays } from "./overlays";
import { ToastDemo } from "./toast-demo";

// Unlinked reference page: every component and state, for screenshots and copy-paste.
export const metadata: Metadata = { title: "Kitchen sink" };

const rows: { id: string; claim: string; verdict: string; tone: Tone; confidence: number; source: string; evidence: string }[] = [
  { id: "R01", claim: "Records are encrypted at rest", verdict: "agrees", tone: "info", confidence: 0.97, source: "p.8", evidence: "AES-256 for all stored data" },
  { id: "R02", claim: "Access reviewed quarterly", verdict: "contradicts", tone: "warning", confidence: 0.94, source: "p.20", evidence: "No review performed for Q2" },
  { id: "R03", claim: "Data deleted within 30 days", verdict: "no evidence", tone: "neutral", confidence: 0.38, source: "—", evidence: "Not addressed" },
];

export default function KitchenSink() {
  return (
    <>
      <PageHeader
        title="Kitchen sink"
        description="Every component and state in the starter."
        actions={
          <>
            <Button variant="outline">Secondary <Kbd>f</Kbd></Button>
            <Button>Primary action <Kbd className="border-primary-foreground/40 bg-primary text-primary-foreground">⏎</Kbd></Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Panel label="Recommendation" emphasis>
            <div className="mb-3 font-mono text-[26px] font-bold">
              REJECT <span className="text-[13px] font-normal text-primary">p=0.98</span>
            </div>
            <ProbabilityBars options={[{ label: "reject", p: 0.98 }, { label: "with conditions", p: 0.02 }, { label: "approve", p: 0 }]} />
          </Panel>
          <Panel label="Residual risk">
            <div className="mb-3 font-mono text-[26px] font-bold">
              2.7<span className="text-[13px] font-normal text-muted-foreground"> / 3</span>
            </div>
            <RiskScale levels={["low", "med", "high", "crit"]} probabilities={[0, 0, 0.31, 0.69]} />
          </Panel>
          <Panel label="Live checks">
            <CheckLine name="DMARC" ok={false} value="p=none" />
            <CheckLine name="TLS" ok value="1.3" />
            <CheckLine name="HSTS" ok value="present" />
            <CheckLine name="KEV" ok={null} value="0 entries" />
          </Panel>
        </div>

        <section>
          <div className="mb-2.5 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-[13px] font-bold tracking-[0.06em]">FINDINGS</h2>
            <Badge>contradicts 1</Badge>
            <Badge variant="outline">no evidence 1</Badge>
            <Badge variant="outline">agrees 1</Badge>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>a</Kbd> accept · <Kbd>d</Kbd> dismiss
            </span>
          </div>
          <div className="border-x">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.confidence < 0.6 ? "bg-panel" : undefined}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell>{r.claim}</TableCell>
                    <TableCell><StatusBadge tone={r.tone}>{r.verdict}</StatusBadge></TableCell>
                    <TableCell><ConfidenceMeter value={r.confidence} /></TableCell>
                    <TableCell className="text-[13px]"><span className="mr-1.5 font-mono text-[11px] text-primary">{r.source}</span>{r.evidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 font-mono text-xs"><Link href="/kitchen-sink/list" className="text-primary hover:underline">list pattern: sort, filter, page, select, bulk actions, keyboard →</Link></p>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel label="Form">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ks-name">Name</Label>
                <Input id="ks-name" placeholder="Acme Ltd" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ks-notes">Notes</Label>
                <Textarea id="ks-notes" placeholder="Anything worth recording" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button>Save</Button>
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
          </Panel>
          <Panel label="Tabs, progress, toast, overlays">
            <div className="grid gap-4">
              <Tabs defaultValue="a">
                <TabsList>
                  <TabsTrigger value="a">Summary</TabsTrigger>
                  <TabsTrigger value="b">Evidence</TabsTrigger>
                </TabsList>
                <TabsContent value="a" className="text-sm text-muted-foreground">Summary tab content.</TabsContent>
                <TabsContent value="b" className="text-sm text-muted-foreground">Evidence tab content.</TabsContent>
              </Tabs>
              <Progress value={64} />
              <ToastDemo />
              <Overlays />
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <EmptyState title="No records yet" description="Add the first one to get started." action={<Button size="sm">Add record</Button>} />
          <Panel label="Loading">
            <LoadingRows rows={4} />
          </Panel>
          <ErrorState message="The service did not respond within 15 seconds." />
        </div>
      </div>
    </>
  );
}
