"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  DEV_INVITE_BANNER_EVENT,
  DEV_INVITE_TTL_MS,
  DEV_PLAYER_INVITE_BANNER_KEY,
  isDevBannerEnabled,
  type DevInviteBannerPayload,
} from "@/lib/dev-banner";
import { createInvite } from "@/lib/invites/actions";
import { createInviteSchema } from "@/lib/validation/invites";

const playerInviteFormSchema = createInviteSchema.omit({ club_id: true, role: true });
type PlayerInviteFormValues = z.infer<typeof playerInviteFormSchema>;

type Props = { clubId: string };

export function InvitePlayerModal({ clubId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<PlayerInviteFormValues>({
    resolver: zodResolver(playerInviteFormSchema),
    defaultValues: { email: "", first_name: "", last_name: "" },
  });

  function onSubmit(values: PlayerInviteFormValues) {
    startTransition(async () => {
      const result = await createInvite({
        club_id: clubId,
        email: values.email,
        role: "player",
        first_name: values.first_name || null,
        last_name: values.last_name || null,
      });

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msgs] of Object.entries(result.fieldErrors)) {
            if (msgs && msgs.length > 0) {
              form.setError(k as keyof PlayerInviteFormValues, { message: msgs[0] });
            }
          }
        } else {
          toast.error(result.error);
        }
        return;
      }

      if (isDevBannerEnabled()) {
        try {
          const payload: DevInviteBannerPayload = {
            clubId,
            inviteToken: result.data.token,
            expiresAt: Date.now() + DEV_INVITE_TTL_MS,
          };
          window.sessionStorage.setItem(
            DEV_PLAYER_INVITE_BANNER_KEY,
            JSON.stringify(payload),
          );
          // Tell the on-page banner to re-read its snapshot. Same-tab
          // sessionStorage writes don't fire StorageEvent.
          window.dispatchEvent(new Event(DEV_INVITE_BANNER_EVENT));
        } catch {
          // Non-fatal — banner is dev-only and best-effort.
        }
      }

      toast.success(`Invite sent to ${values.email}`);
      form.reset();
      setOpen(false);
      // Refresh the server-rendered page so the new pending-invite row
      // appears in the table without a manual reload.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" data-testid="invite-player-trigger">
          Invite player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite a player</DialogTitle>
          <DialogDescription>
            Send a join link by email. The link is valid for 14 days; the player completes their
            profile after accepting.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            data-testid="invite-player-form"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="player@club.co.za"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name (optional)</FormLabel>
                    <FormControl>
                      <Input autoComplete="given-name" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name (optional)</FormLabel>
                    <FormControl>
                      <Input autoComplete="family-name" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription>
              Names prefill the player&apos;s profile setup; they can edit before submitting.
            </FormDescription>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
