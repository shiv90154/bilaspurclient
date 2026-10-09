"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AppSettings } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { btnPrimary, ErrorNote, Field, inputCls, PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/password";

export function SettingsView({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title="Settings" subtitle={isAdmin ? "App switches and your password" : "Your password"} />
      {isAdmin && <Maintenance />}
      {isAdmin && <AppSwitches />}
      {isAdmin && <InstituteInfo />}
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">Change your password</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}

/** Maintenance mode: the website, student panel and student app show a "back soon" screen; staff keep working. */
function Maintenance() {
  const qc = useQueryClient();
  const router = useRouter();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<AppSettings>("/settings") });
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Partial<AppSettings>) => api<AppSettings>("/settings", { method: "PATCH", body }),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      setDraft(null);
      router.refresh(); // updates the reminder bar at the top of the panel
    },
  });

  const on = (save.isPending ? save.variables?.maintenanceMode : undefined) ?? settings.data?.maintenanceMode ?? false;
  const message = draft ?? settings.data?.maintenanceMessage ?? "";
  const changed = draft !== null && draft.trim() !== (settings.data?.maintenanceMessage ?? "");

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${on ? "border-danger/40 bg-danger-tint" : "border-line bg-surface"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="mt-label" className="text-[15px] font-bold">Maintenance mode</h2>
          <p id="mt-help" className="mt-1 max-w-md text-[12.5px] text-sub">
            When on, the website, the student web panel and the Android app show a &quot;We&apos;ll be back soon&quot; screen, and
            students cannot sign in or register. You and the faculty keep full access to this panel. The privacy, terms and
            account deletion pages stay open.
          </p>
        </div>
        <Switch
          checked={on}
          disabled={settings.isPending || save.isPending}
          labelledBy="mt-label"
          describedBy="mt-help"
          onChange={(v) => save.mutate({ maintenanceMode: v, maintenanceMessage: message.trim() })}
        />
      </div>
      <p className={`mt-3 text-[12.5px] font-semibold ${on ? "text-danger" : "text-sub"}`}>
        {settings.isPending ? "Loading…" : on ? "On: students see the maintenance screen right now." : "Off: the website and app are open."}
      </p>
      <div className="mt-4 border-t border-line pt-4">
        <Field label="Message on the maintenance screen (optional)">
          {(i) => (
            <textarea
              id={i}
              rows={2}
              maxLength={300}
              value={message}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. We are adding new courses. Back by 6 pm today."
              className={inputCls}
            />
          )}
        </Field>
        {changed && (
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            disabled={save.isPending}
            onClick={() => save.mutate({ maintenanceMessage: message.trim() })}
          >
            {save.isPending ? "Saving…" : "Save message"}
          </button>
        )}
      </div>
      <div className="mt-2">
        <ErrorNote error={settings.error ?? save.error} />
      </div>
    </section>
  );
}

function AppSwitches() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<AppSettings>("/settings") });
  const save = useMutation({
    mutationFn: (body: Partial<AppSettings>) => api<AppSettings>("/settings", { method: "PATCH", body }),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });

  const pending = save.isPending ? save.variables : undefined;
  const watermark = pending?.watermarkEnabled ?? settings.data?.watermarkEnabled;
  const devBlock = pending?.blockDeveloperOptions ?? settings.data?.blockDeveloperOptions;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-bold">Student app</h2>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p id="wm-label" className="text-[13.5px] font-semibold">Watermark</p>
          <p id="wm-help" className="mt-1 max-w-md text-[12.5px] text-sub">
            Shows the student&apos;s name and phone faintly across every screen of the Android app, so a photo of
            the screen can be traced back. Students see the change the next time they open the app.
          </p>
        </div>
        <Switch
          checked={watermark ?? false}
          disabled={settings.isPending || save.isPending}
          labelledBy="wm-label"
          describedBy="wm-help"
          onChange={(v) => save.mutate({ watermarkEnabled: v })}
        />
      </div>
      <p className="mt-3 text-[12.5px] font-semibold text-sub">
        {settings.isPending ? "Loading…" : watermark ? "On: students see the watermark." : "Off: no watermark in the app."}
      </p>
      <div className="mt-5 flex items-start justify-between gap-4 border-t border-line pt-5">
        <div>
          <p id="dev-label" className="text-[13.5px] font-semibold">Block Developer options</p>
          <p id="dev-help" className="mt-1 max-w-md text-[12.5px] text-sub">
            When on, the app does not open while Developer options or USB debugging is switched on in the phone (these let
            tools record or inspect the screen). Turn it off if many students get stuck on that screen.
          </p>
        </div>
        <Switch
          checked={devBlock ?? true}
          disabled={settings.isPending || save.isPending}
          labelledBy="dev-label"
          describedBy="dev-help"
          onChange={(v) => save.mutate({ blockDeveloperOptions: v })}
        />
      </div>
      <div className="mt-2">
        <ErrorNote error={settings.error ?? save.error} />
      </div>
    </section>
  );
}

/** Shown on the public privacy policy, terms and account deletion pages. */
function InstituteInfo() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<AppSettings>("/settings") });
  const save = useMutation({
    mutationFn: (body: Partial<AppSettings>) => api<AppSettings>("/settings", { method: "PATCH", body }),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      setSaved(true);
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    save.mutate({
      instituteName: text("instituteName"),
      contactEmail: text("contactEmail"),
      contactPhone: text("contactPhone"),
      address: text("address"),
    });
  }

  const s = settings.data;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-bold">Institute details</h2>
      <p className="mt-1 text-[12.5px] text-sub">
        Shown on the public <a href="/privacy" target="_blank" className="font-semibold text-primary">privacy policy</a>,{" "}
        <a href="/terms" target="_blank" className="font-semibold text-primary">terms</a> and{" "}
        <a href="/delete-account" target="_blank" className="font-semibold text-primary">account deletion</a> pages. Play Store needs a working contact email.
      </p>
      {s && (
        <form key={JSON.stringify(s)} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Institute name">{(i) => <input id={i} name="instituteName" required minLength={2} maxLength={120} defaultValue={s.instituteName} className={inputCls} />}</Field>
            <Field label="Contact email">{(i) => <input id={i} name="contactEmail" type="email" maxLength={150} defaultValue={s.contactEmail} className={inputCls} />}</Field>
            <Field label="Contact phone">{(i) => <input id={i} name="contactPhone" maxLength={20} defaultValue={s.contactPhone} className={inputCls} />}</Field>
          </div>
          <Field label="Address">{(i) => <input id={i} name="address" maxLength={300} defaultValue={s.address} className={inputCls} />}</Field>
          <ErrorNote error={save.error} />
          {saved && <p className="text-[12.5px] font-semibold text-success">Saved.</p>}
          <div>
            <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save details"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Switch({
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  labelledBy: string;
  describedBy?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-line"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
