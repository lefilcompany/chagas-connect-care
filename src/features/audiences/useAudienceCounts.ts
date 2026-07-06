import { useQuery } from "@tanstack/react-query";
import { resolveRecipients, type Recipient, type SegmentDef } from "@/lib/segments";

export type AudienceCounts = {
  eligible: number;
  byRelation: Record<string, number>;
  channels: Record<string, number>;
  sample: Recipient[];
  computedAt: string;
};

/** Resolves recipients for a segment. Cached ~5min via QueryClient defaults. */
export function useAudienceCounts(segment: SegmentDef | undefined) {
  return useQuery<AudienceCounts>({
    enabled: !!segment,
    queryKey: ["audience-counts", segment?.id, segment?.updated_at],
    queryFn: async () => {
      const recipients = await resolveRecipients(segment!.audience_types, segment!.filters);
      const byRelation: Record<string, number> = {};
      const channels: Record<string, number> = {};
      for (const r of recipients) {
        byRelation[r.relation] = (byRelation[r.relation] ?? 0) + 1;
        channels[r.channel] = (channels[r.channel] ?? 0) + 1;
      }
      return {
        eligible: recipients.length,
        byRelation,
        channels,
        sample: recipients.slice(0, 5),
        computedAt: new Date().toISOString(),
      };
    },
  });
}