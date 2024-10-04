import { NextRequest } from "next/server";
import { ChainID, getBotLink, getUserForUI } from "../../bot/service";

export async function GET(req: NextRequest, { params: { address } }: { params: { address: string } }) {
  const searchParams = req.nextUrl.searchParams;

  const chainId: ChainID | null = 656476; // searchParams.get("chainId") as any;

  if (!address || !chainId) {
    throw new Error("Invalid Request data");
  }

  const user = await getUserForUI(address, chainId);
  const botStart = getBotLink();

  return Response.json({ user, botStart });
}
