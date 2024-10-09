import { faucetEntry } from "..";
import { and, eq } from "drizzle-orm";
import { db } from "~~/drizzle/db";

export type FaucetEntryType = typeof faucetEntry.$inferSelect;

export class FaucetEntry implements FaucetEntryType {
  address!: string;
  nextClaimTimestamp!: number;

  constructor(data: Partial<FaucetEntryType>) {
    this.address = data.address ?? "";
    this.nextClaimTimestamp = data.nextClaimTimestamp ?? 0;
  }

  static findOneBy = async (params: Partial<FaucetEntry>) =>
    db.query.faucetEntry
      .findFirst({
        where: and(
          ...(Object.keys(params) as (keyof FaucetEntryType)[]).map(key => eq(faucetEntry[key], params[key]!)),
        ),
      })
      .then(data => data && new FaucetEntry(data));

  static save = async (entry: FaucetEntry, isNew = false) =>
    (!isNew
      ? (() => {
          const { address, ...updatedData } = entry;
          return db.update(faucetEntry).set(updatedData).where(eq(faucetEntry.address, address));
        })()
      : db.insert(faucetEntry).values(entry)
    )
      .returning()
      .then(r => new FaucetEntry(r[0]));
}
