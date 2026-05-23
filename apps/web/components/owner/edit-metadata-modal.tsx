"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CoverPicker } from "@/components/ui/cover-picker";
import { buildCoverUrl, type ProcessedCover } from "@/lib/cover";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { buildJarMetadata, hashMetadata } from "@/lib/metadata";
import { signMetadataUpload, uploadJarMetadata } from "@/lib/upload";
import { classifyError } from "@/lib/errors";
import type { JarPayload } from "@/lib/jar-fetch";

export function EditMetadataModal({
  open,
  onOpenChange,
  jar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jar: JarPayload;
}) {
  const client = useJarfiClient();
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const [title, setTitle] = useState(jar.metadata.title);
  const [desc, setDesc] = useState(jar.metadata.description);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coverDraft, setCoverDraft] = useState<ProcessedCover | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(jar.metadata.title);
      setDesc(jar.metadata.description);
      setError(null);
      setStatus("idle");
      setCoverDraft(null);
      setCoverRemoved(false);
    }
  }, [open, jar.metadata.title, jar.metadata.description]);

  const submit = async () => {
    if (!client || !publicKey || !signMessage) {
      setError("Connect a wallet first.");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const nextCoverUrl = coverDraft
        ? buildCoverUrl(jar.pda, coverDraft)
        : coverRemoved
          ? null
          : jar.metadata.coverUrl;

      const metadata = buildJarMetadata({
        title,
        description: desc,
        coverUrl: nextCoverUrl,
        disableContributors: jar.metadata.disableContributors,
      });
      const hash = await hashMetadata(metadata);
      const nonce = crypto.randomUUID();
      const onChainJar = await client.fetchJar(new PublicKey(jar.pda));
      if (!onChainJar) throw new Error("jar not found on-chain");
      const jarCount = onChainJar.account.id.toNumber();
      const { metadataJson, signature } = await signMetadataUpload({
        jarPda: jar.pda,
        jarCount,
        metadata,
        signMessage,
      });
      const { metadataUri } = await uploadJarMetadata({
        jarPda: jar.pda,
        wallet: publicKey.toBase58(),
        signature,
        nonce,
        jarCount,
        metadataJson,
        cover: coverDraft?.blob ?? null,
      });
      await client.updateMetadata(
        publicKey,
        new PublicKey(jar.pda),
        metadataUri,
        hash,
      );
      toast.success("Metadata updated.");
      onOpenChange(false);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "already_processed") {
        toast.success("Metadata update already landed.");
        onOpenChange(false);
        setStatus("idle");
        router.refresh();
        return;
      }
      setError(c.message);
      setStatus("error");
      if (c.kind !== "user_rejected") toast.error(c.message);
    }
  };

  const unchanged =
    title === jar.metadata.title &&
    desc === jar.metadata.description &&
    !coverDraft &&
    !coverRemoved;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit your jar">
      <p className="mb-5 text-sm text-mute">
        Update the name, story, or cover.
      </p>
      <div className="flex flex-col gap-4">
        <CoverPicker
          value={coverDraft}
          initialUrl={coverRemoved ? null : jar.metadata.coverUrl}
          onChange={(next) => {
            if (next) {
              setCoverDraft(next);
              setCoverRemoved(false);
            } else {
              setCoverDraft(null);
              setCoverRemoved(true);
            }
          }}
        />
        <Input
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          label="Description"
          name="desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        {error && (
          <p className="text-sm font-semibold text-coral-deep">{error}</p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Never mind
        </Button>
        <Button
          onClick={submit}
          disabled={status === "running" || !title || unchanged}
        >
          {status === "running" ? "Signing…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
